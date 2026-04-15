import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { applyStageMilestones, calculateChecklistProgress, computeFollowUpStatus, getAgreementSnapshot, mergeChecklistState } from '@/lib/onboarding';
import { getPipedriveDeal, isOnboardingStage } from '@/lib/pipedrive';
import type { LinkedPipedriveDealSummary, OnboardingChecklistItemState, OnboardingNote, RetailerOnboarding, Retailer } from '@/types';

export const dynamic = 'force-dynamic';

type OnboardingRow = RetailerOnboarding & {
  retailer: Retailer | null;
  checklist_items: OnboardingChecklistItemState[] | null;
  notes: OnboardingNote[] | null;
};

export async function GET() {
  try {
    const { adminClient } = await requireAdminAccess();

    const [{ data: onboardingRows, error: onboardingError }, { data: allRetailers, error: retailersError }] = await Promise.all([
      adminClient
        .from('retailer_onboarding')
        .select('*, retailer:retailers(*), checklist_items:retailer_onboarding_checklist_items(*), notes:retailer_onboarding_notes(*)')
        .order('created_at', { ascending: false }),
      adminClient
        .from('retailers')
        .select('*')
        .order('company_name', { ascending: true }),
    ]);

    if (onboardingError) {
      throw onboardingError;
    }

    if (retailersError) {
      throw retailersError;
    }

    const rawRows = ((onboardingRows || []) as unknown as OnboardingRow[]);
    const dealDetails = await Promise.all(
      rawRows.map(async (row) => {
        if (!row.pipedrive_deal_id) {
          return { rowId: row.id, deal: null as LinkedPipedriveDealSummary | null };
        }

        try {
          const deal = await getPipedriveDeal(row.pipedrive_deal_id);
          return { rowId: row.id, deal };
        } catch (error) {
          console.error(`Failed to load Pipedrive deal ${row.pipedrive_deal_id}:`, error);
          return { rowId: row.id, deal: null as LinkedPipedriveDealSummary | null };
        }
      })
    );

    const dealByRowId = new Map(dealDetails.map((entry) => [entry.rowId, entry.deal]));

    const onboarding = await Promise.all(
      rawRows.map(async (row) => {
        const deal = dealByRowId.get(row.id) || null;
        let syncedRow = row;

        if (deal) {
          const updates = applyStageMilestones(row, deal);
          const hasChanges = Object.entries(updates).some(([key, value]) => value !== (row as unknown as Record<string, unknown>)[key]);

          if (hasChanges) {
            const { data: updatedRow } = await adminClient
              .from('retailer_onboarding')
              .update(updates)
              .eq('id', row.id)
              .select('*')
              .single();

            syncedRow = { ...row, ...(updatedRow || updates) };
          }
        } else if (!row.follow_up_status) {
          const derivedStatus = computeFollowUpStatus(row.next_follow_up_at, row.third_order_received_at);
          syncedRow = { ...row, follow_up_status: derivedStatus };
        }

        const checklistItems = row.checklist_items || [];
        const progress = calculateChecklistProgress(checklistItems);

        return {
          ...syncedRow,
          linked_deal: deal,
          checklist_items: checklistItems,
          checklist_sections: mergeChecklistState(checklistItems),
          agreement_snapshot: getAgreementSnapshot(checklistItems),
          checklist_progress: progress,
          is_active_onboarding: deal ? isOnboardingStage(deal.stageName) : false,
          follow_up_status: syncedRow.follow_up_status || computeFollowUpStatus(syncedRow.next_follow_up_at, syncedRow.third_order_received_at),
        };
      })
    );

    const linkedRetailerIds = new Set(onboarding.map((row) => row.retailer_id));
    const availableRetailers = (allRetailers || []).filter((retailer) => !linkedRetailerIds.has(retailer.id));

    return NextResponse.json({ onboarding, availableRetailers });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Onboarding health load error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load onboarding health data.' }, { status: 500 });
  }
}

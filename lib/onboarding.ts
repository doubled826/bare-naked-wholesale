import { formatISO, isBefore, isSameDay, startOfDay } from 'date-fns';
import { AGREEMENT_SNAPSHOT_ITEM_IDS, ONBOARDING_CHECKLIST_SECTIONS } from '@/lib/onboardingChecklist';
import type {
  LinkedPipedriveDealSummary,
  OnboardingChecklistItemState,
  RetailerOnboarding,
} from '@/types';

export function computeFollowUpStatus(nextFollowUpAt?: string | null, thirdOrderReceivedAt?: string | null) {
  if (thirdOrderReceivedAt) {
    return 'complete' as const;
  }

  if (!nextFollowUpAt) {
    return 'upcoming' as const;
  }

  const today = startOfDay(new Date());
  const dueDate = startOfDay(new Date(nextFollowUpAt));

  if (isSameDay(dueDate, today)) {
    return 'due' as const;
  }

  if (isBefore(dueDate, today)) {
    return 'overdue' as const;
  }

  return 'upcoming' as const;
}

export function getDefaultMilestones(stageName: string, anchorDate = new Date()) {
  const iso = formatISO(anchorDate);

  return {
    first_order_received_at: iso,
    second_order_received_at: stageName === 'Second Order Received' || stageName === 'Third Order Received' ? iso : null,
    third_order_received_at: stageName === 'Third Order Received' ? iso : null,
    next_follow_up_at: formatISO(new Date(anchorDate.getTime() + 42 * 24 * 60 * 60 * 1000)),
  };
}

export function applyStageMilestones(record: RetailerOnboarding, deal: LinkedPipedriveDealSummary) {
  const now = formatISO(new Date());
  const updates: Partial<RetailerOnboarding> = {
    pipedrive_stage_name: deal.stageName,
    owner_name: deal.ownerName,
    last_synced_at: now,
  };

  if (!record.first_order_received_at && (deal.stageName === 'First Order Received' || deal.stageName === 'Second Order Received' || deal.stageName === 'Third Order Received')) {
    updates.first_order_received_at = now;
  }

  if ((deal.stageName === 'Second Order Received' || deal.stageName === 'Third Order Received') && !record.second_order_received_at) {
    updates.second_order_received_at = now;
  }

  if (deal.stageName === 'Third Order Received' && !record.third_order_received_at) {
    updates.third_order_received_at = now;
  }

  updates.follow_up_status = computeFollowUpStatus(record.next_follow_up_at, updates.third_order_received_at || record.third_order_received_at);

  return updates;
}

export function mergeChecklistState(savedItems: OnboardingChecklistItemState[] = []) {
  const savedById = new Map(savedItems.map((item) => [item.item_id, item]));

  return ONBOARDING_CHECKLIST_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const saved = savedById.get(item.id);
      return {
        ...item,
        checked: saved?.completed || false,
        agreement: saved?.agreed_value || '',
        completedAt: saved?.completed_at || null,
      };
    }),
  }));
}

export function getAgreementSnapshot(savedItems: OnboardingChecklistItemState[] = []) {
  const savedById = new Map(savedItems.map((item) => [item.item_id, item]));

  return AGREEMENT_SNAPSHOT_ITEM_IDS.map((itemId) => savedById.get(itemId)?.agreed_value?.trim())
    .filter(Boolean)
    .slice(0, 3) as string[];
}

export function calculateChecklistProgress(savedItems: OnboardingChecklistItemState[] = []) {
  const total = ONBOARDING_CHECKLIST_SECTIONS.reduce((sum, section) => sum + section.items.length, 0);
  const completed = savedItems.filter((item) => item.completed).length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  addPipedriveNote,
  completePipedriveActivity,
  createPipedriveActivity,
  listOverduePipedriveActivities,
} from '@/lib/pipedrive';

export const dynamic = 'force-dynamic';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireAdminAccess();
    const { searchParams } = new URL(request.url);
    const dueThrough = searchParams.get('dueThrough') || todayDateString();
    const requestedLimit = Number(searchParams.get('limit') || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 1000)) : 100;

    const activities = await listOverduePipedriveActivities(dueThrough, limit);
    return NextResponse.json({
      activities,
      stats: {
        overdue: activities.filter((activity) => activity.dueDate && activity.dueDate < dueThrough).length,
        dueToday: activities.filter((activity) => activity.dueDate === dueThrough).length,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive activity load error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load Pipedrive activities.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminAccess();
    const { dealId, subject, dueDate } = await request.json();

    if (!dealId || !subject?.trim() || !dueDate) {
      return NextResponse.json({ error: 'dealId, subject, and dueDate are required.' }, { status: 400 });
    }

    const activity = await createPipedriveActivity(Number(dealId), subject.trim(), dueDate);
    return NextResponse.json({ activity });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive activity error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create Pipedrive activity.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminAccess();
    const { activityId, dealId, outcomeNote, nextSubject, nextDueDate } = await request.json();

    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required.' }, { status: 400 });
    }

    const activity = await completePipedriveActivity(Number(activityId));
    const followUpResults = await Promise.allSettled([
      dealId && typeof outcomeNote === 'string' && outcomeNote.trim()
        ? addPipedriveNote(Number(dealId), outcomeNote.trim())
        : Promise.resolve(null),
      dealId && typeof nextSubject === 'string' && nextSubject.trim() && nextDueDate
        ? createPipedriveActivity(Number(dealId), nextSubject.trim(), nextDueDate)
        : Promise.resolve(null),
    ]);
    const [noteResult, nextActivityResult] = followUpResults;
    const note = noteResult.status === 'fulfilled' ? noteResult.value : null;
    const nextActivity = nextActivityResult.status === 'fulfilled' ? nextActivityResult.value : null;
    const warnings = followUpResults
      .filter((result) => result.status === 'rejected')
      .map((result) => (result as PromiseRejectedResult).reason)
      .map((reason) => (reason instanceof Error ? reason.message : 'Optional Pipedrive follow-up sync failed.'));

    return NextResponse.json({ activity, note, nextActivity, warnings });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Pipedrive activity completion error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update Pipedrive activity.' }, { status: 500 });
  }
}

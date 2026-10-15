import { NextResponse } from 'next/server';
import { sendTeamEmail } from '@/lib/email';
import { getPipedriveStageTransitionsSince, resolvePipedriveStageId } from '@/lib/pipedrive';
import { buildSalesRecap, getSalesRecapPeriods, renderSalesRecap } from '@/lib/salesRecap';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}` || request.headers.get('x-cron-secret') === secret;
}

const splitList = (value?: string) => (value || '').split(',').map((item) => item.trim()).filter(Boolean);

async function handleSalesRecap(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const recipients = splitList(process.env.SALES_RECAP_EMAIL_TO);
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Configure SALES_RECAP_EMAIL_TO before enabling the report.' }, { status: 500 });
  }

  const now = new Date();
  const periods = getSalesRecapPeriods(now);
  const [samplesStageId, newStoresStageId] = await Promise.all([
    resolvePipedriveStageId('Samples', process.env.SALES_RECAP_SAMPLES_STAGE_ID),
    resolvePipedriveStageId('First Order Received', process.env.SALES_RECAP_NEW_STORES_STAGE_ID),
  ]);
  const earliestPeriodStart = periods.week.start < periods.year.start ? periods.week.start : periods.year.start;
  const transitions = await getPipedriveStageTransitionsSince(
    new Date(`${earliestPeriodStart}T00:00:00-05:00`),
    now,
  );
  const ownerNames = splitList(process.env.SALES_RECAP_OWNER_NAMES || 'David,Gianna');
  const recap = buildSalesRecap(transitions, { samples: samplesStageId, newStores: newStoresStageId }, ownerNames, now);
  const email = renderSalesRecap(recap);

  await sendTeamEmail({
    to: recipients,
    cc: splitList(process.env.SALES_RECAP_EMAIL_CC),
    ...email,
  });

  return NextResponse.json({ success: true, recipients, recap });
}

export async function GET(request: Request) {
  try {
    return await handleSalesRecap(request);
  } catch (error) {
    console.error('Weekly sales recap error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send sales recap.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

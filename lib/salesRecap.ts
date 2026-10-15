import type { PipedriveStageTransition } from '@/lib/pipedrive';

export const SALES_RECAP_TIME_ZONE = 'America/Detroit';

type DateRange = { start: string; endExclusive: string };

export type SalesRecapPeriods = {
  week: DateRange;
  month: DateRange;
  year: DateRange;
};

export type StageRecap = {
  week: number;
  month: number;
  year: number;
  weekByOwner: Record<string, number>;
};

export type SalesRecap = {
  periods: SalesRecapPeriods;
  samples: StageRecap;
  newStores: StageRecap;
};

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SALES_RECAP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function localDateKey(date: Date) {
  const parts = dateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function parsePipedriveTime(value: string) {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
}

function addDateDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export function getSalesRecapPeriods(now = new Date()): SalesRecapPeriods {
  const today = localDateKey(now);
  const currentWeekStart = addDateDays(today, -dayOfWeek(today));
  const previousWeekStart = addDateDays(currentWeekStart, -7);
  const previousWeekEnd = addDateDays(currentWeekStart, -1);

  return {
    week: { start: previousWeekStart, endExclusive: currentWeekStart },
    month: { start: `${previousWeekEnd.slice(0, 7)}-01`, endExclusive: currentWeekStart },
    year: { start: `${previousWeekEnd.slice(0, 4)}-01-01`, endExclusive: currentWeekStart },
  };
}

function summarizeStage(
  transitions: PipedriveStageTransition[],
  stageId: number,
  periods: SalesRecapPeriods,
  ownerNames: string[],
): StageRecap {
  const entries = transitions
    .filter((transition) => transition.toStageId === stageId)
    .map((transition) => ({ ...transition, dateKey: localDateKey(parsePipedriveTime(transition.changedAt)) }));
  const inRange = (dateKey: string, range: DateRange) => dateKey >= range.start && dateKey < range.endExclusive;
  const uniqueCount = (range: DateRange) => new Set(entries.filter((entry) => inRange(entry.dateKey, range)).map((entry) => entry.dealId)).size;
  const weekEntries = entries.filter((entry) => inRange(entry.dateKey, periods.week));
  const weekByOwner = Object.fromEntries(ownerNames.map((owner) => [owner, 0]));

  for (const owner of ownerNames) {
    weekByOwner[owner] = new Set(
      weekEntries.filter((entry) => entry.ownerName?.trim().toLowerCase() === owner.toLowerCase()).map((entry) => entry.dealId),
    ).size;
  }

  for (const owner of Array.from(new Set(weekEntries.map((entry) => entry.ownerName || 'Unassigned')))) {
    if (!Object.keys(weekByOwner).some((name) => name.toLowerCase() === owner.toLowerCase())) {
      weekByOwner[owner] = new Set(weekEntries.filter((entry) => (entry.ownerName || 'Unassigned') === owner).map((entry) => entry.dealId)).size;
    }
  }

  return {
    week: uniqueCount(periods.week),
    month: uniqueCount(periods.month),
    year: uniqueCount(periods.year),
    weekByOwner,
  };
}

export function buildSalesRecap(
  transitions: PipedriveStageTransition[],
  stageIds: { samples: number; newStores: number },
  ownerNames: string[],
  now = new Date(),
): SalesRecap {
  const periods = getSalesRecapPeriods(now);
  return {
    periods,
    samples: summarizeStage(transitions, stageIds.samples, periods, ownerNames),
    newStores: summarizeStage(transitions, stageIds.newStores, periods, ownerNames),
  };
}

const displayDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${month}/${day}/${year.slice(2)}`;
};

const ownerBreakdown = (values: Record<string, number>) =>
  Object.entries(values).map(([owner, count]) => `${owner} - ${count} ${count === 1 ? 'deal' : 'deals'}`).join(', ');

export function renderSalesRecap(recap: SalesRecap) {
  const weekEnd = addDateDays(recap.periods.week.endExclusive, -1);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${recap.periods.month.start}T12:00:00Z`));
  const year = recap.periods.year.start.slice(0, 4);
  const subject = `${displayDate(recap.periods.week.start)} Sales Recap`;
  const samplesOwners = ownerBreakdown(recap.samples.weekByOwner);
  const newStoresOwners = ownerBreakdown(recap.newStores.weekByOwner);
  const text = `Hi Team,

Please look at our metrics for the week of ${displayDate(recap.periods.week.start)} - ${displayDate(weekEnd)}.

Samples last week: ${recap.samples.week} deals (${samplesOwners})
New stores last week: ${recap.newStores.week} deals (${newStoresOwners})

Samples this month: ${recap.samples.month} deals (${monthName})
New stores this month: ${recap.newStores.month} deals (${monthName})
Samples this year: ${recap.samples.year} deals
New stores this year: ${recap.newStores.year} deals (${year})`;
  const html = `<p>Hi Team,</p>
<p>Please look at our metrics for the week of ${displayDate(recap.periods.week.start)} - ${displayDate(weekEnd)}.</p>
<p>Samples last week: <strong>${recap.samples.week} deals</strong> (${samplesOwners})<br>
New stores last week: <strong>${recap.newStores.week} deals</strong> (${newStoresOwners})</p>
<p>Samples this month: <strong>${recap.samples.month} deals</strong> (${monthName})<br>
New stores this month: <strong>${recap.newStores.month} deals</strong> (${monthName})<br>
Samples this year: <strong>${recap.samples.year} deals</strong><br>
New stores this year: <strong>${recap.newStores.year} deals</strong> (${year})</p>`;

  return { subject, text, html };
}

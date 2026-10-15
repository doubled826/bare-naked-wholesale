import assert from 'node:assert/strict';
import { buildSalesRecap, getSalesRecapPeriods, renderSalesRecap } from '@/lib/salesRecap';
import type { PipedriveStageTransition } from '@/lib/pipedrive';

const now = new Date('2026-10-11T14:00:00Z');
assert.deepEqual(getSalesRecapPeriods(now), {
  week: { start: '2026-10-04', endExclusive: '2026-10-11' },
  month: { start: '2026-10-01', endExclusive: '2026-10-11' },
  year: { start: '2026-01-01', endExclusive: '2026-10-11' },
});
assert.deepEqual(getSalesRecapPeriods(new Date('2026-01-04T14:00:00Z')), {
  week: { start: '2025-12-28', endExclusive: '2026-01-04' },
  month: { start: '2026-01-01', endExclusive: '2026-01-04' },
  year: { start: '2026-01-01', endExclusive: '2026-01-04' },
});

const transition = (
  dealId: number,
  toStageId: number,
  changedAt: string,
  ownerName: string,
): PipedriveStageTransition => ({
  dealId,
  dealTitle: `Deal ${dealId}`,
  ownerName,
  fromStageId: 1,
  toStageId,
  changedAt,
});

const recap = buildSalesRecap([
  transition(1, 10, '2026-10-04 04:30:00', 'Gianna'), // 10/04 in Detroit
  transition(2, 10, '2026-10-10 18:00:00', 'Gianna'),
  transition(2, 10, '2026-10-10 19:00:00', 'Gianna'), // same deal is counted once
  transition(3, 20, '2026-10-08 18:00:00', 'David'),
  transition(4, 20, '2026-10-03 18:00:00', 'David'),
  transition(5, 10, '2026-08-01 18:00:00', 'David'),
], { samples: 10, newStores: 20 }, ['David', 'Gianna'], now);

assert.equal(recap.samples.week, 2);
assert.equal(recap.samples.month, 2);
assert.equal(recap.samples.year, 3);
assert.deepEqual(recap.samples.weekByOwner, { David: 0, Gianna: 2 });
assert.equal(recap.newStores.week, 1);
assert.equal(recap.newStores.month, 2);
assert.equal(recap.newStores.year, 2);
assert.match(renderSalesRecap(recap).subject, /^10\/04\/26 Sales Recap$/);

console.log('sales recap tests passed');

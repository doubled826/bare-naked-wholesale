import assert from 'node:assert/strict';
import {
  calculateBareLaunchOfferDiscount,
  getBareLaunchOfferStatus,
} from '@/lib/bareLaunchOffer';

const createdAt = new Date('2026-07-01T12:00:00.000Z');

const activeOffer = getBareLaunchOfferStatus({
  accountCreatedAt: createdAt,
  activeOrderCount: 0,
  now: new Date('2026-07-10T12:00:00.000Z'),
});

assert.equal(activeOffer.eligible, true);
assert.equal(activeOffer.daysRemaining, 5);
assert.equal(activeOffer.expiresAt, '2026-07-15T12:00:00.000Z');

const expiredOffer = getBareLaunchOfferStatus({
  accountCreatedAt: createdAt,
  activeOrderCount: 0,
  now: new Date('2026-07-16T12:00:00.000Z'),
});

assert.equal(expiredOffer.eligible, false);
assert.equal(expiredOffer.daysRemaining, 0);

const orderedOffer = getBareLaunchOfferStatus({
  accountCreatedAt: createdAt,
  activeOrderCount: 1,
  now: new Date('2026-07-10T12:00:00.000Z'),
});

assert.equal(orderedOffer.eligible, false);
assert.equal(orderedOffer.expiresAt, null);

assert.equal(calculateBareLaunchOfferDiscount(100), 10);
assert.equal(calculateBareLaunchOfferDiscount(19.99), 2);
assert.equal(calculateBareLaunchOfferDiscount(0), 0);

console.log('bare launch offer tests passed');

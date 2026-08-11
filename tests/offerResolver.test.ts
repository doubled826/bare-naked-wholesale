import assert from 'node:assert/strict';
import {
  chooseCompetingCandidate,
  formatOfferBenefitLabel,
  resolveOfferCandidates,
  toPublicOfferBenefit,
  type OfferCandidate,
} from '../lib/offerResolver';

const candidate = (overrides: Partial<OfferCandidate>): OfferCandidate => ({
  sourceType: 'discount_code',
  sourceId: 'discount',
  code: 'CODE',
  name: 'Discount',
  benefitCategory: 'first_order_discount',
  discountType: 'percent',
  discountValue: 10,
  amount: 10,
  priority: 0,
  priorityOverride: false,
  stackableWithOtherDiscounts: false,
  expiresAt: null,
  discount: null,
  ...overrides,
});

const welcome = candidate({
  sourceType: 'welcome_offer',
  sourceId: 'BARE_LAUNCH_OFFER',
  code: 'BARE_LAUNCH_OFFER',
  name: 'Welcome Offer',
  discountValue: 10,
  amount: 10,
});

const superZoo = candidate({
  sourceId: 'superzoo',
  code: 'SUPERZOO15',
  name: 'SuperZoo',
  discountValue: 15,
  amount: 15,
});

assert.equal(chooseCompetingCandidate([welcome, superZoo])?.name, 'SuperZoo');

const worseOverride = candidate({
  sourceId: 'override',
  name: 'Intentional lower priority override',
  discountValue: 5,
  amount: 5,
  priority: 100,
  priorityOverride: true,
});

assert.equal(chooseCompetingCandidate([superZoo, worseOverride])?.name, 'Intentional lower priority override');

const resolved = resolveOfferCandidates([
  welcome,
  superZoo,
  candidate({
    sourceId: 'general',
    code: 'GENERAL5',
    name: 'General order discount',
    benefitCategory: 'order_discount',
    discountValue: 5,
    amount: 5,
  }),
]);

assert.deepEqual(resolved.appliedBenefits.map((benefit) => benefit.name), ['SuperZoo']);
assert.equal(resolved.blockedBenefits.some((benefit) => benefit.name === 'Welcome Offer'), true);
assert.equal(resolved.blockedBenefits.some((benefit) => benefit.name === 'General order discount'), true);
assert.equal(resolved.blockedBenefits.find((benefit) => benefit.name === 'Welcome Offer')?.blockedReason, 'better_offer');
assert.equal(resolved.blockedBenefits.find((benefit) => benefit.name === 'General order discount')?.blockedReason, 'cannot_combine');

const stackableResolved = resolveOfferCandidates([
  { ...superZoo, stackableWithOtherDiscounts: true },
  candidate({
    sourceId: 'general',
    code: 'GENERAL5',
    name: 'General order discount',
    benefitCategory: 'order_discount',
    discountValue: 5,
    amount: 5,
    stackableWithOtherDiscounts: true,
  }),
]);

assert.equal(stackableResolved.appliedBenefits.length, 2);
assert.equal(stackableResolved.totalDiscount, 20);

assert.equal(formatOfferBenefitLabel(superZoo), 'SuperZoo (15%)');
assert.deepEqual(toPublicOfferBenefit(superZoo), {
  id: 'discount_code:superzoo',
  name: 'SuperZoo',
  label: 'SuperZoo (15%)',
  discountType: 'percent',
  discountValue: 15,
  amount: 15,
  expiresAt: null,
  daysRemaining: undefined,
  isFirstOrderBenefit: true,
  isWelcomeOffer: false,
});

console.log('offer resolver tests passed');

import assert from 'node:assert/strict';
import {
  buildBenefitRedemptionRows,
  buildDiscountRedemptionRows,
  buildOrderItemRows,
} from '../lib/orderTransactions';
import type { OfferCandidate } from '../lib/offerResolver';

const benefits: OfferCandidate[] = [
  {
    sourceType: 'discount_code',
    sourceId: 'discount-1',
    code: 'SUPERZOO15',
    name: 'SuperZoo Offer',
    applicationMethod: 'automatic',
    benefitCategory: 'first_order_discount',
    discountType: 'percent',
    discountValue: 15,
    amount: 18,
    priority: 0,
    priorityOverride: false,
    stackableWithOtherDiscounts: false,
    expiresAt: '2026-08-14T23:59:59.000Z',
    discount: null,
  },
  {
    sourceType: 'welcome_offer',
    sourceId: 'BARE_LAUNCH_OFFER',
    code: 'BARE_LAUNCH_OFFER',
    name: 'Welcome Offer',
    applicationMethod: 'automatic',
    benefitCategory: 'first_order_discount',
    discountType: 'percent',
    discountValue: 10,
    amount: 0,
    priority: 0,
    priorityOverride: false,
    stackableWithOtherDiscounts: false,
    expiresAt: null,
    discount: null,
  },
];

assert.deepEqual(buildOrderItemRows([
  { productId: 'product-1', quantity: 2, unitPrice: 12.5 },
]), [
  {
    product_id: 'product-1',
    quantity: 2,
    unit_price: 12.5,
    total_price: 25,
  },
]);

assert.deepEqual(buildDiscountRedemptionRows(benefits), [
  {
    discount_code_id: 'discount-1',
    discount_amount: 18,
  },
]);

assert.deepEqual(buildBenefitRedemptionRows(benefits), [
  {
    source_type: 'discount_code',
    source_id: 'discount-1',
    source_name: 'SuperZoo Offer',
    benefit_category: 'first_order_discount',
    discount_type: 'percent',
    discount_value: 15,
    discount_amount: 18,
  },
]);

console.log('order transaction payload tests passed');

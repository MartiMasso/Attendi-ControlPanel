import assert from "node:assert/strict";
import test from "node:test";

import { computeBusinessPerformanceLedgerMath } from "../lib/business-performance-ledger";

test("partial cancellation 1.32/0.50/0.45 computes attendi 0.37 and net with stripe fee", () => {
  const result = computeBusinessPerformanceLedgerMath({
    customerPaidCents: 132,
    refundedCents: 50,
    ownerEarningsCents: 45,
    hotelEarningsCents: 0,
    stripeFeeCents: 27,
    feeEstimated: false
  });

  assert.equal(result.attendiBeforeStripeCents, 37);
  assert.equal(result.attendiNetCents, 10);
  assert.equal(result.feeSource, "real");
});

test("operation without refund", () => {
  const result = computeBusinessPerformanceLedgerMath({
    customerPaidCents: 200,
    refundedCents: 0,
    ownerEarningsCents: 150,
    hotelEarningsCents: 0,
    stripeFeeCents: 8,
    feeEstimated: false
  });

  assert.equal(result.attendiBeforeStripeCents, 50);
  assert.equal(result.attendiNetCents, 42);
});

test("hotel_linked_external operation", () => {
  const result = computeBusinessPerformanceLedgerMath({
    customerPaidCents: 500,
    refundedCents: 100,
    ownerEarningsCents: 280,
    hotelEarningsCents: 40,
    stripeFeeCents: 15,
    feeEstimated: false
  });

  assert.equal(result.attendiBeforeStripeCents, 80);
  assert.equal(result.attendiNetCents, 65);
});

test("hotel_own_product operation", () => {
  const result = computeBusinessPerformanceLedgerMath({
    customerPaidCents: 300,
    refundedCents: 0,
    ownerEarningsCents: 240,
    hotelEarningsCents: 0,
    stripeFeeCents: 5,
    feeEstimated: false
  });

  assert.equal(result.attendiBeforeStripeCents, 60);
  assert.equal(result.attendiNetCents, 55);
});

test("fee_estimated true is reflected in fee source", () => {
  const result = computeBusinessPerformanceLedgerMath({
    customerPaidCents: 100,
    refundedCents: 0,
    ownerEarningsCents: 80,
    hotelEarningsCents: 0,
    stripeFeeCents: 0,
    feeEstimated: true
  });

  assert.equal(result.feeEstimated, true);
  assert.equal(result.feeSource, "estimated");
});

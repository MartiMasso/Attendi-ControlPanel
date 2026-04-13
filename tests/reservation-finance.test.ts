import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReservationFallbackSplit,
  determineReservationFlowType
} from "../lib/reservation-finance";

test("determineReservationFlowType resolves standard / external hotel-link / hotel own product", () => {
  assert.equal(
    determineReservationFlowType({
      ownerType: "business",
      ownerUserId: "owner-1",
      linkedHotelId: null
    }),
    "standard"
  );

  assert.equal(
    determineReservationFlowType({
      ownerType: "business",
      ownerUserId: "owner-1",
      linkedHotelId: "hotel-1"
    }),
    "hotel_link_external"
  );

  assert.equal(
    determineReservationFlowType({
      ownerType: "hotel",
      ownerUserId: "hotel-1",
      linkedHotelId: "hotel-1"
    }),
    "hotel_own_product"
  );
});

test("calculateReservationFallbackSplit handles standard flow", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 10_000,
    insuranceCents: 0,
    cclCents: 500,
    refundedCustomerCents: 0,
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.ownerAmountCents, 9_000);
  assert.equal(result.hotelAmountCents, 0);
  assert.equal(result.attendiAmountBeforeStripeCents, 1_500);
});

test("calculateReservationFallbackSplit handles hotel_link_external flow", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "hotel_link_external",
    pBaseCents: 10_000,
    insuranceCents: 0,
    cclCents: 500,
    refundedCustomerCents: 0,
    cpPct: 10,
    cePPct: 20,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.ownerAmountCents, 8_000);
  assert.equal(result.hotelAmountCents, 800);
  assert.equal(result.attendiAmountBeforeStripeCents, 1_700);
});

test("calculateReservationFallbackSplit handles hotel_own_product flow", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "hotel_own_product",
    pBaseCents: 10_000,
    insuranceCents: 0,
    cclCents: 500,
    refundedCustomerCents: 0,
    cpPct: 0,
    cePPct: 0,
    chPct: 15,
    kHotel: 0.4
  });

  assert.equal(result.ownerAmountCents, 8_500);
  assert.equal(result.hotelAmountCents, 0);
  assert.equal(result.attendiAmountBeforeStripeCents, 2_000);
});

test("calculateReservationFallbackSplit handles retention on cancellation", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 10_000,
    insuranceCents: 0,
    cclCents: 500,
    refundedCustomerCents: 5_000,
    status: "cancelled",
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.retentionPctEffective, 0.5);
  assert.equal(result.retainedBaseCents, 5_000);
  assert.equal(result.ownerAmountCents, 4_500);
  assert.equal(result.attendiAmountBeforeStripeCents, 1_000);
});

test("free cancellation <= 7 days refunds CCl", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 10_000,
    insuranceCents: 200,
    cclCents: 500,
    refundedCustomerCents: 10_700,
    status: "cancelled",
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4,
    retentionPctHint: 0,
    isFreeCancellation: true,
    authorizedToStartDays: 5
  });

  assert.equal(result.cclRetainedCents, 0);
  assert.equal(result.attendiAmountBeforeStripeCents, 0);
});

test("free cancellation > 7 days keeps CCl", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 10_000,
    insuranceCents: 200,
    cclCents: 500,
    refundedCustomerCents: 10_200,
    status: "cancelled",
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4,
    retentionPctHint: 0,
    isFreeCancellation: true,
    authorizedToStartDays: 15
  });

  assert.equal(result.cclRetainedCents, 500);
  assert.equal(result.attendiAmountBeforeStripeCents, 500);
});

test("standard partial cancellation: P=100 X=50 CP=10 => owner=45", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 100,
    insuranceCents: 0,
    cclCents: 32,
    refundedCustomerCents: 50,
    status: "cancelled",
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.retainedBaseCents, 50);
  assert.equal(result.ownerAmountCents, 45);
  assert.equal(result.attendiAmountBeforeStripeCents, 37);
});

test("X=0 => owner=0 in cancellation fallback", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 100,
    insuranceCents: 0,
    cclCents: 0,
    refundedCustomerCents: 100,
    status: "cancelled",
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.retainedBaseCents, 0);
  assert.equal(result.ownerAmountCents, 0);
});

test("X=100 => owner=P*(1-CP)", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "standard",
    pBaseCents: 100,
    insuranceCents: 0,
    cclCents: 0,
    refundedCustomerCents: 0,
    status: "paid",
    cpPct: 10,
    cePPct: 0,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.retainedBaseCents, 100);
  assert.equal(result.ownerAmountCents, 90);
});

test("hotel_link_external partial cancellation uses CE_p + K_hotel", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "hotel_link_external",
    pBaseCents: 100,
    insuranceCents: 0,
    cclCents: 0,
    refundedCustomerCents: 50,
    status: "cancelled",
    cpPct: 10,
    cePPct: 20,
    chPct: 0,
    kHotel: 0.4
  });

  assert.equal(result.retainedBaseCents, 50);
  assert.equal(result.ownerAmountCents, 40);
  assert.equal(result.hotelAmountCents, 4);
  assert.equal(result.attendiAmountBeforeStripeCents, 6);
});

test("hotel_own_product partial cancellation uses CH", () => {
  const result = calculateReservationFallbackSplit({
    flowType: "hotel_own_product",
    pBaseCents: 100,
    insuranceCents: 0,
    cclCents: 0,
    refundedCustomerCents: 50,
    status: "cancelled",
    cpPct: 0,
    cePPct: 0,
    chPct: 10,
    kHotel: 0.4
  });

  assert.equal(result.retainedBaseCents, 50);
  assert.equal(result.ownerAmountCents, 45);
  assert.equal(result.attendiAmountBeforeStripeCents, 5);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateEventsByMonth,
  aggregateEventsForPeriod,
  buildPeriodBounds,
  calculateCommissionCents,
  type ReservationPerformanceEvent
} from "../lib/business-performance";

function event(input: Partial<ReservationPerformanceEvent>): ReservationPerformanceEvent {
  return {
    reservationId: input.reservationId ?? "res-1",
    entityId: input.entityId ?? "entity-1",
    entityType: input.entityType ?? "business",
    agentUserId: input.agentUserId ?? null,
    status: input.status ?? "ended",
    flowType: input.flowType ?? "standard",
    effectiveAt: input.effectiveAt ?? "2026-01-01T12:00:00.000Z",
    refundAt: input.refundAt ?? null,
    grossCents: input.grossCents ?? 0,
    refundCents: input.refundCents ?? 0,
    attendiProfitCents: input.attendiProfitCents ?? 0,
    ownerEarningsCents: input.ownerEarningsCents ?? 0,
    hotelEarningsCents: input.hotelEarningsCents ?? 0,
    customerPaidCents: input.customerPaidCents ?? input.grossCents ?? 0,
    hasCashMovement: input.hasCashMovement ?? true,
    isEstimated: input.isEstimated ?? false
  };
}

test("calculateCommissionCents applies percentage safely", () => {
  assert.equal(calculateCommissionCents(125_000, 12.5), 15_625);
  assert.equal(calculateCommissionCents(125_000, 0), 0);
  assert.equal(calculateCommissionCents(125_000, -5), 0);
  assert.equal(calculateCommissionCents(0, 12.5), 0);
});

test("aggregateEventsByMonth handles gross and refunds by month", () => {
  const events = [
    event({
      reservationId: "res-jan",
      effectiveAt: "2026-01-15T09:00:00.000Z",
      grossCents: 10_000,
      attendiProfitCents: 1_500
    }),
    event({
      reservationId: "res-feb",
      effectiveAt: "2026-02-10T09:00:00.000Z",
      refundAt: "2026-02-20T10:00:00.000Z",
      status: "refunded",
      grossCents: 20_000,
      refundCents: 5_000,
      attendiProfitCents: 3_000
    })
  ];

  const monthly = aggregateEventsByMonth(
    events,
    new Date("2026-04-01T00:00:00.000Z"),
    3,
    { entityType: "all", agentUserId: "" }
  );

  assert.equal(monthly.length, 3);
  assert.equal(monthly[0].key, "2026-01");
  assert.equal(monthly[0].metrics.gmvCents, 10_000);
  assert.equal(monthly[0].metrics.attendiProfitCents, 1_500);
  assert.equal(monthly[0].metrics.operations, 1);

  assert.equal(monthly[1].key, "2026-02");
  assert.equal(monthly[1].metrics.gmvCents, 15_000);
  assert.equal(monthly[1].metrics.attendiProfitCents, 3_000);
  assert.equal(monthly[1].metrics.operations, 1);
  assert.equal(monthly[1].metrics.refundedOperations, 1);

  assert.equal(monthly[2].key, "2026-03");
  assert.equal(monthly[2].metrics.gmvCents, 0);
  assert.equal(monthly[2].metrics.operations, 0);
});

test("aggregateEventsForPeriod filters by agent, type and period", () => {
  const events = [
    event({
      reservationId: "march-business-a",
      entityType: "business",
      agentUserId: "agent-a",
      effectiveAt: "2026-03-10T10:00:00.000Z",
      grossCents: 10_000,
      attendiProfitCents: 1_000
    }),
    event({
      reservationId: "march-hotel-b",
      entityType: "hotel",
      agentUserId: "agent-b",
      effectiveAt: "2026-03-11T10:00:00.000Z",
      grossCents: 20_000,
      attendiProfitCents: 2_000
    }),
    event({
      reservationId: "feb-business-a",
      entityType: "business",
      agentUserId: "agent-a",
      effectiveAt: "2026-02-01T10:00:00.000Z",
      grossCents: 5_000,
      attendiProfitCents: 500
    })
  ];

  const march = buildPeriodBounds(2026, 3);

  const businessAgentA = aggregateEventsForPeriod(events, march, {
    entityType: "business",
    agentUserId: "agent-a"
  });

  assert.equal(businessAgentA.gmvCents, 10_000);
  assert.equal(businessAgentA.attendiProfitCents, 1_000);
  assert.equal(businessAgentA.operations, 1);

  const allMarch = aggregateEventsForPeriod(events, march, {
    entityType: "all",
    agentUserId: ""
  });

  assert.equal(allMarch.gmvCents, 30_000);
  assert.equal(allMarch.attendiProfitCents, 3_000);
  assert.equal(allMarch.operations, 2);
});

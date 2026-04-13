import type { BusinessEntityType, BusinessEntityTypeFilter } from "@/types";

export interface BusinessPerformanceFilters {
  year: number;
  month: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  entityType: BusinessEntityTypeFilter;
  operationStatus: string;
  operationMode: "all" | "direct" | "hotel_linked_external" | "hotel_own_product";
  query: string;
  agentUserId: string;
  page: number;
  pageSize: number;
  selectedEntityId: string | null;
  historyStatus: string;
  historyProductId: string;
  historyPage: number;
  historyPageSize: number;
}

export interface BusinessPerformancePeriodBounds {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  label: string;
}

export interface ReservationPerformanceEvent {
  reservationId: string;
  entityId: string;
  entityType: BusinessEntityType;
  agentUserId: string | null;
  status: string | null;
  flowType:
    | "direct"
    | "hotel_linked_external"
    | "hotel_own_product"
    | "standard"
    | "hotel_link_external";
  effectiveAt: string | null;
  refundAt: string | null;
  grossCents: number;
  refundCents: number;
  attendiProfitCents: number;
  ownerEarningsCents: number;
  hotelEarningsCents: number;
  customerPaidCents: number;
  hasCashMovement: boolean;
  isEstimated: boolean;
}

export interface AggregatedPerformanceCents {
  gmvCents: number;
  attendiProfitCents: number;
  ownerEarningsCents: number;
  hotelEarningsCents: number;
  refundsCents: number;
  customerPaidCents: number;
  operations: number;
  operationsWithCashMovement: number;
  paidOperations: number;
  refundedOperations: number;
  cancelledOperations: number;
  averageTicketCents: number;
}

export interface MonthlyPerformancePoint {
  key: string;
  label: string;
  metrics: AggregatedPerformanceCents;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_LOOKBACK_YEARS = 4;

const CANCELLED_STATUS_MARKERS = ["cancel", "reject", "expired"];
const REFUND_STATUS_MARKERS = ["refund", "partially_refund", "partial_refund"];

function toInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = toInteger(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
}

function toMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric"
  }).format(date);
}

export function normalizeBusinessEntityTypeFilter(value?: string | null): BusinessEntityTypeFilter {
  const normalized = String(value ?? "all").toLowerCase();

  if (normalized === "business" || normalized === "hotel") {
    return normalized;
  }

  return "all";
}

export function normalizeBusinessPerformanceFilters(
  input: Partial<{
    year: string | number;
    month: string | number;
    dateFrom: string;
    dateTo: string;
    entityType: string;
    status: string;
    hotelLink: string;
    operationMode: string;
    query: string;
    agentUserId: string;
    page: string | number;
    pageSize: string | number;
    entity: string;
    historyStatus: string;
    historyProduct: string;
    historyPage: string | number;
    historyPageSize: string | number;
  }>,
  now = new Date()
): BusinessPerformanceFilters {
  const nowYear = now.getUTCFullYear();
  const minYear = nowYear - DEFAULT_LOOKBACK_YEARS;
  const maxYear = nowYear + 1;

  const rawYear = toInteger(input.year);
  const year = rawYear !== null && rawYear >= minYear && rawYear <= maxYear ? rawYear : nowYear;

  const rawMonth = toInteger(input.month);
  const month = rawMonth !== null && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : null;

  const rawPage = toInteger(input.page);
  const page = rawPage !== null && rawPage > 0 ? rawPage : 1;

  const rawPageSize = toInteger(input.pageSize);
  const pageSize =
    rawPageSize !== null && rawPageSize > 0 ? Math.min(rawPageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const operationMode = (() => {
    const normalized = String(input.operationMode ?? input.hotelLink ?? "all").trim().toLowerCase();
    if (normalized === "direct" || normalized === "hotel_linked_external" || normalized === "hotel_own_product") {
      return normalized;
    }

    if (normalized === "with_hotel_link") {
      return "hotel_linked_external";
    }

    if (normalized === "without_hotel_link") {
      return "direct";
    }

    return "all";
  })();

  return {
    year,
    month,
    dateFrom: String(input.dateFrom ?? "").trim() || null,
    dateTo: String(input.dateTo ?? "").trim() || null,
    entityType: normalizeBusinessEntityTypeFilter(input.entityType),
    operationStatus: String(input.status ?? "").trim().toLowerCase(),
    operationMode,
    query: String(input.query ?? "").trim(),
    agentUserId: String(input.agentUserId ?? "").trim(),
    page,
    pageSize,
    selectedEntityId: String(input.entity ?? "").trim() || null,
    historyStatus: String(input.historyStatus ?? "").trim().toLowerCase(),
    historyProductId: String(input.historyProduct ?? "").trim(),
    historyPage: toPositiveInteger(input.historyPage, 1),
    historyPageSize: Math.min(toPositiveInteger(input.historyPageSize, 15), 5000)
  };
}

export function buildPeriodBounds(year: number, month: number | null): BusinessPerformancePeriodBounds {
  const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getUTCFullYear();

  if (month && month >= 1 && month <= 12) {
    const start = new Date(Date.UTC(safeYear, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(safeYear, month, 1, 0, 0, 0, 0));

    return {
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: toMonthLabel(start)
    };
  }

  const start = new Date(Date.UTC(safeYear, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(safeYear + 1, 0, 1, 0, 0, 0, 0));

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: String(safeYear)
  };
}

export function buildMonthWindow(endExclusive: Date, months: number) {
  const end = new Date(Date.UTC(endExclusive.getUTCFullYear(), endExclusive.getUTCMonth(), 1, 0, 0, 0, 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - Math.max(1, months), 1, 0, 0, 0, 0));

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function formatCentsToEuros(cents: number) {
  return cents / 100;
}

export function toEuroCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

export function calculateCommissionCents(baseCents: number, percentage: number) {
  if (!Number.isFinite(baseCents) || !Number.isFinite(percentage)) {
    return 0;
  }

  if (percentage <= 0 || baseCents <= 0) {
    return 0;
  }

  return Math.round(baseCents * (percentage / 100));
}

function isInRange(value: string | null, start: Date, end: Date) {
  if (!value) {
    return false;
  }

  const instant = new Date(value);
  const epoch = instant.getTime();

  if (Number.isNaN(epoch)) {
    return false;
  }

  return epoch >= start.getTime() && epoch < end.getTime();
}

function includesAnyMarker(value: string | null, markers: string[]) {
  const normalized = String(value ?? "").toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

function classifyReservationStatus(status: string | null, hasRefund: boolean) {
  if (includesAnyMarker(status, CANCELLED_STATUS_MARKERS)) {
    return "cancelled";
  }

  if (hasRefund || includesAnyMarker(status, REFUND_STATUS_MARKERS)) {
    return "refunded";
  }

  return "paid";
}

function createZeroAggregated(): AggregatedPerformanceCents {
  return {
    gmvCents: 0,
    attendiProfitCents: 0,
    ownerEarningsCents: 0,
    hotelEarningsCents: 0,
    refundsCents: 0,
    customerPaidCents: 0,
    operations: 0,
    operationsWithCashMovement: 0,
    paidOperations: 0,
    refundedOperations: 0,
    cancelledOperations: 0,
    averageTicketCents: 0
  };
}

function finalizeAverage(metrics: AggregatedPerformanceCents) {
  if (metrics.operations <= 0) {
    metrics.averageTicketCents = 0;
    return metrics;
  }

  metrics.averageTicketCents = Math.round(metrics.gmvCents / metrics.operations);
  return metrics;
}

function mergeAggregated(target: AggregatedPerformanceCents, source: AggregatedPerformanceCents) {
  target.gmvCents += source.gmvCents;
  target.attendiProfitCents += source.attendiProfitCents;
  target.ownerEarningsCents += source.ownerEarningsCents;
  target.hotelEarningsCents += source.hotelEarningsCents;
  target.refundsCents += source.refundsCents;
  target.customerPaidCents += source.customerPaidCents;
  target.operations += source.operations;
  target.operationsWithCashMovement += source.operationsWithCashMovement;
  target.paidOperations += source.paidOperations;
  target.refundedOperations += source.refundedOperations;
  target.cancelledOperations += source.cancelledOperations;
  return target;
}

function matchesEventScope(
  event: ReservationPerformanceEvent,
  entityTypeFilter: BusinessEntityTypeFilter,
  agentUserIdFilter: string
) {
  if (entityTypeFilter !== "all" && event.entityType !== entityTypeFilter) {
    return false;
  }

  if (agentUserIdFilter && event.agentUserId !== agentUserIdFilter) {
    return false;
  }

  return true;
}

export function aggregateEventsForPeriod(
  events: ReservationPerformanceEvent[],
  period: BusinessPerformancePeriodBounds,
  scope: {
    entityType: BusinessEntityTypeFilter;
    agentUserId: string;
  }
): AggregatedPerformanceCents {
  const metrics = createZeroAggregated();

  events.forEach((event) => {
    if (!matchesEventScope(event, scope.entityType, scope.agentUserId)) {
      return;
    }

    const inGrossPeriod = isInRange(event.effectiveAt, period.start, period.end);
    const inRefundPeriod = event.refundCents > 0 && isInRange(event.refundAt ?? event.effectiveAt, period.start, period.end);

    if (inGrossPeriod) {
      metrics.operations += 1;
      if (event.hasCashMovement) {
        metrics.operationsWithCashMovement += 1;
      }

      const statusGroup = classifyReservationStatus(event.status, event.refundCents > 0);
      if (statusGroup === "cancelled") metrics.cancelledOperations += 1;
      if (statusGroup === "refunded") metrics.refundedOperations += 1;
      if (statusGroup === "paid") metrics.paidOperations += 1;

      metrics.gmvCents += Math.max(0, event.grossCents);
      metrics.attendiProfitCents += event.attendiProfitCents;
      metrics.ownerEarningsCents += event.ownerEarningsCents;
      metrics.hotelEarningsCents += event.hotelEarningsCents;
      metrics.customerPaidCents += Math.max(0, event.customerPaidCents);
    }

    if (inRefundPeriod) {
      metrics.gmvCents -= Math.max(0, event.refundCents);
      metrics.refundsCents += Math.max(0, event.refundCents);
    }
  });

  return finalizeAverage(metrics);
}

function monthKeyFromDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function aggregateEventsByMonth(
  events: ReservationPerformanceEvent[],
  endExclusive: Date,
  months: number,
  scope: {
    entityType: BusinessEntityTypeFilter;
    agentUserId: string;
  }
): MonthlyPerformancePoint[] {
  const window = buildMonthWindow(endExclusive, months);
  const buckets = new Map<string, MonthlyPerformancePoint>();

  for (let index = 0; index < months; index += 1) {
    const current = new Date(Date.UTC(window.start.getUTCFullYear(), window.start.getUTCMonth() + index, 1, 0, 0, 0, 0));
    const key = monthKeyFromDate(current);
    buckets.set(key, {
      key,
      label: toMonthLabel(current),
      metrics: createZeroAggregated()
    });
  }

  events.forEach((event) => {
    if (!matchesEventScope(event, scope.entityType, scope.agentUserId)) {
      return;
    }

    if (event.effectiveAt) {
      const effective = new Date(event.effectiveAt);
      if (!Number.isNaN(effective.getTime())) {
        const key = monthKeyFromDate(effective);
        const bucket = buckets.get(key);

        if (bucket) {
          bucket.metrics.operations += 1;
          if (event.hasCashMovement) {
            bucket.metrics.operationsWithCashMovement += 1;
          }

          const statusGroup = classifyReservationStatus(event.status, event.refundCents > 0);
          if (statusGroup === "cancelled") bucket.metrics.cancelledOperations += 1;
          if (statusGroup === "refunded") bucket.metrics.refundedOperations += 1;
          if (statusGroup === "paid") bucket.metrics.paidOperations += 1;

          bucket.metrics.gmvCents += Math.max(0, event.grossCents);
          bucket.metrics.attendiProfitCents += event.attendiProfitCents;
          bucket.metrics.ownerEarningsCents += event.ownerEarningsCents;
          bucket.metrics.hotelEarningsCents += event.hotelEarningsCents;
          bucket.metrics.customerPaidCents += Math.max(0, event.customerPaidCents);
        }
      }
    }

    const refundDateValue = event.refundAt ?? event.effectiveAt;
    if (event.refundCents > 0 && refundDateValue) {
      const refundDate = new Date(refundDateValue);
      if (!Number.isNaN(refundDate.getTime())) {
        const key = monthKeyFromDate(refundDate);
        const bucket = buckets.get(key);

        if (bucket) {
          bucket.metrics.gmvCents -= Math.max(0, event.refundCents);
          bucket.metrics.refundsCents += Math.max(0, event.refundCents);
        }
      }
    }
  });

  const points = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  points.forEach((point) => finalizeAverage(point.metrics));
  return points;
}

export function aggregateTotals(points: Array<{ metrics: AggregatedPerformanceCents }>) {
  const total = createZeroAggregated();
  points.forEach((point) => mergeAggregated(total, point.metrics));
  return finalizeAverage(total);
}

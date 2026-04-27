import {
  aggregateEventsByMonth,
  aggregateEventsForPeriod,
  buildMonthWindow,
  buildPeriodBounds,
  formatCentsToEuros,
  normalizeBusinessPerformanceFilters,
  type AggregatedPerformanceCents,
  type BusinessPerformancePeriodBounds,
  type ReservationPerformanceEvent
} from "@/lib/business-performance";
import { computeBusinessPerformanceLedgerMath } from "@/lib/business-performance-ledger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { getProfilesMap } from "@/services/profile-helpers";
import type {
  BusinessEntityType,
  BusinessPerformanceAgentOption,
  BusinessPerformanceAmountSource,
  BusinessPerformanceEntityDetail,
  BusinessPerformanceEntityRow,
  BusinessPerformanceFlowType,
  BusinessPerformanceLedgerRow,
  BusinessPerformanceLedgerStatus,
  BusinessPerformanceMetrics,
  BusinessPerformanceMonthlyPoint
} from "@/types";

interface RawEntityRow {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_photo_url: string | null;
  account_type: BusinessEntityType;
  stripe_account_id: string | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  stripe_transfers_enabled: boolean | null;
  comision_propietario: number | string | null;
  latitude: number | null;
  longitude: number | null;
  precise_location: string | null;
}

interface AgentAssignmentRow {
  entity_user_id: string;
  agent_user_id: string;
  active: boolean;
  updated_at: string | null;
  created_at: string | null;
}

interface LedgerViewRow {
  reservation_id: string;
  product_id: string | null;
  owner_user_id: string | null;
  owner_account_type: string | null;
  linked_hotel_id: string | null;
  buyer_user_id: string | null;
  status: string | null;
  rental_type: string | null;
  payment_captured: boolean | null;
  payment_bypassed: boolean | null;
  payment_intent_id: string | null;
  charge_id: string | null;
  balance_transaction_id: string | null;
  currency: string | null;
  effective_at: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customer_paid_cents: number | null;
  refunded_cents: number | null;
  owner_earnings_cents: number | null;
  hotel_earnings_cents: number | null;
  attendi_before_stripe_cents: number | null;
  stripe_fee_cents: number | null;
  attendi_net_cents: number | null;
  fee_estimated: boolean | null;
  operation_mode: string | null;
}

interface ProductTitleRow {
  id: string;
  title: string | null;
}

interface QueryInput {
  year?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  entityType?: string;
  status?: string;
  operationMode?: string;
  hotelLink?: string;
  q?: string;
  agent?: string;
  entity?: string;
  historyStatus?: string;
  historyProduct?: string;
  historyPage?: string;
  historyPageSize?: string;
}

interface LedgerRowInternal extends BusinessPerformanceLedgerRow {
  entityId: string;
  entityType: BusinessEntityType;
}

export interface BusinessPerformancePageData {
  filters: ReturnType<typeof normalizeBusinessPerformanceFilters>;
  periodLabel: string;
  totalEntities: number;
  kpis: BusinessPerformanceMetrics;
  entities: BusinessPerformanceEntityRow[];
  selectedEntityId: string | null;
  selectedEntityDetail: BusinessPerformanceEntityDetail | null;
  agentOptions: BusinessPerformanceAgentOption[];
  notes: string[];
}

const MAX_KPI_ENTITY_SCOPE = 2000;
const LEDGER_ENTITY_CHUNK_SIZE = 150;

type OperationModeFilter = "all" | "direct" | "hotel_linked_external" | "hotel_own_product";
type OperationMode = "direct" | "hotel_linked_external" | "hotel_own_product";

function sanitizeSearchQuery(value: string) {
  return value.replace(/[,()]/g, " ").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function chunkArray<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function isSupabaseRecoverableError(error: { code?: string; message?: string } | null) {
  return isMissingDatabaseObject(error as never) || isPermissionError(error as never);
}

function maxIsoDate(leftIso: string, rightIso: string | null) {
  if (!rightIso) {
    return leftIso;
  }

  const leftEpoch = new Date(leftIso).getTime();
  const rightEpoch = new Date(rightIso).getTime();

  if (Number.isNaN(leftEpoch)) {
    return Number.isNaN(rightEpoch) ? leftIso : rightIso;
  }

  if (Number.isNaN(rightEpoch)) {
    return leftIso;
  }

  return rightEpoch > leftEpoch ? new Date(rightEpoch).toISOString() : leftIso;
}

function mapMetricsCentsToEuros(metrics: AggregatedPerformanceCents): BusinessPerformanceMetrics {
  return {
    gmv: Number(formatCentsToEuros(metrics.gmvCents).toFixed(2)),
    attendiNet: Number(formatCentsToEuros(metrics.attendiProfitCents).toFixed(2)),
    attendiProfit: Number(formatCentsToEuros(metrics.attendiProfitCents).toFixed(2)),
    ownerEarnings: Number(formatCentsToEuros(metrics.ownerEarningsCents).toFixed(2)),
    hotelEarnings: Number(formatCentsToEuros(metrics.hotelEarningsCents).toFixed(2)),
    refunds: Number(formatCentsToEuros(metrics.refundsCents).toFixed(2)),
    customerPaid: Number(formatCentsToEuros(metrics.customerPaidCents).toFixed(2)),
    operations: metrics.operations,
    operationsWithCashMovement: metrics.operationsWithCashMovement,
    paidOperations: metrics.paidOperations,
    refundedOperations: metrics.refundedOperations,
    cancelledOperations: metrics.cancelledOperations,
    averageTicket: Number(formatCentsToEuros(metrics.averageTicketCents).toFixed(2))
  };
}

function mapMonthlyPoints(points: ReturnType<typeof aggregateEventsByMonth>): BusinessPerformanceMonthlyPoint[] {
  return points.map((point) => ({
    key: point.key,
    label: point.label,
    metrics: mapMetricsCentsToEuros(point.metrics)
  }));
}

function getEntityDisplayName(entity: RawEntityRow) {
  return toOptionalText(entity.full_name) ?? toOptionalText(entity.username) ?? entity.id;
}

function isInRange(value: string | null, start: Date, end: Date) {
  if (!value) {
    return false;
  }

  const epoch = new Date(value).getTime();
  if (Number.isNaN(epoch)) {
    return false;
  }

  return epoch >= start.getTime() && epoch < end.getTime();
}

function toPeriodFromWindow(window: { start: Date; end: Date; startIso: string; endIso: string }, label: string): BusinessPerformancePeriodBounds {
  return {
    start: window.start,
    end: window.end,
    startIso: window.startIso,
    endIso: window.endIso,
    label
  };
}

function resolvePeriod(filters: ReturnType<typeof normalizeBusinessPerformanceFilters>) {
  if (!filters.dateFrom && !filters.dateTo) {
    return buildPeriodBounds(filters.year, filters.month);
  }

  const fallback = buildPeriodBounds(filters.year, filters.month);
  const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null;
  const to = filters.dateTo ? new Date(`${filters.dateTo}T00:00:00.000Z`) : null;

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return fallback;
  }

  const start = from ?? fallback.start;
  const endBase = to ?? fallback.end;
  const end = new Date(endBase.getTime());
  if (to) {
    end.setUTCDate(end.getUTCDate() + 1);
  }

  if (end.getTime() <= start.getTime()) {
    return fallback;
  }

  const dateLabel = `${start.toISOString().slice(0, 10)} -> ${new Date(end.getTime() - 1).toISOString().slice(0, 10)}`;

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: dateLabel
  };
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

type EntityFilterStatement<T> = {
  eq: (column: string, value: unknown) => T;
  in: (column: string, values: unknown[]) => T;
};

function applyEntityFilters<T extends EntityFilterStatement<T>>(
  statement: T,
  filters: ReturnType<typeof normalizeBusinessPerformanceFilters>,
  entityScopeIds: string[] | null
) {
  let scoped = statement.in("account_type", ["business", "hotel"]);

  if (filters.entityType !== "all") {
    scoped = scoped.eq("account_type", filters.entityType);
  }

  if (entityScopeIds) {
    scoped = scoped.in("id", entityScopeIds);
  }

  return scoped;
}

function buildEntityScopeFilter(
  filters: ReturnType<typeof normalizeBusinessPerformanceFilters>,
  entityIdsByAgent: string[] | null
) {
  if (filters.agentUserId && entityIdsByAgent && entityIdsByAgent.length === 0) {
    return {
      shortCircuit: true,
      ids: [] as string[]
    };
  }

  return {
    shortCircuit: false,
    ids: entityIdsByAgent
  };
}

function normalizeOperationMode(value: unknown): OperationModeFilter {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "direct" || normalized === "hotel_linked_external" || normalized === "hotel_own_product") {
    return normalized;
  }

  return "all";
}

function mapOperationModeToFlow(value: unknown): OperationMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "hotel_linked_external") {
    return "hotel_linked_external";
  }

  if (normalized === "hotel_own_product") {
    return "hotel_own_product";
  }

  return "direct";
}

async function listAgentOptions() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("commission_agent_entity_assignments")
    .select("agent_user_id,entity_user_id,active")
    .eq("active", true);

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return [] as BusinessPerformanceAgentOption[];
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ agent_user_id: string; entity_user_id: string; active: boolean }>;
  const countByAgent = new Map<string, number>();

  rows.forEach((row) => {
    countByAgent.set(row.agent_user_id, (countByAgent.get(row.agent_user_id) ?? 0) + 1);
  });

  const profiles = await getProfilesMap(Array.from(countByAgent.keys()));

  return Array.from(countByAgent.entries())
    .map(([userId, activeEntities]) => {
      const profile = profiles.get(userId);
      const name = profile?.full_name ?? profile?.username ?? userId;

      return {
        userId,
        name,
        activeEntities
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listEntityIdsForAgent(agentUserId: string) {
  if (!agentUserId) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("commission_agent_entity_assignments")
    .select("entity_user_id,active")
    .eq("agent_user_id", agentUserId)
    .eq("active", true);

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return [] as string[];
    }

    throw new Error(error.message);
  }

  return Array.from(new Set(((data ?? []) as Array<{ entity_user_id: string }>).map((row) => row.entity_user_id).filter(Boolean)));
}

async function getBusinessPerformanceCutoverIso() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("analytics_cutover")
    .select("business_performance_from")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  const value = toOptionalText((data as { business_performance_from?: string | null } | null)?.business_performance_from);
  if (!value) {
    return null;
  }

  const epoch = new Date(value).getTime();
  if (Number.isNaN(epoch)) {
    return null;
  }

  return new Date(epoch).toISOString();
}

async function fetchActiveAssignmentsByEntity(entityIds: string[]) {
  const map = new Map<string, string>();

  if (!entityIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("commission_agent_entity_assignments")
    .select("entity_user_id,agent_user_id,active,updated_at,created_at")
    .in("entity_user_id", entityIds)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return map;
    }

    throw new Error(error.message);
  }

  ((data ?? []) as AgentAssignmentRow[]).forEach((row) => {
    if (!map.has(row.entity_user_id)) {
      map.set(row.entity_user_id, row.agent_user_id);
    }
  });

  return map;
}

async function fetchEntityEmailMap(entityIds: string[]) {
  const map = new Map<string, string>();

  if (!entityIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("business_details")
    .select("user_id,email")
    .in("user_id", entityIds);

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return map;
    }

    throw new Error(error.message);
  }

  ((data ?? []) as Array<{ user_id: string; email: string | null }>).forEach((row) => {
    const email = toOptionalText(row.email);
    if (row.user_id && email) {
      map.set(row.user_id, email);
    }
  });

  return map;
}

async function fetchProductTitles(productIds: string[]) {
  const map = new Map<string, string>();

  if (!productIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();
  const chunks = chunkArray(productIds, 300);

  for (const chunk of chunks) {
    const { data, error } = await supabase.from("products").select("id,title").in("id", chunk);

    if (error) {
      if (isSupabaseRecoverableError(error)) {
        continue;
      }

      throw new Error(error.message);
    }

    ((data ?? []) as ProductTitleRow[]).forEach((row) => {
      const title = toOptionalText(row.title);
      if (title) {
        map.set(row.id, title);
      }
    });
  }

  return map;
}

function mapViewRowToEntity(row: LedgerViewRow) {
  const operationMode = mapOperationModeToFlow(row.operation_mode);

  if (operationMode === "hotel_linked_external" && row.linked_hotel_id) {
    return {
      entityId: row.linked_hotel_id,
      entityType: "hotel" as BusinessEntityType,
      operationMode
    };
  }

  const ownerType = String(row.owner_account_type ?? "").toLowerCase() === "hotel" ? "hotel" : "business";

  return {
    entityId: row.owner_user_id,
    entityType: ownerType as BusinessEntityType,
    operationMode
  };
}

function mapLedgerStatus(feeEstimated: boolean): BusinessPerformanceLedgerStatus {
  return feeEstimated ? "estimated" : "reconciled";
}

async function fetchLedgerRowsFromView(args: {
  entityIds: string[];
  startIso: string;
  endIso: string;
  filters: ReturnType<typeof normalizeBusinessPerformanceFilters>;
}) {
  if (!args.entityIds.length) {
    return [] as LedgerRowInternal[];
  }

  const supabase = createSupabaseServerClient();
  const byEntityReservation = new Map<string, LedgerRowInternal>();

  const selectColumns = [
    "reservation_id",
    "product_id",
    "owner_user_id",
    "owner_account_type",
    "linked_hotel_id",
    "buyer_user_id",
    "status",
    "rental_type",
    "payment_captured",
    "payment_bypassed",
    "payment_intent_id",
    "charge_id",
    "balance_transaction_id",
    "currency",
    "effective_at",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
    "customer_paid_cents",
    "refunded_cents",
    "owner_earnings_cents",
    "hotel_earnings_cents",
    "attendi_before_stripe_cents",
    "stripe_fee_cents",
    "attendi_net_cents",
    "fee_estimated",
    "operation_mode"
  ].join(",");

  const operationMode = normalizeOperationMode(args.filters.operationMode);
  const chunks = chunkArray(args.entityIds, LEDGER_ENTITY_CHUNK_SIZE);

  async function runQueryByColumn(column: "owner_user_id" | "linked_hotel_id", ids: string[]) {
    const statement = supabase
      .from("v_business_performance_ledger")
      .select(selectColumns)
      .in(column, ids)
      .gte("effective_at", args.startIso)
      .lt("effective_at", args.endIso);

    if (args.filters.operationStatus) {
      statement.eq("status", args.filters.operationStatus);
    }

    if (operationMode !== "all") {
      statement.eq("operation_mode", operationMode);
    }

    const { data, error } = await statement;

    if (error) {
      if (isSupabaseRecoverableError(error)) {
        return;
      }

      throw new Error(error.message);
    }

    for (const row of (data ?? []) as unknown as LedgerViewRow[]) {
      const entity = mapViewRowToEntity(row);
      if (!entity.entityId || !args.entityIds.includes(entity.entityId)) {
        continue;
      }

      if (args.filters.entityType !== "all" && entity.entityType !== args.filters.entityType) {
        continue;
      }

      const feeEstimated = Boolean(row.fee_estimated);
      const reservationId = String(row.reservation_id);
      const key = `${entity.entityId}:${reservationId}`;

      const math = computeBusinessPerformanceLedgerMath({
        customerPaidCents: toNumber(row.customer_paid_cents, 0),
        refundedCents: toNumber(row.refunded_cents, 0),
        ownerEarningsCents: toNumber(row.owner_earnings_cents, 0),
        hotelEarningsCents: toNumber(row.hotel_earnings_cents, 0),
        stripeFeeCents: toNumber(row.stripe_fee_cents, 0),
        feeEstimated
      });

      const mapped: LedgerRowInternal = {
        entityId: entity.entityId,
        entityType: entity.entityType,
        reservationId,
        ownerUserId: row.owner_user_id,
        ownerType: row.owner_account_type,
        buyerUserId: row.buyer_user_id,
        linkedHotelId: row.linked_hotel_id,
        flowType: entity.operationMode,
        operationMode: entity.operationMode,
        feeSource: math.feeSource,
        productId: row.product_id,
        productTitle: null,
        createdAt: row.effective_at,
        startDate: row.start_date,
        endDate: row.end_date,
        effectiveAt: row.effective_at,
        effectiveAtMonth: row.effective_at ? row.effective_at.slice(0, 7) + "-01T00:00:00.000Z" : null,
        status: row.status,
        pBaseCents: 0,
        insuranceCents: 0,
        cclCents: 0,
        grossCustomerCents: math.customerPaidCents,
        refundedCustomerCents: math.refundedCents,
        retainedBaseCents: 0,
        ownerAmountCents: math.ownerEarningsCents,
        ownerAmountSource: "persisted" as BusinessPerformanceAmountSource,
        hotelAmountCents: math.hotelEarningsCents,
        attendiAmountBeforeStripeCents: math.attendiBeforeStripeCents,
        stripeFeeCents: math.stripeFeeCents,
        attendiNetCents: math.attendiNetCents,
        cpPctEffective: null,
        cePPctEffective: null,
        chPctEffective: null,
        kHotelEffective: null,
        retentionPctEffective: null,
        isEstimated: math.feeEstimated,
        estimationReason: feeEstimated ? "Stripe fee not reconciled yet; fee is estimated from reservation cache or zero." : null,
        ledgerStatus: mapLedgerStatus(math.feeEstimated)
      };

      byEntityReservation.set(key, mapped);
    }
  }

  for (const chunk of chunks) {
    await runQueryByColumn("owner_user_id", chunk);
    await runQueryByColumn("linked_hotel_id", chunk);
  }

  const rows = Array.from(byEntityReservation.values());
  const productTitleMap = await fetchProductTitles(
    Array.from(new Set(rows.map((row) => row.productId).filter((value): value is string => Boolean(value))))
  );

  rows.forEach((row) => {
    if (row.productId) {
      row.productTitle = productTitleMap.get(row.productId) ?? null;
    }
  });

  return rows;
}

function mapLedgerRowToEvent(row: LedgerRowInternal, agentUserId: string | null): ReservationPerformanceEvent {
  const hasCashMovement = row.grossCustomerCents > 0 || row.refundedCustomerCents > 0;

  return {
    reservationId: row.reservationId,
    entityId: row.entityId,
    entityType: row.entityType,
    agentUserId,
    status: row.status,
    flowType: row.flowType,
    effectiveAt: row.effectiveAt,
    refundAt: row.effectiveAt,
    grossCents: row.grossCustomerCents,
    refundCents: row.refundedCustomerCents,
    attendiProfitCents: row.attendiNetCents,
    ownerEarningsCents: row.ownerAmountCents,
    hotelEarningsCents: row.hotelAmountCents,
    customerPaidCents: row.grossCustomerCents,
    hasCashMovement,
    isEstimated: row.isEstimated
  };
}

function toPublicLedgerRow(row: LedgerRowInternal): BusinessPerformanceLedgerRow {
  return {
    reservationId: row.reservationId,
    ownerUserId: row.ownerUserId,
    ownerType: row.ownerType,
    buyerUserId: row.buyerUserId,
    linkedHotelId: row.linkedHotelId,
    flowType: row.flowType,
    operationMode: row.operationMode,
    feeSource: row.feeSource,
    productId: row.productId,
    productTitle: row.productTitle,
    createdAt: row.createdAt,
    startDate: row.startDate,
    endDate: row.endDate,
    effectiveAt: row.effectiveAt,
    effectiveAtMonth: row.effectiveAtMonth,
    status: row.status,
    pBaseCents: row.pBaseCents,
    insuranceCents: row.insuranceCents,
    cclCents: row.cclCents,
    grossCustomerCents: row.grossCustomerCents,
    refundedCustomerCents: row.refundedCustomerCents,
    retainedBaseCents: row.retainedBaseCents,
    ownerAmountCents: row.ownerAmountCents,
    ownerAmountSource: row.ownerAmountSource,
    hotelAmountCents: row.hotelAmountCents,
    attendiAmountBeforeStripeCents: row.attendiAmountBeforeStripeCents,
    stripeFeeCents: row.stripeFeeCents,
    attendiNetCents: row.attendiNetCents,
    cpPctEffective: row.cpPctEffective,
    cePPctEffective: row.cePPctEffective,
    chPctEffective: row.chPctEffective,
    kHotelEffective: row.kHotelEffective,
    retentionPctEffective: row.retentionPctEffective,
    isEstimated: row.isEstimated,
    estimationReason: row.estimationReason,
    ledgerStatus: row.ledgerStatus
  };
}

function getYearOptions(currentYear: number) {
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

function buildHistoryForEntity(args: {
  entityRows: LedgerRowInternal[];
  filters: ReturnType<typeof normalizeBusinessPerformanceFilters>;
  period: BusinessPerformancePeriodBounds;
}) {
  const periodRows = args.entityRows.filter((row) => isInRange(row.effectiveAt, args.period.start, args.period.end));

  const historyRows = periodRows.filter((row) => {
    if (args.filters.historyStatus) {
      const status = String(row.status ?? "").toLowerCase();
      if (status !== args.filters.historyStatus) {
        return false;
      }
    }

    if (args.filters.historyProductId && row.productId !== args.filters.historyProductId) {
      return false;
    }

    return true;
  });

  historyRows.sort((a, b) => {
    const aValue = new Date(a.effectiveAt ?? a.createdAt ?? "1970-01-01T00:00:00.000Z").getTime();
    const bValue = new Date(b.effectiveAt ?? b.createdAt ?? "1970-01-01T00:00:00.000Z").getTime();
    return bValue - aValue;
  });

  const total = historyRows.length;
  const page = Math.max(1, args.filters.historyPage);
  const pageSize = Math.max(1, args.filters.historyPageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  const productOptions = Array.from(
    new Map(
      periodRows
        .filter((row) => row.productId)
        .map((row) => [row.productId as string, row.productTitle ?? row.productId ?? "-"])
    )
      .entries()
  )
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    rows: historyRows.slice(from, to).map(toPublicLedgerRow),
    total,
    page,
    pageSize,
    productOptions,
    allRows: historyRows
  };
}

function mapInputToFilters(input: QueryInput) {
  return normalizeBusinessPerformanceFilters({
    year: input.year,
    month: input.month,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    entityType: input.entityType,
    status: input.status,
    operationMode: input.operationMode,
    hotelLink: input.hotelLink,
    query: input.q,
    agentUserId: input.agent,
    entity: input.entity,
    historyStatus: input.historyStatus,
    historyProduct: input.historyProduct,
    historyPage: input.historyPage,
    historyPageSize: input.historyPageSize
  });
}

export async function getBusinessPerformancePageData(input: QueryInput): Promise<BusinessPerformancePageData> {
  const filters = mapInputToFilters(input);
  const period = resolvePeriod(filters);

  const trendWindow = buildMonthWindow(period.end, 12);

  const notes: string[] = [];

  const [agentOptions, idsForAgent, cutoverIso] = await Promise.all([
    listAgentOptions(),
    listEntityIdsForAgent(filters.agentUserId),
    getBusinessPerformanceCutoverIso()
  ]);
  const entityScope = buildEntityScopeFilter(filters, idsForAgent);

  const trendStartIso = maxIsoDate(trendWindow.startIso, cutoverIso);

  if (entityScope.shortCircuit) {
    const zeroMetrics = mapMetricsCentsToEuros({
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
    });

    return {
      filters,
      periodLabel: period.label,
      totalEntities: 0,
      kpis: zeroMetrics,
      entities: [],
      selectedEntityId: null,
      selectedEntityDetail: null,
      agentOptions,
      notes: [
        "No entities match the selected commission-agent filter.",
        "Ledger source: public.v_business_performance_ledger"
      ]
    };
  }

  const supabase = createSupabaseServerClient();
  const entityQuery = applyEntityFilters(
    supabase
      .from("profiles")
      .select(
        "id,full_name,username,profile_photo_url,account_type,stripe_account_id,charges_enabled,payouts_enabled,stripe_transfers_enabled,comision_propietario,latitude,longitude,precise_location",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(0, Math.max(0, MAX_KPI_ENTITY_SCOPE - 1)),
    filters,
    entityScope.ids
  );

  const { data: rawRows, error: rawError, count } = await entityQuery;
  if (rawError) {
    throw new Error(rawError.message);
  }

  const unfilteredEntities = (rawRows ?? []) as RawEntityRow[];
  const loadedEntityIds = unfilteredEntities.map((row) => row.id);
  const emailMap = await fetchEntityEmailMap(loadedEntityIds);

  let scopedEntities = unfilteredEntities;
  if (filters.query) {
    const token = sanitizeSearchQuery(filters.query).toLowerCase();
    scopedEntities = unfilteredEntities.filter((entity) => {
      const name = getEntityDisplayName(entity).toLowerCase();
      const username = String(entity.username ?? "").toLowerCase();
      const email = String(emailMap.get(entity.id) ?? "").toLowerCase();
      return name.includes(token) || username.includes(token) || email.includes(token);
    });
  }

  const totalEntities = scopedEntities.length;

  if ((count ?? unfilteredEntities.length) > MAX_KPI_ENTITY_SCOPE) {
    notes.push(`Entity list and KPI aggregation are capped to ${MAX_KPI_ENTITY_SCOPE} entities for performance.`);
  }

  if (!totalEntities) {
    const zeroMetrics = mapMetricsCentsToEuros({
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
    });

    notes.push("Ledger source: public.v_business_performance_ledger");

    return {
      filters,
      periodLabel: period.label,
      totalEntities,
      kpis: zeroMetrics,
      entities: [],
      selectedEntityId: null,
      selectedEntityDetail: null,
      agentOptions,
      notes
    };
  }

  const scopedEntityIds = scopedEntities.map((row) => row.id);
  const assignmentsByEntity = await fetchActiveAssignmentsByEntity(scopedEntityIds);
  const assignedAgentIds = Array.from(new Set(Array.from(assignmentsByEntity.values())));
  const assignedAgentProfiles = await getProfilesMap(assignedAgentIds);

  const ledgerRows = await fetchLedgerRowsFromView({
    entityIds: scopedEntityIds,
    startIso: trendStartIso,
    endIso: period.endIso,
    filters
  });

  const eventsByEntity = new Map<string, ReservationPerformanceEvent[]>();
  ledgerRows.forEach((row) => {
    const event = mapLedgerRowToEvent(row, assignmentsByEntity.get(row.entityId) ?? null);
    const existing = eventsByEntity.get(row.entityId) ?? [];
    existing.push(event);
    eventsByEntity.set(row.entityId, existing);
  });

  const events = ledgerRows.map((row) => mapLedgerRowToEvent(row, assignmentsByEntity.get(row.entityId) ?? null));

  const entityRows: BusinessPerformanceEntityRow[] = scopedEntities.map((entity) => {
    const entityEvents = eventsByEntity.get(entity.id) ?? [];
    const periodMetrics = aggregateEventsForPeriod(entityEvents, period, {
      entityType: "all",
      agentUserId: ""
    });

    const trendPoints = aggregateEventsByMonth(entityEvents, period.end, 3, {
      entityType: "all",
      agentUserId: ""
    });

    const trailing3Window = buildMonthWindow(period.end, 3);
    const trailing6Window = buildMonthWindow(period.end, 6);
    const trailing12Window = buildMonthWindow(period.end, 12);

    const trailing3 = aggregateEventsForPeriod(entityEvents, toPeriodFromWindow(trailing3Window, "Last 3 months"), {
      entityType: "all",
      agentUserId: ""
    });
    const trailing6 = aggregateEventsForPeriod(entityEvents, toPeriodFromWindow(trailing6Window, "Last 6 months"), {
      entityType: "all",
      agentUserId: ""
    });
    const trailing12 = aggregateEventsForPeriod(entityEvents, toPeriodFromWindow(trailing12Window, "Last 12 months"), {
      entityType: "all",
      agentUserId: ""
    });

    const agentUserId = assignmentsByEntity.get(entity.id) ?? null;
    const agentProfile = agentUserId ? assignedAgentProfiles.get(agentUserId) : undefined;

    return {
      id: entity.id,
      name: getEntityDisplayName(entity),
      username: toOptionalText(entity.username),
      profilePhotoUrl: toOptionalText(entity.profile_photo_url),
      email: toOptionalText(emailMap.get(entity.id)) ?? toOptionalText(entity.username),
      entityType: entity.account_type,
      stripeAccountId: toOptionalText(entity.stripe_account_id),
      chargesEnabled: toBoolean(entity.charges_enabled, false),
      payoutsEnabled: toBoolean(entity.payouts_enabled, false),
      stripeTransfersEnabled: toBoolean(entity.stripe_transfers_enabled, false),
      standardOwnerCommissionPct: Number(toNumber(entity.comision_propietario, 12.5).toFixed(2)),
      latitude: entity.latitude,
      longitude: entity.longitude,
      preciseLocation: toOptionalText(entity.precise_location),
      assignedAgentUserId: agentUserId,
      assignedAgentName: agentProfile?.full_name ?? agentProfile?.username ?? agentUserId,
      periodMetrics: mapMetricsCentsToEuros(periodMetrics),
      trailingMetrics: {
        last3Months: mapMetricsCentsToEuros(trailing3),
        last6Months: mapMetricsCentsToEuros(trailing6),
        last12Months: mapMetricsCentsToEuros(trailing12)
      },
      lastThreeMonthsGmv: trendPoints.map((point) => Number(formatCentsToEuros(point.metrics.gmvCents).toFixed(2)))
    };
  });

  const kpiMetrics = aggregateEventsForPeriod(events, period, {
    entityType: "all",
    agentUserId: ""
  });

  const selectedEntityId = (() => {
    if (filters.selectedEntityId && scopedEntities.some((entity) => entity.id === filters.selectedEntityId)) {
      return filters.selectedEntityId;
    }

    if (entityRows.length) {
      return entityRows[0].id;
    }

    return null;
  })();

  const selectedEntityRaw = selectedEntityId
    ? scopedEntities.find((entity) => entity.id === selectedEntityId) ?? null
    : null;

  const selectedEntityDetail: BusinessPerformanceEntityDetail | null = (() => {
    if (!selectedEntityRaw || !selectedEntityId) {
      return null;
    }

    const entityEvents = eventsByEntity.get(selectedEntityId) ?? [];
    const monthlySeries = mapMonthlyPoints(
      aggregateEventsByMonth(entityEvents, period.end, 12, {
        entityType: "all",
        agentUserId: ""
      })
    );

    const historyForEntity = buildHistoryForEntity({
      entityRows: ledgerRows.filter((row) => row.entityId === selectedEntityId),
      filters,
      period
    });

    const selectedAgentUserId = assignmentsByEntity.get(selectedEntityId) ?? null;
    const selectedAgentProfile = selectedAgentUserId ? assignedAgentProfiles.get(selectedAgentUserId) : undefined;

    return {
      id: selectedEntityId,
      name: getEntityDisplayName(selectedEntityRaw),
      username: toOptionalText(selectedEntityRaw.username),
      email: toOptionalText(emailMap.get(selectedEntityId)) ?? toOptionalText(selectedEntityRaw.username),
      entityType: selectedEntityRaw.account_type,
      stripeAccountId: toOptionalText(selectedEntityRaw.stripe_account_id),
      chargesEnabled: toBoolean(selectedEntityRaw.charges_enabled, false),
      payoutsEnabled: toBoolean(selectedEntityRaw.payouts_enabled, false),
      stripeTransfersEnabled: toBoolean(selectedEntityRaw.stripe_transfers_enabled, false),
      standardOwnerCommissionPct: Number(toNumber(selectedEntityRaw.comision_propietario, 12.5).toFixed(2)),
      latitude: selectedEntityRaw.latitude,
      longitude: selectedEntityRaw.longitude,
      preciseLocation: toOptionalText(selectedEntityRaw.precise_location),
      assignedAgentUserId: selectedAgentUserId,
      assignedAgentName: selectedAgentProfile?.full_name ?? selectedAgentProfile?.username ?? selectedAgentUserId,
      periodMetrics: mapMetricsCentsToEuros(
        aggregateEventsForPeriod(entityEvents, period, {
          entityType: "all",
          agentUserId: ""
        })
      ),
      monthlySeries,
      history: {
        rows: historyForEntity.rows,
        total: historyForEntity.total,
        page: historyForEntity.page,
        pageSize: historyForEntity.pageSize
      },
      historyProductOptions: historyForEntity.productOptions
    };
  })();

  notes.push(
    "Ledger source: public.v_business_performance_ledger (canonical persisted amounts).",
    "Attendi before Stripe and Attendi net are read directly from ledger columns.",
    "fee_estimated=true only when Stripe reconciliation row is missing for that operation."
  );
  if (cutoverIso) {
    notes.push(`Cutover active from ${cutoverIso} (analytics_cutover.id=1).`);
  }

  return {
    filters,
    periodLabel: period.label,
    totalEntities,
    kpis: mapMetricsCentsToEuros(kpiMetrics),
    entities: entityRows,
    selectedEntityId,
    selectedEntityDetail,
    agentOptions,
    notes
  };
}

export async function getBusinessPerformanceKpis(input: QueryInput) {
  const data = await getBusinessPerformancePageData(input);
  return {
    periodLabel: data.periodLabel,
    filters: data.filters,
    kpis: data.kpis,
    totalEntities: data.totalEntities
  };
}

export async function getBusinessPerformanceEntities(input: QueryInput) {
  const data = await getBusinessPerformancePageData(input);
  return {
    periodLabel: data.periodLabel,
    filters: data.filters,
    totalEntities: data.totalEntities,
    entities: data.entities
  };
}

export async function getBusinessPerformanceEntityDetail(input: QueryInput & { entityId: string }) {
  const data = await getBusinessPerformancePageData({
    ...input,
    entity: input.entityId
  });

  return {
    periodLabel: data.periodLabel,
    filters: data.filters,
    entity: data.selectedEntityDetail
  };
}

export async function getBusinessPerformanceEntityOperations(input: QueryInput & { entityId: string }) {
  const data = await getBusinessPerformancePageData({
    ...input,
    entity: input.entityId
  });

  return {
    periodLabel: data.periodLabel,
    filters: data.filters,
    entityId: input.entityId,
    history: data.selectedEntityDetail?.history ?? {
      rows: [],
      total: 0,
      page: 1,
      pageSize: Math.max(1, Number(input.historyPageSize ?? 15) || 15)
    }
  };
}

export async function getBusinessPerformanceEntityHistoryCsv(
  input: QueryInput & { entityId: string }
): Promise<string> {
  const data = await getBusinessPerformancePageData({
    ...input,
    entity: input.entityId,
    historyPage: "1",
    historyPageSize: "5000"
  });

  const detail = data.selectedEntityDetail;
  if (!detail) {
    return "effective_at,reservation_id,customer_paid,refunded,owner,hotel,attendi_before_stripe,stripe_fee,attendi_net,fee_source,operation_mode,status,reconciliation\n";
  }

  const header = [
    "effective_at",
    "reservation_id",
    "customer_paid",
    "refunded",
    "owner",
    "hotel",
    "attendi_before_stripe",
    "stripe_fee",
    "attendi_net",
    "fee_source",
    "operation_mode",
    "status",
    "reconciliation"
  ];

  const lines = detail.history.rows.map((row) =>
    [
      row.effectiveAt ?? row.createdAt ?? "",
      row.reservationId,
      (row.grossCustomerCents / 100).toFixed(2),
      (row.refundedCustomerCents / 100).toFixed(2),
      (row.ownerAmountCents / 100).toFixed(2),
      (row.hotelAmountCents / 100).toFixed(2),
      (row.attendiAmountBeforeStripeCents / 100).toFixed(2),
      (row.stripeFeeCents / 100).toFixed(2),
      (row.attendiNetCents / 100).toFixed(2),
      row.feeSource,
      row.operationMode,
      row.status ?? "",
      row.ledgerStatus
    ]
      .map((value) => csvEscape(String(value ?? "")))
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

export function getBusinessPerformanceYearOptions(referenceDate = new Date()) {
  return getYearOptions(referenceDate.getUTCFullYear());
}

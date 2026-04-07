import {
  aggregateEventsByMonth,
  aggregateEventsForPeriod,
  buildMonthWindow,
  buildPeriodBounds,
  formatCentsToEuros,
  normalizeBusinessPerformanceFilters,
  type AggregatedPerformanceCents,
  type ReservationPerformanceEvent
} from "@/lib/business-performance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { getProfilesMap } from "@/services/profile-helpers";
import type {
  BusinessEntityType,
  BusinessEntityTypeFilter,
  BusinessPerformanceAgentOption,
  BusinessPerformanceEntityDetail,
  BusinessPerformanceEntityRow,
  BusinessPerformanceMetrics,
  BusinessPerformanceMonthlyPoint
} from "@/types";

interface RawEntityRow {
  id: string;
  full_name: string | null;
  username: string | null;
  account_type: BusinessEntityType;
  comision_propietario: number | null;
  comision_hotel: number | null;
  latitude: number | null;
  longitude: number | null;
  precise_location: string | null;
}

interface ProductOwnerRow {
  id: string;
  user_id: string | null;
}

interface ReservationRow {
  id: string;
  product_id: string | null;
  source_hotel_id: string | null;
  status: string | null;
  created_at: string | null;
  payment_authorized_at: string | null;
  refunded_at: string | null;
  rental_amount: number | null;
  addons_amount: number | null;
  insurance_amount: number | null;
  fee_amount: number | null;
  importe: number | null;
  refunded_amount: number | null;
  refund_status: string | null;
}

interface AgentAssignmentRow {
  entity_user_id: string;
  agent_user_id: string;
  active: boolean;
  updated_at: string | null;
  created_at: string | null;
}

interface CommissionSettingRow {
  id: number;
  k_hotel: number | null;
}

interface CommissionOverrideRow {
  hotel_id: string;
  company_id: string;
  ce_p_pct: number;
  active: boolean;
}

interface EntityCommissionMeta {
  accountType: BusinessEntityType;
  ownerPct: number;
  hotelPct: number;
}

interface QueryInput {
  year?: string;
  month?: string;
  entityType?: string;
  q?: string;
  agent?: string;
  entity?: string;
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
const RESERVATION_CHUNK_SIZE = 250;
const DEFAULT_K_HOTEL = 0.4;

function sanitizeSearchQuery(value: string) {
  return value.replace(/[,()]/g, " ").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toInteger(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function toOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function centsFromEuros(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100);
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

function mapMetricsCentsToEuros(metrics: AggregatedPerformanceCents): BusinessPerformanceMetrics {
  return {
    gmv: Number(formatCentsToEuros(metrics.gmvCents).toFixed(2)),
    attendiProfit: Number(formatCentsToEuros(metrics.attendiProfitCents).toFixed(2)),
    operations: metrics.operations,
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

function reservationGrossCents(row: ReservationRow) {
  const rental = toInteger(row.rental_amount);
  const addons = toInteger(row.addons_amount);
  const insurance = toInteger(row.insurance_amount);
  const legacyImporte = centsFromEuros(row.importe);

  if (rental !== null || addons !== null || insurance !== null) {
    return Math.max(0, (rental ?? 0) + (addons ?? 0) + (insurance ?? 0));
  }

  return Math.max(0, legacyImporte ?? 0);
}

function reservationRefundCents(row: ReservationRow, grossCents: number) {
  const explicitRefund = toInteger(row.refunded_amount);
  if (explicitRefund !== null && explicitRefund > 0) {
    return explicitRefund;
  }

  const statusText = String(row.status ?? "").toLowerCase();
  const refundStatusText = String(row.refund_status ?? "").toLowerCase();
  const inferredRefunded =
    refundStatusText.includes("refund") ||
    statusText.includes("refund") ||
    statusText.includes("cancel") ||
    statusText.includes("rejected");

  return inferredRefunded ? Math.max(0, grossCents) : 0;
}

function getEntityDisplayName(entity: RawEntityRow) {
  return toOptionalText(entity.full_name) ?? toOptionalText(entity.username) ?? entity.id;
}

function getEntityCommissionMeta(entity: RawEntityRow): EntityCommissionMeta {
  return {
    accountType: entity.account_type,
    ownerPct: Math.max(0, toNumber(entity.comision_propietario, 10)),
    hotelPct: Math.max(0, toNumber(entity.comision_hotel, 10))
  };
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

function resolveOwnerCommissionPct(
  owner: EntityCommissionMeta | null,
  fallbackEntity: EntityCommissionMeta,
  sourceHotelId: string | null,
  ownerId: string | null,
  overrideMap: Map<string, number>
) {
  const baseOwnerPct = owner
    ? owner.accountType === "hotel"
      ? owner.hotelPct
      : owner.ownerPct
    : fallbackEntity.accountType === "hotel"
      ? fallbackEntity.hotelPct
      : fallbackEntity.ownerPct;

  if (sourceHotelId && ownerId) {
    const override = overrideMap.get(`${sourceHotelId}:${ownerId}`);
    if (override !== undefined) {
      return Math.max(0, override);
    }
  }

  return Math.max(0, baseOwnerPct);
}

function resolveAttendiProfitCents(args: {
  reservation: ReservationRow;
  grossCents: number;
  mappedEntityMeta: EntityCommissionMeta;
  ownerEntityMeta: EntityCommissionMeta | null;
  ownerId: string | null;
  overrideMap: Map<string, number>;
  kHotel: number;
}) {
  const feeAmount = toInteger(args.reservation.fee_amount);
  if (feeAmount !== null && feeAmount > 0) {
    return feeAmount;
  }

  if (args.grossCents <= 0) {
    return 0;
  }

  const commissionPct = resolveOwnerCommissionPct(
    args.ownerEntityMeta,
    args.mappedEntityMeta,
    args.reservation.source_hotel_id,
    args.ownerId,
    args.overrideMap
  );

  const ownerCommissionCents = Math.round(args.grossCents * (commissionPct / 100));
  const hasHotelSplit = Boolean(args.reservation.source_hotel_id);
  const attendiShare = hasHotelSplit ? 1 - args.kHotel : 1;

  return Math.max(0, Math.round(ownerCommissionCents * attendiShare));
}

function buildReservationSelect() {
  return [
    "id",
    "product_id",
    "source_hotel_id",
    "status",
    "created_at",
    "payment_authorized_at",
    "refunded_at",
    "rental_amount",
    "addons_amount",
    "insurance_amount",
    "fee_amount",
    "importe",
    "refunded_amount",
    "refund_status"
  ].join(",");
}

type EntityFilterStatement<T> = {
  eq: (column: string, value: unknown) => T;
  in: (column: string, values: unknown[]) => T;
  or: (filters: string) => T;
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

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ entity_user_id: string }>).map((row) => row.entity_user_id).filter(Boolean)
    )
  );
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

async function fetchPlatformCommissionSettings() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platform_commission_settings")
    .select("id,k_hotel")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return DEFAULT_K_HOTEL;
    }

    throw new Error(error.message);
  }

  return Math.min(1, Math.max(0, toNumber((data as CommissionSettingRow | null)?.k_hotel, DEFAULT_K_HOTEL)));
}

async function fetchCommissionOverrides(hotelIds: string[], ownerIds: string[]) {
  const map = new Map<string, number>();

  if (!hotelIds.length || !ownerIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hotel_company_commission_overrides")
    .select("hotel_id,company_id,ce_p_pct,active")
    .in("hotel_id", hotelIds)
    .in("company_id", ownerIds)
    .eq("active", true);

  if (error) {
    if (isSupabaseRecoverableError(error)) {
      return map;
    }

    throw new Error(error.message);
  }

  ((data ?? []) as CommissionOverrideRow[]).forEach((row) => {
    map.set(`${row.hotel_id}:${row.company_id}`, Math.max(0, toNumber(row.ce_p_pct, 0)));
  });

  return map;
}

async function runReservationChunkQueries({
  productIds,
  hotelIds,
  startIso,
  endIso
}: {
  productIds: string[];
  hotelIds: string[];
  startIso: string;
  endIso: string;
}) {
  const supabase = createSupabaseServerClient();
  const rowsById = new Map<string, ReservationRow>();
  const select = buildReservationSelect();

  async function executeQuery(mode: "product" | "hotel", ids: string[]) {
    if (!ids.length) {
      return;
    }

    const chunks = chunkArray(ids, RESERVATION_CHUNK_SIZE);

    for (const chunk of chunks) {
      let statement = supabase
        .from("reservations")
        .select(select)
        .order("created_at", { ascending: false });

      statement = mode === "product" ? statement.in("product_id", chunk) : statement.in("source_hotel_id", chunk);

      let response = await statement.or(
        `and(payment_authorized_at.gte.${startIso},payment_authorized_at.lt.${endIso}),and(payment_authorized_at.is.null,created_at.gte.${startIso},created_at.lt.${endIso})`
      );

      if (response.error && !isSupabaseRecoverableError(response.error)) {
        response = await statement.gte("created_at", startIso).lt("created_at", endIso);
      }

      if (response.error) {
        if (isSupabaseRecoverableError(response.error)) {
          continue;
        }

        throw new Error(response.error.message);
      }

      ((response.data ?? []) as unknown as ReservationRow[]).forEach((row) => {
        if (!rowsById.has(row.id)) {
          rowsById.set(row.id, row);
        }
      });
    }
  }

  await executeQuery("product", productIds);
  await executeQuery("hotel", hotelIds);

  return Array.from(rowsById.values());
}

function getYearOptions(currentYear: number) {
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}

export async function getBusinessPerformancePageData(input: QueryInput): Promise<BusinessPerformancePageData> {
  const now = new Date();
  const filters = normalizeBusinessPerformanceFilters(
    {
      year: input.year,
      month: input.month,
      entityType: input.entityType,
      query: input.q,
      agentUserId: input.agent,
      entity: input.entity
    },
    now
  );

  const period = buildPeriodBounds(filters.year, filters.month);
  const trendWindow = buildMonthWindow(period.end, 3);
  const detailWindow = buildMonthWindow(period.end, 12);
  const earliestWindowStart = trendWindow.start < detailWindow.start ? trendWindow.start : detailWindow.start;

  const notes: string[] = [];

  const [agentOptions, idsForAgent] = await Promise.all([
    listAgentOptions(),
    listEntityIdsForAgent(filters.agentUserId)
  ]);

  const entityScope = buildEntityScopeFilter(filters, idsForAgent);

  if (entityScope.shortCircuit) {
    return {
      filters,
      periodLabel: period.label,
      totalEntities: 0,
      kpis: {
        gmv: 0,
        attendiProfit: 0,
        operations: 0,
        paidOperations: 0,
        refundedOperations: 0,
        cancelledOperations: 0,
        averageTicket: 0
      },
      entities: [],
      selectedEntityId: null,
      selectedEntityDetail: null,
      agentOptions,
      notes: [
        "No entities match the selected commission-agent filter.",
        "Attendi profit uses reservation.fee_amount when present; fallback formula uses profile commissions + hotel split settings."
      ]
    };
  }

  const supabase = createSupabaseServerClient();

  const listQuery = applyEntityFilters(
    supabase
      .from("profiles")
      .select(
        "id,full_name,username,account_type,comision_propietario,comision_hotel,latitude,longitude,precise_location",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(0, Math.max(0, MAX_KPI_ENTITY_SCOPE - 1)),
    filters,
    entityScope.ids
  );

  const { data: rawRows, error: rawError, count } = await listQuery;

  if (rawError) {
    throw new Error(rawError.message);
  }

  const unfilteredEntities = (rawRows ?? []) as RawEntityRow[];
  const loadedEntityIds = unfilteredEntities.map((row) => row.id);
  const emailMap = await fetchEntityEmailMap(loadedEntityIds);
  const rawEntityCount = count ?? unfilteredEntities.length;

  if (rawEntityCount > MAX_KPI_ENTITY_SCOPE) {
    notes.push(`Entity list and KPI aggregation are capped to ${MAX_KPI_ENTITY_SCOPE} entities for performance.`);
  }

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

  if (totalEntities === 0) {
    notes.push(
      "GMV base uses rental_amount + addons_amount + insurance_amount (fallback: legacy importe), netted with refunded_amount/refund status.",
      "Effective booking date uses payment_authorized_at when available, otherwise created_at.",
      "Attendi profit uses reservations.fee_amount when present; fallback uses profile commission percentages, platform_commission_settings.k_hotel, and hotel_company_commission_overrides.ce_p_pct."
    );

    return {
      filters,
      periodLabel: period.label,
      totalEntities: 0,
      kpis: {
        gmv: 0,
        attendiProfit: 0,
        operations: 0,
        paidOperations: 0,
        refundedOperations: 0,
        cancelledOperations: 0,
        averageTicket: 0
      },
      entities: [],
      selectedEntityId: null,
      selectedEntityDetail: null,
      agentOptions,
      notes
    };
  }

  const scopedEntityIds = scopedEntities.map((row) => row.id);
  const entityIdsForLabels = scopedEntityIds;

  const assignmentsByEntity = await fetchActiveAssignmentsByEntity(entityIdsForLabels);
  const assignedAgentIds = Array.from(new Set(Array.from(assignmentsByEntity.values())));
  const assignedAgentProfiles = await getProfilesMap(assignedAgentIds);

  const profileByEntity = new Map<string, RawEntityRow>();
  scopedEntities.forEach((entity) => profileByEntity.set(entity.id, entity));

  const entityCommissionMap = new Map<string, EntityCommissionMeta>();
  profileByEntity.forEach((entity, entityId) => {
    entityCommissionMap.set(entityId, getEntityCommissionMeta(entity));
  });

  const { data: productRows, error: productError } = await supabase
    .from("products")
    .select("id,user_id")
    .in("user_id", scopedEntityIds);

  if (productError && !isSupabaseRecoverableError(productError)) {
    throw new Error(productError.message);
  }

  const products = (productRows ?? []) as ProductOwnerRow[];
  const productOwnerById = new Map<string, string>();
  products.forEach((product) => {
    if (product.user_id) {
      productOwnerById.set(product.id, product.user_id);
    }
  });

  let ownerIds = Array.from(new Set(Array.from(productOwnerById.values())));
  let missingOwnerIds = ownerIds.filter((ownerId) => !entityCommissionMap.has(ownerId));

  const entityTypeById = new Map<string, BusinessEntityType>();
  profileByEntity.forEach((entity, entityId) => {
    entityTypeById.set(entityId, entity.account_type);
  });

  const hotelIdsInScope = scopedEntityIds.filter((entityId) => entityTypeById.get(entityId) === "hotel");
  const kHotel = await fetchPlatformCommissionSettings();
  const scopedEntitySet = new Set(scopedEntityIds);

  const reservationRows = await runReservationChunkQueries({
    productIds: Array.from(productOwnerById.keys()),
    hotelIds: hotelIdsInScope,
    startIso: earliestWindowStart.toISOString(),
    endIso: period.endIso
  });

  const missingProductIds = Array.from(
    new Set(
      reservationRows
        .map((row) => row.product_id)
        .filter((value): value is string => {
          if (!value) {
            return false;
          }

          return !productOwnerById.has(value);
        })
    )
  );

  if (missingProductIds.length) {
    const { data: extraProducts, error: extraProductsError } = await supabase
      .from("products")
      .select("id,user_id")
      .in("id", missingProductIds);

    if (extraProductsError && !isSupabaseRecoverableError(extraProductsError)) {
      throw new Error(extraProductsError.message);
    }

    ((extraProducts ?? []) as ProductOwnerRow[]).forEach((product) => {
      if (product.user_id) {
        productOwnerById.set(product.id, product.user_id);
      }
    });
  }

  ownerIds = Array.from(new Set(Array.from(productOwnerById.values())));
  missingOwnerIds = ownerIds.filter((ownerId) => !entityCommissionMap.has(ownerId));

  if (missingOwnerIds.length) {
    const { data: ownerRows, error: ownerError } = await supabase
      .from("profiles")
      .select("id,account_type,comision_propietario,comision_hotel")
      .in("id", missingOwnerIds);

    if (ownerError && !isSupabaseRecoverableError(ownerError)) {
      throw new Error(ownerError.message);
    }

    ((ownerRows ?? []) as Array<{
      id: string;
      account_type: BusinessEntityType;
      comision_propietario: number | null;
      comision_hotel: number | null;
    }>).forEach((owner) => {
      entityCommissionMap.set(owner.id, {
        accountType: owner.account_type,
        ownerPct: Math.max(0, toNumber(owner.comision_propietario, 10)),
        hotelPct: Math.max(0, toNumber(owner.comision_hotel, 10))
      });
    });
  }

  const overrideMap = await fetchCommissionOverrides(hotelIdsInScope, ownerIds);

  const events: ReservationPerformanceEvent[] = [];

  reservationRows.forEach((reservation) => {
    const ownerId = reservation.product_id ? productOwnerById.get(reservation.product_id) ?? null : null;
    const mappedEntityId =
      reservation.source_hotel_id && scopedEntitySet.has(reservation.source_hotel_id)
        ? reservation.source_hotel_id
        : ownerId && scopedEntitySet.has(ownerId)
          ? ownerId
          : null;

    if (!mappedEntityId) {
      return;
    }

    const mappedEntityMeta = entityCommissionMap.get(mappedEntityId);
    if (!mappedEntityMeta) {
      return;
    }

    const ownerEntityMeta = ownerId ? entityCommissionMap.get(ownerId) ?? null : null;
    const grossCents = reservationGrossCents(reservation);
    const refundCents = reservationRefundCents(reservation, grossCents);
    const attendiProfitCents = resolveAttendiProfitCents({
      reservation,
      grossCents,
      mappedEntityMeta,
      ownerEntityMeta,
      ownerId,
      overrideMap,
      kHotel
    });

    events.push({
      reservationId: reservation.id,
      entityId: mappedEntityId,
      entityType: mappedEntityMeta.accountType,
      agentUserId: assignmentsByEntity.get(mappedEntityId) ?? null,
      status: reservation.status,
      effectiveAt: reservation.payment_authorized_at ?? reservation.created_at,
      refundAt: reservation.refunded_at,
      grossCents,
      refundCents,
      attendiProfitCents
    });
  });

  const eventsByEntity = new Map<string, ReservationPerformanceEvent[]>();
  events.forEach((event) => {
    const list = eventsByEntity.get(event.entityId) ?? [];
    list.push(event);
    eventsByEntity.set(event.entityId, list);
  });

  const entityRows: BusinessPerformanceEntityRow[] = scopedEntities.map((entity) => {
    const entityEvents = eventsByEntity.get(entity.id) ?? [];
    const periodMetricsCents = aggregateEventsForPeriod(entityEvents, period, {
      entityType: "all",
      agentUserId: ""
    });
    const trendPoints = aggregateEventsByMonth(entityEvents, period.end, 3, {
      entityType: "all",
      agentUserId: ""
    });

    const agentUserId = assignmentsByEntity.get(entity.id) ?? null;
    const agentProfile = agentUserId ? assignedAgentProfiles.get(agentUserId) : undefined;

    return {
      id: entity.id,
      name: getEntityDisplayName(entity),
      username: toOptionalText(entity.username),
      email: toOptionalText(emailMap.get(entity.id)) ?? toOptionalText(entity.username),
      entityType: entity.account_type,
      latitude: entity.latitude,
      longitude: entity.longitude,
      preciseLocation: toOptionalText(entity.precise_location),
      assignedAgentUserId: agentUserId,
      assignedAgentName: agentProfile?.full_name ?? agentProfile?.username ?? agentUserId,
      periodMetrics: mapMetricsCentsToEuros(periodMetricsCents),
      lastThreeMonthsGmv: trendPoints.map((point) => Number(formatCentsToEuros(point.metrics.gmvCents).toFixed(2)))
    };
  });

  const kpiMetricsCents = aggregateEventsForPeriod(events, period, {
    entityType: filters.entityType,
    agentUserId: filters.agentUserId
  });

  const selectedEntityId = (() => {
    if (filters.selectedEntityId && profileByEntity.has(filters.selectedEntityId)) {
      return filters.selectedEntityId;
    }

    if (entityRows.length) {
      return entityRows[0].id;
    }

    return null;
  })();

  const selectedEntity = selectedEntityId ? profileByEntity.get(selectedEntityId) ?? null : null;
  const selectedEvents = selectedEntityId ? eventsByEntity.get(selectedEntityId) ?? [] : [];
  const selectedAgentUserId = selectedEntityId ? assignmentsByEntity.get(selectedEntityId) ?? null : null;
  const selectedAgentProfile = selectedAgentUserId ? assignedAgentProfiles.get(selectedAgentUserId) : undefined;

  const selectedEntityDetail: BusinessPerformanceEntityDetail | null =
    selectedEntity && selectedEntityId
      ? {
          id: selectedEntityId,
          name: getEntityDisplayName(selectedEntity),
          username: toOptionalText(selectedEntity.username),
          email: toOptionalText(emailMap.get(selectedEntityId)) ?? toOptionalText(selectedEntity.username),
          entityType: selectedEntity.account_type,
          latitude: selectedEntity.latitude,
          longitude: selectedEntity.longitude,
          preciseLocation: toOptionalText(selectedEntity.precise_location),
          assignedAgentUserId: selectedAgentUserId,
          assignedAgentName: selectedAgentProfile?.full_name ?? selectedAgentProfile?.username ?? selectedAgentUserId,
          periodMetrics: mapMetricsCentsToEuros(
            aggregateEventsForPeriod(selectedEvents, period, {
              entityType: "all",
              agentUserId: ""
            })
          ),
          monthlySeries: mapMonthlyPoints(
            aggregateEventsByMonth(selectedEvents, period.end, 12, {
              entityType: "all",
              agentUserId: ""
            })
          )
        }
      : null;

  notes.push(
    "GMV base uses rental_amount + addons_amount + insurance_amount (fallback: legacy importe), netted with refunded_amount/refund status.",
    "Effective booking date uses payment_authorized_at when available, otherwise created_at.",
    "Attendi profit uses reservations.fee_amount when present; fallback uses profile commission percentages, platform_commission_settings.k_hotel, and hotel_company_commission_overrides.ce_p_pct."
  );

  return {
    filters,
    periodLabel: period.label,
    totalEntities,
    kpis: mapMetricsCentsToEuros(kpiMetricsCents),
    entities: entityRows,
    selectedEntityId,
    selectedEntityDetail,
    agentOptions,
    notes
  };
}

export function getBusinessPerformanceYearOptions(referenceDate = new Date()) {
  return getYearOptions(referenceDate.getUTCFullYear());
}

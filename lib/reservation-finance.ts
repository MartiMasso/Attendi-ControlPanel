export type ReservationFinancialFlowType = "standard" | "hotel_link_external" | "hotel_own_product";

export interface ReservationFinancialFallbackInput {
  flowType: ReservationFinancialFlowType;
  pBaseCents: number;
  insuranceCents: number;
  cclCents: number;
  refundedCustomerCents: number;
  status?: string | null;
  cpPct: number;
  cePPct: number;
  chPct: number;
  kHotel: number;
  retentionPctHint?: number | null;
  isFreeCancellation?: boolean;
  authorizedToStartDays?: number | null;
}

export interface ReservationFinancialFallbackResult {
  grossCustomerCents: number;
  refundedCustomerBaseCents: number;
  netCustomerRetainedCents: number;
  retainedBaseCents: number;
  ownerAmountCents: number;
  hotelAmountCents: number;
  attendiAmountBeforeStripeCents: number;
  retentionPctEffective: number;
  cclRetainedCents: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRatioFromPct(value: number) {
  return clamp(value / 100, 0, 1);
}

function round(value: number) {
  return Math.round(value);
}

function isCancellationLikeStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("cancel") ||
    normalized.includes("refund") ||
    normalized.includes("reject") ||
    normalized.includes("expired")
  );
}

export function determineReservationFlowType(args: {
  ownerType: string | null;
  ownerUserId: string | null;
  linkedHotelId: string | null;
}): ReservationFinancialFlowType {
  const ownerType = String(args.ownerType ?? "").toLowerCase();
  const ownerId = args.ownerUserId ?? null;
  const linkedHotelId = args.linkedHotelId ?? null;

  if (ownerType === "hotel" && (!linkedHotelId || linkedHotelId === ownerId)) {
    return "hotel_own_product";
  }

  if (linkedHotelId && linkedHotelId !== ownerId) {
    return "hotel_link_external";
  }

  return "standard";
}

export function resolveCclRetainedCents(args: {
  cclCents: number;
  isFreeCancellation: boolean;
  authorizedToStartDays: number | null;
}) {
  const ccl = Math.max(0, args.cclCents);

  if (!args.isFreeCancellation) {
    return ccl;
  }

  if (args.authorizedToStartDays !== null && args.authorizedToStartDays <= 7) {
    return 0;
  }

  return ccl;
}

export function calculateReservationFallbackSplit(input: ReservationFinancialFallbackInput): ReservationFinancialFallbackResult {
  const pBaseCents = Math.max(0, input.pBaseCents);
  const insuranceCents = Math.max(0, input.insuranceCents);
  const cclCents = Math.max(0, input.cclCents);
  const grossCustomerCents = pBaseCents + insuranceCents + cclCents;
  const refundedCustomerCents = Math.max(0, input.refundedCustomerCents);
  const isFreeCancellation = Boolean(input.isFreeCancellation);
  const cclRetainedCents = resolveCclRetainedCents({
    cclCents,
    isFreeCancellation,
    authorizedToStartDays: input.authorizedToStartDays ?? null
  });
  const refundedCclCents = Math.max(0, cclCents - cclRetainedCents);
  const refundRemainingAfterCcl = Math.max(0, refundedCustomerCents - refundedCclCents);
  const refundedInsuranceCents = Math.min(insuranceCents, refundRemainingAfterCcl);
  const refundedCustomerBaseCents = Math.min(
    pBaseCents,
    Math.max(0, refundRemainingAfterCcl - refundedInsuranceCents)
  );
  const retainedBaseFromRefundCents = Math.max(0, pBaseCents - refundedCustomerBaseCents);

  const hintedRetention = input.retentionPctHint ?? null;
  const retentionFromHint = hintedRetention === null ? null : clamp(hintedRetention, 0, 1);
  const isCancellationContext = refundedCustomerCents > 0 || isCancellationLikeStatus(input.status);

  const retainedBaseCents = (() => {
    if (!isCancellationContext) {
      return pBaseCents;
    }

    if (refundedCustomerCents > 0) {
      return retainedBaseFromRefundCents;
    }

    if (retentionFromHint !== null) {
      return round(pBaseCents * retentionFromHint);
    }

    return pBaseCents;
  })();
  const retentionPctEffective = pBaseCents > 0 ? clamp(retainedBaseCents / pBaseCents, 0, 1) : 0;
  const netCustomerRetainedCents = Math.max(0, grossCustomerCents - refundedCustomerCents);

  const cp = toRatioFromPct(input.cpPct);
  const ceP = toRatioFromPct(input.cePPct);
  const ch = toRatioFromPct(input.chPct);
  const kHotel = clamp(input.kHotel, 0, 1);

  if (input.flowType === "hotel_link_external") {
    const ceAmount = round(retainedBaseCents * ceP);
    const hotelAmountCents = round(ceAmount * kHotel);
    const ownerAmountCents = Math.max(0, retainedBaseCents - ceAmount);
    const attendiAmountBeforeStripeCents = Math.max(0, netCustomerRetainedCents - ownerAmountCents - hotelAmountCents);

    return {
      grossCustomerCents,
      refundedCustomerBaseCents,
      netCustomerRetainedCents,
      retainedBaseCents,
      ownerAmountCents,
      hotelAmountCents,
      attendiAmountBeforeStripeCents,
      retentionPctEffective,
      cclRetainedCents
    };
  }

  if (input.flowType === "hotel_own_product") {
    const attendiBase = round(retainedBaseCents * ch);
    const ownerAmountCents = Math.max(0, retainedBaseCents - attendiBase);
    const attendiAmountBeforeStripeCents = Math.max(0, netCustomerRetainedCents - ownerAmountCents);

    return {
      grossCustomerCents,
      refundedCustomerBaseCents,
      netCustomerRetainedCents,
      retainedBaseCents,
      ownerAmountCents,
      hotelAmountCents: 0,
      attendiAmountBeforeStripeCents,
      retentionPctEffective,
      cclRetainedCents
    };
  }

  const attendiBase = round(retainedBaseCents * cp);
  const ownerAmountCents = Math.max(0, retainedBaseCents - attendiBase);
  const attendiAmountBeforeStripeCents = Math.max(0, netCustomerRetainedCents - ownerAmountCents);

  return {
    grossCustomerCents,
    refundedCustomerBaseCents,
    netCustomerRetainedCents,
    retainedBaseCents,
    ownerAmountCents,
    hotelAmountCents: 0,
    attendiAmountBeforeStripeCents,
    retentionPctEffective,
    cclRetainedCents
  };
}

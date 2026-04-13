export interface BusinessPerformanceLedgerMathInput {
  customerPaidCents: number;
  refundedCents: number;
  ownerEarningsCents: number;
  hotelEarningsCents: number;
  stripeFeeCents: number;
  feeEstimated: boolean;
}

export interface BusinessPerformanceLedgerMathResult {
  customerPaidCents: number;
  refundedCents: number;
  ownerEarningsCents: number;
  hotelEarningsCents: number;
  attendiBeforeStripeCents: number;
  stripeFeeCents: number;
  attendiNetCents: number;
  feeEstimated: boolean;
  feeSource: "real" | "estimated";
}

function nonNegativeInt(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.round(numeric));
}

export function computeBusinessPerformanceLedgerMath(
  input: BusinessPerformanceLedgerMathInput
): BusinessPerformanceLedgerMathResult {
  const customerPaidCents = nonNegativeInt(input.customerPaidCents);
  const refundedCents = nonNegativeInt(input.refundedCents);
  const ownerEarningsCents = nonNegativeInt(input.ownerEarningsCents);
  const hotelEarningsCents = nonNegativeInt(input.hotelEarningsCents);
  const stripeFeeCents = nonNegativeInt(input.stripeFeeCents);
  const feeEstimated = Boolean(input.feeEstimated);

  const attendiBeforeStripeCents = customerPaidCents - refundedCents - ownerEarningsCents - hotelEarningsCents;
  const attendiNetCents = attendiBeforeStripeCents - stripeFeeCents;

  return {
    customerPaidCents,
    refundedCents,
    ownerEarningsCents,
    hotelEarningsCents,
    attendiBeforeStripeCents,
    stripeFeeCents,
    attendiNetCents,
    feeEstimated,
    feeSource: feeEstimated ? "estimated" : "real"
  };
}

import { createSupabaseServiceClient } from "@/lib/supabase/service";

interface StripeEventPayload {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

interface StripeChargeLike {
  id?: string;
  payment_intent?: string | null;
  amount?: number;
  amount_refunded?: number;
  currency?: string;
  created?: number;
  captured?: boolean;
  captured_at?: number;
  balance_transaction?: string | Record<string, unknown> | null;
  payment_method_details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  refunds?: {
    data?: Array<Record<string, unknown>>;
  };
}

interface StripeBalanceTransactionLike {
  id?: string;
  amount?: number;
  fee?: number;
  net?: number;
  currency?: string;
  fee_details?: unknown;
  exchange_rate?: number | null;
  available_on?: number;
  created?: number;
}

function toInteger(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

function toIsoFromUnix(value: unknown) {
  const epoch = Number(value);
  if (!Number.isFinite(epoch) || epoch <= 0) {
    return null;
  }

  return new Date(epoch * 1000).toISOString();
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractCardMeta(charge: StripeChargeLike) {
  const paymentMethodDetails = asRecord(charge.payment_method_details);
  const card = asRecord(paymentMethodDetails?.card);

  return {
    payment_method_type: firstString(paymentMethodDetails?.type, "card"),
    card_brand: firstString(card?.brand),
    card_funding: firstString(card?.funding),
    card_country: firstString(card?.country),
    card_network: firstString(card?.network)
  };
}

function calculateRefundedFromCharge(charge: StripeChargeLike) {
  const explicit = toInteger(charge.amount_refunded, -1);
  if (explicit >= 0) {
    return explicit;
  }

  const refundItems = Array.isArray(charge.refunds?.data) ? charge.refunds?.data : [];
  return refundItems.reduce((sum, item) => sum + Math.max(0, toInteger(item.amount, 0)), 0);
}

async function fetchStripeObject(path: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe API request failed (${response.status}) for ${path}: ${body}`);
  }

  return response.json();
}

async function resolveChargeAndBalance(event: StripeEventPayload) {
  const object = asRecord(event.data?.object);
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  let charge: StripeChargeLike | null = null;
  let balanceTransaction: StripeBalanceTransactionLike | null = null;

  if (event.type.startsWith("charge.")) {
    charge = object as StripeChargeLike;
  }

  if (!charge && event.type === "payment_intent.succeeded") {
    const latestCharge = object?.latest_charge;
    if (typeof latestCharge === "string") {
      if (stripeSecretKey) {
        charge = (await fetchStripeObject(`charges/${latestCharge}`, stripeSecretKey)) as StripeChargeLike;
      }
    } else if (asRecord(latestCharge)) {
      charge = latestCharge as StripeChargeLike;
    }
  }

  if (!charge) {
    return { charge: null, balanceTransaction: null };
  }

  const balanceTxField = charge.balance_transaction;
  if (typeof balanceTxField === "string") {
    if (stripeSecretKey) {
      balanceTransaction = (await fetchStripeObject(`balance_transactions/${balanceTxField}`, stripeSecretKey)) as StripeBalanceTransactionLike;
    }
  } else if (asRecord(balanceTxField)) {
    balanceTransaction = balanceTxField as StripeBalanceTransactionLike;
  }

  return {
    charge,
    balanceTransaction
  };
}

async function findReservationByPaymentIntent(paymentIntentId: string) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Cannot reconcile Stripe charge without service client.");
  }

  const { data, error } = await supabase
    .from("reservations")
    .select("id,payment_intent_id")
    .eq("payment_intent_id", paymentIntentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string; payment_intent_id: string | null } | null) ?? null;
}

export async function processStripeWebhookEvent(event: StripeEventPayload) {
  const supportedEvent =
    event.type === "charge.succeeded" ||
    event.type === "charge.captured" ||
    event.type === "charge.refunded" ||
    event.type === "payment_intent.succeeded";

  if (!supportedEvent) {
    return {
      ignored: true,
      reason: "unsupported_event_type"
    };
  }

  const { charge, balanceTransaction } = await resolveChargeAndBalance(event);
  if (!charge?.id) {
    return {
      ignored: true,
      reason: "charge_not_resolved"
    };
  }

  const paymentIntentId = firstString(charge.payment_intent, asRecord(event.data?.object)?.id);
  if (!paymentIntentId) {
    return {
      ignored: true,
      reason: "missing_payment_intent_id"
    };
  }

  const reservation = await findReservationByPaymentIntent(paymentIntentId);
  const reservationId = reservation?.id ?? null;

  const grossAmountCents = Math.max(0, toInteger(charge.amount, 0));
  const refundedCents = Math.max(0, calculateRefundedFromCharge(charge));
  const stripeFeeCents = Math.max(0, toInteger(balanceTransaction?.fee, 0));
  const stripeNetCents = toInteger(balanceTransaction?.net, grossAmountCents - refundedCents - stripeFeeCents);
  const currency = String(balanceTransaction?.currency ?? charge.currency ?? "eur").toLowerCase();
  const feeDetails = Array.isArray(balanceTransaction?.fee_details) ? balanceTransaction?.fee_details : [];
  const feeEstimated = !balanceTransaction?.id;

  const payload = {
    reservation_id: reservationId,
    payment_intent_id: paymentIntentId,
    charge_id: charge.id,
    balance_transaction_id: firstString(balanceTransaction?.id),
    currency,
    gross_amount_cents: grossAmountCents,
    refunded_cents: refundedCents,
    stripe_fee_cents: stripeFeeCents,
    stripe_net_cents: stripeNetCents,
    fee_details: feeDetails,
    ...extractCardMeta(charge),
    exchange_rate: balanceTransaction?.exchange_rate ?? null,
    charge_created_at: toIsoFromUnix(charge.created),
    captured_at: toIsoFromUnix(balanceTransaction?.created ?? charge.captured_at ?? charge.created),
    available_on: toIsoFromUnix(balanceTransaction?.available_on),
    raw_charge: charge,
    raw_balance_transaction: balanceTransaction
  };

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Cannot persist Stripe reconciliation data.");
  }

  const { data: existingByCharge, error: existingByChargeError } = await supabase
    .from("stripe_charge_reconciliation")
    .select("id")
    .eq("charge_id", charge.id)
    .maybeSingle();

  if (existingByChargeError && existingByChargeError.code !== "PGRST116") {
    throw new Error(existingByChargeError.message);
  }

  const balanceTxId = firstString(balanceTransaction?.id);
  let existingId = (existingByCharge as { id?: number } | null)?.id ?? null;

  if (!existingId && balanceTxId) {
    const { data: existingByBalanceTx, error: existingByBalanceTxError } = await supabase
      .from("stripe_charge_reconciliation")
      .select("id")
      .eq("balance_transaction_id", balanceTxId)
      .maybeSingle();

    if (existingByBalanceTxError && existingByBalanceTxError.code !== "PGRST116") {
      throw new Error(existingByBalanceTxError.message);
    }

    existingId = (existingByBalanceTx as { id?: number } | null)?.id ?? null;
  }

  if (existingId) {
    const { error: updateError } = await supabase
      .from("stripe_charge_reconciliation")
      .update(payload)
      .eq("id", existingId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase.from("stripe_charge_reconciliation").insert(payload);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const reservationUpdatePayload = {
    stripe_fee_cents: stripeFeeCents,
    stripe_net_cents: stripeNetCents,
    stripe_fee_currency: currency,
    stripe_fee_source: feeEstimated ? "estimated" : "balance_transaction",
    stripe_fee_updated_at: new Date().toISOString()
  };

  if (reservationId) {
    const { error: reservationUpdateError } = await supabase
      .from("reservations")
      .update(reservationUpdatePayload)
      .eq("id", reservationId);

    if (reservationUpdateError) {
      throw new Error(reservationUpdateError.message);
    }
  } else {
    const { error: reservationUpdateError } = await supabase
      .from("reservations")
      .update(reservationUpdatePayload)
      .eq("payment_intent_id", paymentIntentId);

    if (reservationUpdateError) {
      throw new Error(reservationUpdateError.message);
    }
  }

  return {
    ignored: false,
    reservationId,
    paymentIntentId,
    chargeId: charge.id,
    balanceTransactionId: balanceTxId,
    feeEstimated
  };
}

import { NextRequest, NextResponse } from "next/server";

import { processStripeWebhookEvent } from "@/services/stripe-reconciliation-service";

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const result = await processStripeWebhookEvent(payload as never);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed processing Stripe webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

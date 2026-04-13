import { NextRequest, NextResponse } from "next/server";

import { getBusinessPerformanceKpis } from "@/services/business-performance-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const data = await getBusinessPerformanceKpis({
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      entityType: searchParams.get("entityType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      operationMode: searchParams.get("operationMode") ?? undefined,
      hotelLink: searchParams.get("hotelLink") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      agent: searchParams.get("agent") ?? undefined
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load business performance KPIs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

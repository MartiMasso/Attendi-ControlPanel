import { NextRequest, NextResponse } from "next/server";

import { getBusinessPerformanceEntityOperations } from "@/services/business-performance-service";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const data = await getBusinessPerformanceEntityOperations({
      entityId: params.id,
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      entityType: searchParams.get("entityType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      operationMode: searchParams.get("operationMode") ?? undefined,
      hotelLink: searchParams.get("hotelLink") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      agent: searchParams.get("agent") ?? undefined,
      historyStatus: searchParams.get("historyStatus") ?? undefined,
      historyProduct: searchParams.get("historyProduct") ?? undefined,
      historyPage: searchParams.get("historyPage") ?? undefined,
      historyPageSize: searchParams.get("historyPageSize") ?? undefined
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load business performance operations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { getBusinessPerformanceEntityHistoryCsv } from "@/services/business-performance-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const entityId = searchParams.get("entity");

  if (!entityId) {
    return NextResponse.json({ error: "Missing required query param: entity" }, { status: 400 });
  }

  try {
    const csv = await getBusinessPerformanceEntityHistoryCsv({
      entityId,
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
      historyProduct: searchParams.get("historyProduct") ?? undefined
    });

    const filename = `reservation-financial-history-${entityId}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export business performance history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

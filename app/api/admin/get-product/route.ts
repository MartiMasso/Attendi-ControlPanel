import { NextRequest, NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

    const { data: product, error } = await supabase
      .from("products")
      .select(
        "id,user_id,title,description,category,subcategory,rental_type," +
        "price_per_day,price_per_week,price_per_month,price_per_hour," +
        "fianza_required,fianza,stock_total,is_hidden,insured," +
        "image_url,location_display,location_lat,location_lng,created_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected error";
    console.error("[get-product]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

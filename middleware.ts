import { NextResponse, type NextRequest } from "next/server";

import { updateSupabaseSession } from "@/lib/supabase/middleware";

function withRedirect(request: NextRequest, pathname: string, search?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search ?? "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/login";

  const { supabase, response } = await updateSupabaseSession(request);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (isLoginRoute) {
      return response;
    }

    const redirectTo = encodeURIComponent(pathname);
    return withRedirect(request, "/login", `?next=${redirectTo}`);
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const isActiveAdmin = Boolean(admin?.id);

  if (!isActiveAdmin && !isLoginRoute) {
    await supabase.auth.signOut();
    return withRedirect(request, "/login", "?error=unauthorized");
  }

  if (isActiveAdmin && isLoginRoute) {
    return withRedirect(request, "/dashboard");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};

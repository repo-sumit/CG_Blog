import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/unauthorized",
  "/api/auth/callback",
  "/favicon.ico",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Skip auth gating for next internals and static assets; the matcher handles most of this.
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    // Env not set: let the page render its own error rather than 500'ing the middleware.
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Cheap domain check at the edge. Authoritative check is in the auth callback + RLS.
  if (user) {
    const email = (user.email ?? "").toLowerCase();
    const domain = email.split("@")[1] ?? "";
    // We can't read app_settings in middleware cheaply; rely on env for the edge guard.
    const allowed = (process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai").toLowerCase();
    if (domain && domain !== allowed && !isPublic && pathname !== "/unauthorized") {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.searchParams.set("reason", "domain");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

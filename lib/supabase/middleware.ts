import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/unauthorized",
  "/api/auth/callback",
  "/favicon.ico",
];

export async function updateSession(request: NextRequest) {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    // Env not set: let the page render its own error rather than 500'ing the middleware.
    return NextResponse.next({ request });
  }

  // Buffer the cookies Supabase wants to set so we can apply them to whichever
  // response we ultimately return (a `next` OR a `redirect`). Without this,
  // a refreshed session cookie is dropped on redirect and the user can land
  // back at /login in a loop.
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function withCookies<T extends NextResponse>(res: T): T {
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return withCookies(NextResponse.redirect(url));
  }

  if (user) {
    const email = (user.email ?? "").toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const allowed = (process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai").toLowerCase();
    if (domain && domain !== allowed && !isPublic && pathname !== "/unauthorized") {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.searchParams.set("reason", "domain");
      return withCookies(NextResponse.redirect(url));
    }
  }

  return withCookies(NextResponse.next({ request }));
}

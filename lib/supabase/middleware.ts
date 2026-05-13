import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Paths reachable WITHOUT a Supabase session. The landing and public post
// detail are now part of this list — anonymous visitors can read published
// posts without signing in. /login and /api/auth/callback stay public so the
// auth flow itself works.
const PUBLIC_PATHS = [
  "/",
  "/posts",
  "/login",
  "/unauthorized",
  "/api/auth/callback",
  "/api/media/file",     // signed-URL re-sign: needed for public media playback
  "/api/og-image",       // stable cover proxy for OG / email crawlers
  "/api/subscribe",      // newsletter signup + unsubscribe (anonymous)
  "/favicon.ico",
  "/google.svg",
  "/cg.png",
  "/og-default.png",
];

// Exact-match list for paths where startsWith would over-match (e.g. "/" would
// catch everything). For these we only allow exact equality.
const PUBLIC_EXACT = new Set<string>(["/"]);

export async function updateSession(request: NextRequest) {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    // Env not set: let the page render its own error rather than 500'ing the middleware.
    return NextResponse.next({ request });
  }

  // Canonical-host redirect. If the request hit a non-canonical Vercel URL
  // (e.g. the auto-generated `cg-blog-sumits-projects-…` team URL), 308 it to
  // the production host derived from NEXT_PUBLIC_APP_URL. Keeps sign-in cookies
  // and shared links pinned to one hostname.
  try {
    const canonical = new URL(publicEnv.appUrl);
    const incomingHost = request.headers.get("host") ?? request.nextUrl.host;
    const isLocalhost = incomingHost.startsWith("localhost") || incomingHost.startsWith("127.0.0.1");
    if (!isLocalhost && incomingHost !== canonical.host) {
      const target = new URL(request.nextUrl.toString());
      target.protocol = canonical.protocol;
      target.host = canonical.host;
      return NextResponse.redirect(target, 308);
    }
  } catch {
    // NEXT_PUBLIC_APP_URL isn't a valid URL — fall through and serve as-is.
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
      setAll(items: { name: string; value: string; options: CookieOptions }[]) {
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
  // The "/" entry needs exact-match treatment because every URL starts with "/".
  // Everything else uses prefix matching with a trailing-slash safeguard.
  const isPublic = PUBLIC_EXACT.has(pathname)
    || PUBLIC_PATHS.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return withCookies(NextResponse.redirect(url));
  }

  // We deliberately do NOT block non-`convegenius.ai` sessions in the middleware
  // anymore. External Google accounts are allowed for commenting + reactions;
  // they're only blocked from protected editor/admin routes by the
  // requireAuthor / requireManager guards (which redirect to /unauthorized).

  return withCookies(NextResponse.next({ request }));
}

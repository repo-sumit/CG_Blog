import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next internals)
     * - any path with a file extension (e.g. .png, .js, .css)
     */
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};

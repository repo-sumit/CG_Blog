import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv, assertPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/db/types";

export function createSupabaseServerClient() {
  assertPublicSupabaseEnv();
  const cookieStore = cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // setAll may be called from a Server Component where mutation is not allowed.
          // The middleware refreshes the session, so this is safe to ignore here.
        }
      },
    },
  });
}

/**
 * Service-role client. SERVER-ONLY. Bypasses RLS. Use sparingly and only when
 * you have already authenticated the actor and verified they have permission.
 */
export function createSupabaseServiceClient() {
  assertPublicSupabaseEnv();
  const { serviceRoleKey } = serverEnv();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

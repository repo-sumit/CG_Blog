import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv, assertPublicSupabaseEnv } from "@/lib/env";

// NOTE on typing: we deliberately do NOT pass a `<Database>` generic to the
// Supabase clients. supabase-js's typed surface depends on the Database type
// satisfying an internal `GenericSchema` constraint that has changed across
// minor versions (Relationships, SetofOptions, etc.). Our hand-rolled types
// can't reliably satisfy it without running `supabase gen types typescript`
// against the live project. With no generic, the client is `SupabaseClient<any>`
// and accepts any insert/update/upsert/rpc payload — the runtime contracts are
// still enforced by the SQL schema + RLS. Swap in generated types later if
// stricter compile-time safety is desired.

export function createSupabaseServerClient() {
  assertPublicSupabaseEnv();
  const cookieStore = cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
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
  return createClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

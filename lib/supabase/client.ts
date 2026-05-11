"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv, assertPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/db/types";

export function createSupabaseBrowserClient() {
  assertPublicSupabaseEnv();
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv, assertPublicSupabaseEnv } from "@/lib/env";

// See note in lib/supabase/server.ts about why we don't pass <Database>.
export function createSupabaseBrowserClient() {
  assertPublicSupabaseEnv();
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}

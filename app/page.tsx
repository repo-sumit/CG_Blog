import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";

export default async function RootPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  // Self-heal: if Supabase fell back to the Site URL with an OAuth `code`,
  // forward it to the real callback so the session exchange can complete.
  if (searchParams.code) {
    redirect(`/api/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  }
  const ctx = await getSessionContext();
  redirect(ctx ? "/dashboard" : "/login");
}

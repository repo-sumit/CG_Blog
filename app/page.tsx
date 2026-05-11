import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";

export default async function RootPage() {
  const ctx = await getSessionContext();
  redirect(ctx ? "/dashboard" : "/login");
}

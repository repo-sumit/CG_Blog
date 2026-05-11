import { requireSession } from "@/lib/auth/guards";
import { TopNav } from "@/components/layout/TopNav";
import { PortalFooter } from "@/components/layout/PortalFooter";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav profile={session.profile} />
      <main className="flex-1">{children}</main>
      <PortalFooter />
    </div>
  );
}

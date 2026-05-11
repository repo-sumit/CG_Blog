import { requireSession } from "@/lib/auth/guards";
import { TopNav } from "@/components/layout/TopNav";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { Ticker } from "@/components/portal/Ticker";

const SYSTEM_TRANSMISSIONS = [
  "SYSTEM ONLINE",
  "TEAM SIGNAL ACTIVE",
  "WEEKLY TRANSMISSION",
  "CONVEGENIUS PORTAL",
  "INTERNAL BLOG OS",
  "POST INDEX OPEN",
  "DARK SIGNAL ACTIVE",
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top ticker — runs continuously above the nav, signature element. */}
      <div className="container mx-auto px-4 pt-4">
        <Ticker items={SYSTEM_TRANSMISSIONS} />
      </div>

      <TopNav profile={session.profile} />

      <main className="flex-1">{children}</main>

      <PortalFooter />
    </div>
  );
}

import { requireSession } from "@/lib/auth/guards";
import { TopNav } from "@/components/layout/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav profile={session.profile} />
      <div className="flex-1">{children}</div>
      <footer className="border-t bg-muted/30 py-6 text-center text-xs text-muted-foreground">
        Internal workspace · ConveGenius.ai
      </footer>
    </div>
  );
}

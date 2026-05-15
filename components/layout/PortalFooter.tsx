import { SystemLabel } from "@/components/portal/SystemLabel";

export function PortalFooter() {
  return (
    <footer className="border-t border-portal-border-soft bg-portal-panel-soft">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between">
        {/* Left — green system-dot fronts the brand line. The dot stays on
            its own SystemLabel so the existing `signal-dot` CSS keeps doing
            its pulse, and the label text reuses the same uppercase/mono
            chrome as every other footer line. */}
        <SystemLabel tone="green" dot>
          <span className="text-portal-text-muted">
            ConveGenius Internal Blog OS · Team Dhurandhar
          </span>
        </SystemLabel>

        {/* Right — credit line. `♥` uses the brand red token (matches the
            light-theme red accent without going neon). Plain text — no
            link — keeps the footer height stable and removes the focus
            target that was here for the personal LinkedIn name. */}
        <SystemLabel>
          Made with{" "}
          <span aria-hidden className="text-portal-red">
            ♥
          </span>
          <span className="sr-only">love</span>
          {" "}for CG
        </SystemLabel>
      </div>
    </footer>
  );
}

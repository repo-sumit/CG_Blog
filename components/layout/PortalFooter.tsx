import { JapaneseLabel, SystemLabel } from "@/components/portal/SystemLabel";

export function PortalFooter() {
  return (
    <footer className="border-t-2 border-portal-border-soft bg-portal-panel-soft">
      <div className="container mx-auto flex flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <SystemLabel tone="green" dot>System Online</SystemLabel>
          <span className="font-ui text-[10px] text-portal-text-soft tracking-wider">·</span>
          <SystemLabel>Portal v1.0</SystemLabel>
        </div>
        <div className="flex items-center gap-3">
          <JapaneseLabel>ポータル · 通信 · 信号</JapaneseLabel>
          <span className="font-ui text-[10px] text-portal-text-soft tracking-wider">·</span>
          <SystemLabel>ConveGenius Internal Blog OS</SystemLabel>
        </div>
      </div>
    </footer>
  );
}

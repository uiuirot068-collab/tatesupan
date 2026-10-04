"use client";

import { useEffect } from "react";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";
import PageSettingsPanel from "./PageSettingsPanel";

export default function EditorSettingsDrawer({ settings, layout, onChange, selectedPageNumbers, focusSetting = null, getManuscript, onClose }: {
  settings: PageSettings;
  layout: PageLayout;
  onChange: (settings: PageSettings) => void;
  selectedPageNumbers: number[];
  /** CST-PORT-012: show this setting when the drawer opens (3D「ノドを調整する」). */
  focusSetting?: "gutter" | null;
  /** SPN-XFIX-001: 「本文を用紙の中央に置く」が本文の量を数えるため。 */
  getManuscript?: () => string;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[75] bg-black/35" onMouseDown={onClose}>
      <aside aria-label="設定" className="ml-auto flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-base shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink/10 px-4 py-3"><div><p className="text-[10px] tracking-[0.16em] text-ink/45">EDITOR SETTINGS</p><h2 className="text-base font-bold text-ink">設定</h2></div><button type="button" onClick={onClose} aria-label="設定を閉じる" className="rounded p-2 text-xl text-ink/55 hover:bg-ink/5">×</button></header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PageSettingsPanel settings={settings} layout={layout} onChange={onChange} selectedPageNumbers={selectedPageNumbers} mobileSurface settingsOnly focusSetting={focusSetting} getManuscript={getManuscript} />
        </div>
      </aside>
    </div>
  );
}

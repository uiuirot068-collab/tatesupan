"use client";

/**
 * CST-PORT-012: the 3D preview's view state. Kept by PreviewPane so the
 * camera / 開き方 / 製本方式 survive switching 1P / 見開き / 3D (CST does the
 * same). None of it is saved with the work: 製本方式 is a 3D-only choice, and
 * the ノド注意 guide / its explanation are remembered per browser only.
 */
import { useCallback, useState } from "react";
import { defaultBinding, type Book3DBinding } from "@/lib/book3d/book3dBinding";
import { initialBook3DView, type Book3DView } from "@/lib/book3d/book3dView";
import {
  BOOK3D_GUTTER_GUIDE_PREF_KEY,
  BOOK3D_GUTTER_HELP_PREF_KEY,
  parseGutterGuidePref,
  parseGutterHelpPref,
  type Book3DOpenState,
} from "@/lib/book3d/book3dModel";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private browsing / disabled storage: keep it for this visit only
  }
}

export function useBook3DState(pageCount: number) {
  const [view, setView] = useState<Book3DView>(() => initialBook3DView("right"));
  const [zoom, setZoom] = useState(1);
  const [openState, setOpenState] = useState<Book3DOpenState>("closed");
  const [chosenBinding, setBinding] = useState<Book3DBinding | null>(null);
  // ON for first-time users, remembered per browser (read lazily: no SSR window)
  const [showGutterGuide, setShowGutterGuideState] = useState<boolean>(() =>
    typeof window === "undefined" ? true : parseGutterGuidePref(readPref(BOOK3D_GUTTER_GUIDE_PREF_KEY)),
  );
  const [showGuideHelp, setShowGuideHelp] = useState<boolean>(() =>
    typeof window === "undefined" ? true : parseGutterHelpPref(readPref(BOOK3D_GUTTER_HELP_PREF_KEY)),
  );

  const setShowGutterGuide = useCallback((value: boolean) => {
    setShowGutterGuideState(value);
    writePref(BOOK3D_GUTTER_GUIDE_PREF_KEY, value ? "on" : "off");
  }, []);
  const dismissGuideHelp = useCallback(() => {
    setShowGuideHelp(false);
    writePref(BOOK3D_GUTTER_HELP_PREF_KEY, "dismissed");
  }, []);

  return {
    view,
    setView,
    zoom,
    setZoom,
    openState,
    setOpenState,
    // until chosen, thin books are 中綴じ and thick ones 平綴じ (CST rule)
    binding: chosenBinding ?? defaultBinding(pageCount),
    setBinding,
    showGutterGuide,
    setShowGutterGuide,
    showGuideHelp,
    dismissGuideHelp,
  };
}

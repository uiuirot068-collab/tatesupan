"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "tatespun-theme-change";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) onStoreChange();
      };
      window.addEventListener("storage", handleStorage);
      window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
      };
    },
    readStoredTheme,
    () => "light",
  );
  const isDark = theme === "dark";

  // The layout bootstrap applies the stored theme before paint. This keeps the
  // DOM attribute synchronized when the external store changes later.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Keep the selected theme for this page when storage is unavailable.
    }
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label="テーマ切り替え"
      suppressHydrationWarning
      className="relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full bg-gray-300 transition-colors dark:bg-[#c5a059]"
    >
      {/* Visuals are driven purely by the dark: CSS variant (keyed off the
          data-theme attribute the bootstrap script sets pre-paint), not by
          this component's state, so there's nothing for SSR and the client's
          first render to disagree on. */}
      <span className="inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform dark:translate-x-5" />
    </button>
  );
}

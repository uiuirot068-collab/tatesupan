"use client";

import { useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const isDark = theme === "dark";

  // Re-apply after React's dev Strict Mode remount clears the attribute the
  // inline bootstrap script set; a no-op in production.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      suppressHydrationWarning
      className="flex shrink-0 items-center gap-2 rounded-full border border-ink/20 px-2.5 py-1 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5"
    >
      {/* Visuals are driven purely by the dark: CSS variant (keyed off the
          data-theme attribute the bootstrap script sets pre-paint), not by
          this component's state, so there's nothing for SSR and the client's
          first render to disagree on. */}
      <span className="flex h-4 w-8 shrink-0 items-center rounded-full border border-ink/30 p-0.5">
        <span className="h-2.5 w-2.5 translate-x-0 rounded-full bg-accent transition-transform dark:translate-x-3.5" />
      </span>
      <span className="dark:hidden">生成り</span>
      <span className="hidden dark:inline">ブラック</span>
    </button>
  );
}

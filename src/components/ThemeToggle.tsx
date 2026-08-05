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
      <span className="flex h-4 w-8 shrink-0 items-center rounded-full border border-ink/30 p-0.5">
        <span
          className="h-2.5 w-2.5 rounded-full bg-accent transition-transform"
          style={{ transform: isDark ? "translateX(14px)" : "translateX(0)" }}
        />
      </span>
      <span suppressHydrationWarning>{isDark ? "ブラック" : "生成り"}</span>
    </button>
  );
}

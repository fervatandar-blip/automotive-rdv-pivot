"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// The `dark` class on <html> is the source of truth (set before paint by
// THEME_INIT_SCRIPT, which also follows OS changes); watch it directly so
// the button stays right whoever changes it.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle({
  labels,
  collapsed = false,
}: {
  labels: { light: string; dark: string; switchToLight: string; switchToDark: string };
  collapsed?: boolean;
}) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode / blocked storage: the switch still applies for this page view.
    }
  }

  const Icon = isDark ? Moon : Sun;
  const actionLabel = isDark ? labels.switchToLight : labels.switchToDark;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={actionLabel}
      title={actionLabel}
      className={`flex h-8 items-center gap-2 rounded-full text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 ${
        collapsed ? "w-8 justify-center" : "px-2.5"
      }`}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span>{isDark ? labels.dark : labels.light}</span>}
    </button>
  );
}

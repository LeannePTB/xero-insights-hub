import { useCallback, useEffect, useState } from "react";

/**
 * Persists a collapsible section's open/closed state per user in localStorage.
 * Stores ONLY the boolean open state — never tokens, roles or grants.
 * Falls back to closed when nothing is stored.
 */
const PREFIX = "ta:section:";

export function sectionStorageKey(scope: string, title: string) {
  return `${PREFIX}${scope}:${title.toLowerCase().replace(/\s+/g, "-")}`;
}

export function usePersistedDisclosure(
  key: string,
  options?: { forceOpen?: boolean },
): [boolean, (open: boolean) => void] {
  const forceOpen = options?.forceOpen ?? false;
  const [open, setOpenState] = useState(false);

  // Read after mount to avoid hydration mismatches.
  useEffect(() => {
    let stored: boolean | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "1") stored = true;
      else if (raw === "0") stored = false;
    } catch {}
    setOpenState(forceOpen ? true : (stored ?? false));
  }, [key, forceOpen]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {}
    },
    [key],
  );

  return [open, setOpen];
}

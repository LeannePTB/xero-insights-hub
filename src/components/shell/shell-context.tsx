import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** True when the page is inside AppShell (whose sidebar carries Sign out). */
export const InAppShellContext = createContext(false);
export const useInAppShell = () => useContext(InAppShellContext);

/**
 * Lets AppHeader tell the bare layout it is showing its own Sign out, so the
 * floating fallback hides. React state, no DOM inspection.
 */
type HeaderPresence = { count: number; register: () => () => void };
const HeaderPresenceContext = createContext<HeaderPresence>({ count: 0, register: () => () => {} });

export function HeaderPresenceProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const register = () => {
    setCount((c) => c + 1);
    return () => setCount((c) => c - 1);
  };
  return <HeaderPresenceContext.Provider value={{ count, register }}>{children}</HeaderPresenceContext.Provider>;
}

export function useRegisterHeader() {
  const { register } = useContext(HeaderPresenceContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => register(), []);
}

export const useHeaderPresent = () => useContext(HeaderPresenceContext).count > 0;

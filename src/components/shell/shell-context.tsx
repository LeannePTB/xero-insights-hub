import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** True when the page is inside AppShell (whose sidebar carries Sign out). */
export const InAppShellContext = createContext(false);
export const useInAppShell = () => useContext(InAppShellContext);

type HeaderActionsSlot = {
  actions: ReactNode;
  register: (id: string, actions: ReactNode) => () => void;
};
const ShellHeaderActionsContext = createContext<HeaderActionsSlot>({
  actions: null,
  register: () => () => {},
});

/** Mounted AppHeaders contribute actions, never another bar or logo. */
export function ShellHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Map<string, ReactNode>>(() => new Map());
  const register = useCallback((id: string, actions: ReactNode) => {
    setSlots((current) => new Map(current).set(id, actions));
    return () => {
      setSlots((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    };
  }, []);
  const value = useMemo(
    () => ({
      actions: Array.from(slots, ([id, action]) => <Fragment key={id}>{action}</Fragment>),
      register,
    }),
    [slots, register],
  );
  return (
    <ShellHeaderActionsContext.Provider value={value}>
      {children}
    </ShellHeaderActionsContext.Provider>
  );
}

export const useShellHeaderActions = () => useContext(ShellHeaderActionsContext).actions;

export function useRegisterShellHeaderActions(actions?: ReactNode) {
  const { register } = useContext(ShellHeaderActionsContext);
  const id = useId();
  useEffect(() => {
    if (actions == null) return;
    return register(id, actions);
  }, [actions, id, register]);
}

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
  return (
    <HeaderPresenceContext.Provider value={{ count, register }}>
      {children}
    </HeaderPresenceContext.Provider>
  );
}

export function useRegisterHeader() {
  const { register } = useContext(HeaderPresenceContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => register(), []);
}

export const useHeaderPresent = () => useContext(HeaderPresenceContext).count > 0;

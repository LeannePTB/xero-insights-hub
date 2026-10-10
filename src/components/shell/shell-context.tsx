import { createContext, useContext } from "react";

/** True when the page is inside AppShell (whose sidebar carries Sign out). */
export const InAppShellContext = createContext(false);
export const useInAppShell = () => useContext(InAppShellContext);

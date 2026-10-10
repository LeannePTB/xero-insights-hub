import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { InAppShellContext } from "./shell-context";

/**
 * Remembers whether the menu was collapsed, per browser.
 * Stores ONLY the boolean open state — never roles, workspaces or grants.
 */
const KEY = "ta:section:admin-nav";

function usePersistedSidebarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(true);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "0") setOpenState(false);
      else if (raw === "1") setOpenState(true);
    } catch {}
  }, []);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  }, []);
  return [open, setOpen];
}

/** The one app menu wrapped around page content. Presentation only. */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = usePersistedSidebarOpen();
  return (
    <InAppShellContext.Provider value={true}>
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <div className="min-w-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </InAppShellContext.Provider>
  );
}

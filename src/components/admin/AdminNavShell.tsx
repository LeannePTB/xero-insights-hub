import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";

/**
 * Remembers whether the admin menu was collapsed, per browser.
 * Stores ONLY the boolean open state — never roles, tokens or grants.
 * Visibility of the menu is decided by the caller, never by this value.
 */
const KEY = "ta:section:admin-nav";

export function usePersistedSidebarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(true);

  // Read after mount to avoid hydration mismatches.
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

/**
 * The admin menu wrapped around arbitrary page content.
 * Presentation only — every route behind the menu keeps its own guard.
 */
export function AdminNavShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = usePersistedSidebarOpen();

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AdminSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-12 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { InAppShellContext } from "./shell-context";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import { DEFAULT_BRANDING } from "@/hooks/usePlatformBranding";

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
  const brand = useWorkspaceBranding();
  const hasLogo = brand.logoLight !== DEFAULT_BRANDING.logoLight;
  return (
    <InAppShellContext.Provider value={true}>
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            {hasLogo && (
              <Link
                to="/"
                aria-label={brand.productName}
                 className="flex min-w-0 items-center gap-3"
              >
                {/* The logo already contains the wordmark — no duplicate text. */}
                <img
                  src={brand.logoLight}
                  alt={brand.productName}
                  className="h-12 w-auto max-w-32 shrink-0 object-contain dark:hidden"
                />
                {brand.logoDark !== brand.logoLight ? <img src={brand.logoDark} alt={brand.productName} className="hidden h-12 w-auto max-w-32 shrink-0 object-contain dark:block" /> : <span className="hidden text-lg font-semibold text-foreground dark:block">{brand.productName}</span>}
              </Link>
            )}
          </header>
          <div className="min-w-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </InAppShellContext.Provider>
  );
}

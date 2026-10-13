import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { InAppShellContext, ShellHeaderActionsProvider, useShellHeaderActions } from "./shell-context";
import { HeaderAccountActions } from "@/components/HeaderAccountActions";
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
  return (
    <InAppShellContext.Provider value={true}>
      <ShellHeaderActionsProvider>
        <SidebarProvider open={open} onOpenChange={setOpen}>
          <AppSidebar />
          <SidebarInset className="min-w-0 overflow-x-hidden">
            <ShellHeader />
            <div className="min-w-0 flex-1">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </ShellHeaderActionsProvider>
    </InAppShellContext.Provider>
  );
}

function ShellHeader() {
  const brand = useWorkspaceBranding();
  const hasLogo = brand.logoLight !== DEFAULT_BRANDING.logoLight;
  const actions = useShellHeaderActions();
  return (
          <header data-app-header className="sticky top-0 z-40 shrink-0 border-b border-border/60 bg-card">
            <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap sm:py-0">
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
            <div className="ml-auto min-w-0 max-w-full [&>div]:flex-wrap sm:[&>div]:flex-nowrap">
              <HeaderAccountActions actions={actions} />
            </div>
            </div>
          </header>
  );
}

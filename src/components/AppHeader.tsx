import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HeaderAccountActions } from "@/components/HeaderAccountActions";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import { DEFAULT_BRANDING } from "@/hooks/usePlatformBranding";

import {
  useInAppShell,
  useRegisterHeader,
  useRegisterShellHeaderActions,
} from "@/components/shell/shell-context";

type Props = {
  /** Optional actions rendered before the notification / account cluster. */
  actions?: ReactNode;
};

/**
 * Global application header: logo · wordmark on the left, actions / bell /
 * avatar / sign out on the right. Inside AppShell it only supplies actions
 * to the shell-owned header, without rendering another bar.
 */
export function AppHeader({ actions }: Props) {
  const inShell = useInAppShell();
  return inShell ? <ShellHeaderActions actions={actions} /> : <BareAppHeader actions={actions} />;
}

function ShellHeaderActions({ actions }: Props) {
  useRegisterShellHeaderActions(actions);
  return null;
}

function BareAppHeader({ actions }: Props) {
  const brand = useWorkspaceBranding();
  useRegisterHeader();

  return (
    <header data-app-header className="sticky top-0 z-40 border-b border-border/60 bg-card">
      <div className="flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3"
          aria-label={`${brand.productName} Dashboards`}
        >
          {brand.logoLight !== DEFAULT_BRANDING.logoLight ? (
            <img
              src={brand.logoLight}
              alt={brand.productName}
              className="h-9 max-w-48 w-auto shrink-0 object-contain"
            />
          ) : (
            <span className="truncate text-lg font-semibold tracking-tight">
              {brand.productName}
            </span>
          )}
        </Link>
        <HeaderAccountActions actions={actions} showSignOut />
      </div>
    </header>
  );
}

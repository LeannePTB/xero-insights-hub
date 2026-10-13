// @vitest-environment happy-dom
import React, { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../src/components/shell/AppSidebar", () => ({
  AppSidebar: () => <aside aria-label="Side menu" />,
}));
vi.mock("../src/hooks/useWorkspaceBranding", () => ({
  useWorkspaceBranding: () => ({
    productName: "Traction Advisory",
    logoLight: "/test-logo.png",
    logoDark: "/test-logo.png",
  }),
}));
vi.mock("../src/hooks/usePlatformBranding", () => ({
  DEFAULT_BRANDING: { logoLight: "/fallback.png" },
}));
vi.mock("../src/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { email: "leanne@example.test" } } })) },
  },
}));
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("../src/lib/use-sign-out", () => ({ useSignOut: () => signOut }));

import { AppShell } from "../src/components/shell/AppShell";
import { AppHeader } from "../src/components/AppHeader";
import { Button } from "../src/components/ui/button";
import { HeaderPresenceProvider, useHeaderPresent } from "../src/components/shell/shell-context";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("application header ownership", () => {
  it("renders one shell bar and logo when a page also renders AppHeader, with working page actions", async () => {
    const action = vi.fn();
    const { container } = render(
      <StrictMode>
        <AppShell>
          <AppHeader actions={<Button onClick={action}>Re-sync</Button>} />
          <h1>Overview</h1>
        </AppShell>
      </StrictMode>,
    );
    const header = screen.getByRole("banner");
    expect(container.querySelectorAll("[data-app-header]")).toHaveLength(1);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(within(header).getAllByRole("img")).toHaveLength(1);
    fireEvent.click(await within(header).findByRole("button", { name: "Re-sync" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(within(header).getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(within(header).queryByRole("button", { name: "Sign out" })).toBeNull();
    await waitFor(() => expect(header.textContent).toContain("L"));
    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy();
  });

  it("updates the action slot and removes page actions on navigation/unmount", async () => {
    const view = render(
      <AppShell>
        <AppHeader actions={<Button>First action</Button>} />
      </AppShell>,
    );
    expect(await screen.findByRole("button", { name: "First action" })).toBeTruthy();
    view.rerender(
      <AppShell>
        <AppHeader actions={<Button>Next action</Button>} />
      </AppShell>,
    );
    expect(await screen.findByRole("button", { name: "Next action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "First action" })).toBeNull();
    view.rerender(
      <AppShell>
        <h1>Next page</h1>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Next action" })).toBeNull());
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  it("keeps independent parent and child actions without leaving stale slots", async () => {
    const view = render(
      <AppShell>
        <AppHeader actions={<Button>Parent action</Button>} />
        <AppHeader actions={<Button>Child action</Button>} />
      </AppShell>,
    );
    expect(await screen.findByRole("button", { name: "Child action" })).toBeTruthy();
    view.rerender(
      <AppShell>
        <AppHeader actions={<Button>Parent action</Button>} />
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Child action" })).toBeNull());
    expect(screen.getByRole("button", { name: "Parent action" })).toBeTruthy();
  });

  it("retains standalone Sign out and hides/restores the floating fallback through header registration", async () => {
    function Fallback() {
      return useHeaderPresent() ? null : <Button>Fallback sign out</Button>;
    }
    const view = render(
      <HeaderPresenceProvider>
        <AppHeader actions={<Button>Export</Button>} />
        <Fallback />
      </HeaderPresenceProvider>,
    );
    const header = screen.getByRole("banner");
    expect(within(header).getAllByRole("img")).toHaveLength(1);
    expect(within(header).getByRole("button", { name: "Export" })).toBeTruthy();
    fireEvent.click(within(header).getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Fallback sign out" })).toBeNull(),
    );
    view.rerender(
      <HeaderPresenceProvider>
        <Fallback />
      </HeaderPresenceProvider>,
    );
    expect(await screen.findByRole("button", { name: "Fallback sign out" })).toBeTruthy();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});

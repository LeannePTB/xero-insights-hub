import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { usePersistedSidebarOpen } from "./AdminNavShell";

export function AdminShell({ children }: { children?: ReactNode }) {
  const [open, setOpen] = usePersistedSidebarOpen();

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AdminSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-12 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="min-w-0 flex-1">{children ?? <Outlet />}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({ children }: { children?: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full">
        <AdminSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center border-b px-4 md:hidden">
            <SidebarTrigger />
          </header>
          <main className="flex-1">
            {children ?? <Outlet />}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


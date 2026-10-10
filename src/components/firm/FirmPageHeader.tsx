import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";

export function FirmPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <PageHeader title={title} description={description} actions={actions} />;
}

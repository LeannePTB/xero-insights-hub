import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClient } from "@/lib/clients.functions";
import { PageHeader } from "@/components/PageHeader";

export function ClientPageHeader({ clientId, title, description, actions }: { clientId: string; title: string; description?: string; actions?: React.ReactNode }) {
  const fetchClient = useServerFn(getClient);
  const q = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }) });
  return <PageHeader title={title} description={description ?? q.data?.client?.name ?? "Client"} actions={actions} />;
}

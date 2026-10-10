import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTrixieAdmin, saveTrixieArticle, saveTrixieOrgLimit, saveTrixieSettings } from "@/lib/trixie/trixie.functions";

export const Route = createFileRoute("/_authenticated/system/trixie")({
  head: () => ({ meta: [
    { title: "Trixie — System Admin" },
    { name: "description", content: "Manage Trixie knowledge, allowances, model and usage." },
    { property: "og:title", content: "Trixie — System Admin" },
    { property: "og:description", content: "Trixie knowledge, allowances, model and usage." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TrixieAdmin,
});

function numberOrUnlimited(value: string): number | null { return value.trim() === "" ? null : Number(value); }

function TrixieAdmin() {
  const getAdmin = useServerFn(getTrixieAdmin);
  const saveSettings = useServerFn(saveTrixieSettings);
  const saveLimit = useServerFn(saveTrixieOrgLimit);
  const saveArticle = useServerFn(saveTrixieArticle);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["trixie-admin"], queryFn: () => getAdmin() });
  const settings = q.data?.settings;
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [article, setArticle] = useState({ title: "", body: "", tags: "", audience: "all", active: true });
  const current = useMemo(() => ({
    enabled: (draft.enabled ?? settings?.enabled ?? true) as boolean,
    model: String(draft.model ?? settings?.model ?? "openai/gpt-6-astra"),
    defaultAllowance: String(draft.defaultAllowance ?? settings?.default_monthly_allowance ?? ""),
    warning: String(draft.warning ?? settings?.warning_threshold ?? 80),
    platformAllowance: String(draft.platformAllowance ?? settings?.platform_monthly_allowance ?? ""),
    guard: String(draft.guard ?? settings?.token_cost_guard_usd ?? ""),
  }), [draft, settings]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["trixie-admin"] });
  const settingsMutation = useMutation({ mutationFn: () => saveSettings({ data: { enabled: current.enabled, model: "openai/gpt-6-astra", defaultAllowance: numberOrUnlimited(current.defaultAllowance), warningThreshold: Number(current.warning), platformAllowance: numberOrUnlimited(current.platformAllowance), tokenCostGuardUsd: numberOrUnlimited(current.guard) } }), onSuccess: () => { toast.success("Trixie settings saved"); setDraft({}); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const articleMutation = useMutation({ mutationFn: () => saveArticle({ data: { id: null, title: article.title, body: article.body, tags: article.tags.split(",").map((x) => x.trim()).filter(Boolean), audience: article.audience as "all"|"staff"|"viewer"|"platform", active: article.active } }), onSuccess: () => { toast.success("Knowledge article saved"); setArticle({ title: "", body: "", tags: "", audience: "all", active: true }); refresh(); }, onError: (e: Error) => toast.error(e.message) });

  return <PageContainer width="full" className="space-y-6">
    <FirmPageHeader title="Trixie" description="Manage availability, fair-use allowances, approved help content and metadata-only usage." />
    <Tabs defaultValue="settings">
      <TabsList><TabsTrigger value="settings">Settings</TabsTrigger><TabsTrigger value="knowledge">Knowledge</TabsTrigger><TabsTrigger value="allowances">Organisation allowances</TabsTrigger><TabsTrigger value="usage">Usage</TabsTrigger></TabsList>
      <TabsContent value="settings" className="pt-4"><Card><CardHeader><CardTitle>Platform settings</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
        <div className="flex items-center justify-between md:col-span-2"><div><Label htmlFor="trixie-enabled">Trixie enabled</Label><p className="text-xs text-muted-foreground">Switches the assistant on or off globally.</p></div><Switch id="trixie-enabled" checked={current.enabled} onCheckedChange={(value) => setDraft((x) => ({ ...x, enabled: value }))} /></div>
        <div className="space-y-2"><Label>Model</Label><Select value={current.model} onValueChange={(value) => setDraft((x) => ({ ...x, model: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai/gpt-6-astra">GPT-6 Astra</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Default organisation allowance</Label><Input type="number" min={1} value={current.defaultAllowance} placeholder="Unlimited" onChange={(e) => setDraft((x) => ({ ...x, defaultAllowance: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Warning threshold</Label><Input type="number" min={1} value={current.warning} onChange={(e) => setDraft((x) => ({ ...x, warning: e.target.value }))} /></div>
        <div className="space-y-2"><Label>System Admin allowance</Label><Input type="number" min={1} value={current.platformAllowance} placeholder="Unlimited" onChange={(e) => setDraft((x) => ({ ...x, platformAllowance: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Monthly token-cost guard (USD)</Label><Input type="number" min={0.01} step="0.01" value={current.guard} placeholder="Not set" onChange={(e) => setDraft((x) => ({ ...x, guard: e.target.value }))} /></div>
        <div className="md:col-span-2"><Button onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>Save settings</Button></div>
      </CardContent></Card></TabsContent>
      <TabsContent value="knowledge" className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]"><div className="space-y-3">{(q.data?.knowledge ?? []).map((item: any) => <Card key={item.id}><CardContent className="p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.audience} · {item.active ? "Active" : "Archived"}</p></div></div><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.body}</p></CardContent></Card>)}{q.data?.knowledge?.length === 0 && <p className="text-sm text-muted-foreground">No approved articles yet.</p>}</div><Card><CardHeader><CardTitle>Add article</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Title</Label><Input value={article.title} onChange={(e) => setArticle({ ...article, title: e.target.value })} /></div><div className="space-y-2"><Label>Article</Label><Textarea rows={10} value={article.body} onChange={(e) => setArticle({ ...article, body: e.target.value })} /></div><div className="space-y-2"><Label>Tags</Label><Input value={article.tags} placeholder="dashboard, reports" onChange={(e) => setArticle({ ...article, tags: e.target.value })} /></div><div className="space-y-2"><Label>Audience</Label><Select value={article.audience} onValueChange={(value) => setArticle({ ...article, audience: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="staff">Organisation team</SelectItem><SelectItem value="viewer">Clients</SelectItem><SelectItem value="platform">System Admin</SelectItem></SelectContent></Select></div><Button onClick={() => articleMutation.mutate()} disabled={articleMutation.isPending}>Save article</Button></CardContent></Card></TabsContent>
      <TabsContent value="allowances" className="pt-4"><Card><CardContent className="divide-y divide-border p-0">{(q.data?.limits ?? []).map((item: any) => <AllowanceRow key={item.firm_id} item={item} save={(value) => saveLimit({ data: { firmId: item.firm_id, allowance: value } }).then(refresh)} />)}</CardContent></Card></TabsContent>
      <TabsContent value="usage" className="pt-4"><Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Organisation</th><th className="p-3">Questions</th><th className="p-3">Input tokens</th><th className="p-3">Output tokens</th><th className="p-3">Failed</th></tr></thead><tbody>{(q.data?.usage ?? []).map((item: any) => <tr key={item.firm_id ?? "platform"} className="border-b"><td className="p-3 font-medium">{item.firm_name}</td><td className="p-3">{item.questions}</td><td className="p-3">{item.input_tokens}</td><td className="p-3">{item.output_tokens}</td><td className="p-3">{item.failed}</td></tr>)}</tbody></table></CardContent></Card></TabsContent>
    </Tabs>
  </PageContainer>;
}

function AllowanceRow({ item, save }: { item: any; save: (value: number | null) => Promise<unknown> }) {
  const [value, setValue] = useState(item.monthly_allowance == null ? "" : String(item.monthly_allowance));
  return <div className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1 font-medium">{item.firm_name}</div><Input aria-label={`${item.firm_name} allowance`} className="w-36" type="number" min={1} value={value} placeholder="Default" onChange={(e) => setValue(e.target.value)} /><Button variant="outline" onClick={() => void save(numberOrUnlimited(value)).then(() => toast.success("Allowance saved"))}>Save</Button></div>;
}
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPendingReportVideo, savePendingReportVideo } from "@/lib/reports/report-video.functions";
import { DEFAULT_VIDEO_HEADING, VIDEO_HEADING_MAX, VIDEO_MESSAGE_MAX, parseLoomId } from "@/lib/reports/report-video";

type Fields = { video_url?: string | null; video_heading?: string | null; video_message?: string | null };
export type ReportVideoEditorHandle = { save: () => Promise<void> };

export const ReportVideoEditor = forwardRef<ReportVideoEditorHandle, {
  clientId: string; periodEnd: string;
  report?: Fields & { id: string; version: number };
  onSaved: () => void;
}>(function ReportVideoEditor({ clientId, periodEnd, report, onSaved }, ref) {
  const readFn = useServerFn(getPendingReportVideo);
  const saveFn = useServerFn(savePendingReportVideo);
  const q = useQuery({ queryKey: ["pending-report-video", clientId, periodEnd],
    queryFn: () => readFn({ data: { clientId, periodEnd } }), enabled: !!periodEnd });
  const [url, setUrl] = useState("");
  const [heading, setHeading] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = report ?? q.data?.video as Fields | undefined;
  useEffect(() => {
    if (dirty) return;
    setUrl(initial?.video_url ?? ""); setHeading(initial?.video_heading ?? ""); setMessage(initial?.video_message ?? "");
  }, [initial?.video_url, initial?.video_heading, initial?.video_message, dirty]);
  const invalid = !!url.trim() && !parseLoomId(url.trim());
  async function save(clear = false) {
    if (!clear && !dirty) return;
    if (invalid && !clear) throw new Error("Paste a valid Loom share link before generating.");
    setBusy(true);
    try {
      await saveFn({ data: { clientId, periodEnd, reportId: report?.id ?? null,
        url: clear ? null : url, heading, message } });
      if (clear) { setUrl(""); setHeading(""); setMessage(""); }
      setDirty(false); await q.refetch(); onSaved();
    } finally { setBusy(false); }
  }
  useImperativeHandle(ref, () => ({ save: () => save() }));
  const edit = (setter: (v: string) => void, v: string) => { setter(v); setDirty(true); };
  const disabled = busy || q.isLoading || !!q.error;
  return <section className="min-w-0">
    <h3 className="mb-3 text-sm font-medium">③ Personal video <span className="ml-2 text-xs font-normal text-muted-foreground">{report ? `Draft v${report.version}` : "Next draft"}</span></h3>
    <div className="space-y-2">
      <div><Label htmlFor="video-url">Loom link</Label><Input id="video-url" value={url} disabled={disabled} onChange={(e) => edit(setUrl, e.target.value)} placeholder="https://www.loom.com/share/…" aria-invalid={invalid} />
        {invalid && <p className="mt-1 text-xs text-destructive">Paste a valid Loom share link.</p>}</div>
      <div><Label htmlFor="video-heading">Heading</Label><Input id="video-heading" value={heading} disabled={disabled} maxLength={VIDEO_HEADING_MAX} onChange={(e) => edit(setHeading, e.target.value)} placeholder={DEFAULT_VIDEO_HEADING} /></div>
      <div><Label htmlFor="video-message">Short message</Label><Textarea id="video-message" value={message} disabled={disabled} rows={2} maxLength={VIDEO_MESSAGE_MAX} onChange={(e) => edit(setMessage, e.target.value)} /></div>
      {q.error && <p className="text-xs text-destructive">Video could not be loaded.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={disabled || invalid || !dirty} onClick={() => save().then(() => toast.success("Video saved")).catch((e) => toast.error(e.message))}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}Save video</Button>
        {url && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => save(true).then(() => toast.success("Video removed")).catch((e) => toast.error(e.message))}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</Button>}
      </div>
    </div>
  </section>;
});

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SuperAdminSection } from "@/components/admin/SuperAdminOnly";
import { setReportVideo } from "@/lib/reports/report-video.functions";
import {
  DEFAULT_VIDEO_HEADING,
  VIDEO_HEADING_MAX,
  VIDEO_MESSAGE_MAX,
  parseLoomId,
} from "@/lib/reports/report-video";

/**
 * Super-admin-only editor for the optional personal video on a DRAFT report.
 * Presentation only — the server re-checks super admin, organisation write
 * access and draft status on every save.
 */
export function ReportVideoEditor({
  report,
  onSaved,
}: {
  report: {
    id: string;
    video_url?: string | null;
    video_heading?: string | null;
    video_message?: string | null;
  };
  onSaved: () => void;
}) {
  const saveFn = useServerFn(setReportVideo);
  const [url, setUrl] = useState(report.video_url ?? "");
  const [heading, setHeading] = useState(report.video_heading ?? "");
  const [message, setMessage] = useState(report.video_message ?? "");

  // Reset the local draft when a different report is shown. Nothing persists
  // until Save is pressed.
  useEffect(() => {
    setUrl(report.video_url ?? "");
    setHeading(report.video_heading ?? "");
    setMessage(report.video_message ?? "");
  }, [report.id, report.video_url, report.video_heading, report.video_message]);

  const mut = useMutation({
    mutationFn: (vars: { clear?: boolean }) =>
      saveFn({
        data: vars.clear
          ? { reportId: report.id, url: null }
          : { reportId: report.id, url, heading, message },
      }),
    onSuccess: (_res, vars) => {
      toast.success(vars.clear ? "Video removed" : "Video saved");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const trimmed = url.trim();
  const invalid = trimmed.length > 0 && !parseLoomId(trimmed);
  const hasVideo = !!(report.video_url ?? "").trim();

  return (
    <SuperAdminSection title="Personal video (Loom)" className="mt-6">
      <div className="rounded-xl bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Optional. Anyone who can see this report — including a client opening their
          emailed link — sees the player at the top. It never appears in the PDF, and it
          locks once the report is finalised.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="video-url">Loom link</Label>
            <Input
              id="video-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.loom.com/share/…"
              aria-invalid={invalid}
            />
            {invalid && (
              <p className="mt-1 text-xs text-destructive">
                That does not look like a Loom link. Paste a loom.com/share/… URL.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="video-heading">Heading</Label>
            <Input
              id="video-heading"
              value={heading}
              maxLength={VIDEO_HEADING_MAX}
              onChange={(e) => setHeading(e.target.value)}
              placeholder={DEFAULT_VIDEO_HEADING}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="video-message">Short message</Label>
            <Textarea
              id="video-message"
              value={message}
              maxLength={VIDEO_MESSAGE_MAX}
              rows={3}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A line or two of context to sit above the player."
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => mut.mutate({})}
            disabled={mut.isPending || invalid || !trimmed}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Video className="mr-2 h-4 w-4" />
            )}
            Save video
          </Button>
          {hasVideo && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => mut.mutate({ clear: true })}
              disabled={mut.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove video
            </Button>
          )}
        </div>
      </div>
    </SuperAdminSection>
  );
}

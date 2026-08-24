import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getClientLogoUrl,
  getOrganisationLogoUrl,
  removeClientLogo,
  removeOrganisationLogo,
  uploadClientLogo,
  uploadOrganisationLogo,
} from "@/lib/branding.functions";

const MAX_BYTES = 2 * 1024 * 1024;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Could not read that file."));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

/**
 * Branding upload for the report header and footer. Purely presentational —
 * the server re-checks that the caller is organisation staff.
 */
export function LogoUploadCard({
  scope,
  id,
  title,
  description,
}: {
  scope: "organisation" | "client";
  id: string;
  title?: string;
  description?: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const getOrg = useServerFn(getOrganisationLogoUrl);
  const getCli = useServerFn(getClientLogoUrl);
  const putOrg = useServerFn(uploadOrganisationLogo);
  const putCli = useServerFn(uploadClientLogo);
  const delOrg = useServerFn(removeOrganisationLogo);
  const delCli = useServerFn(removeClientLogo);

  const queryKey = ["report-logo", scope, id];
  const q = useQuery({
    queryKey,
    queryFn: () =>
      scope === "organisation" ? getOrg({ data: { firmId: id } }) : getCli({ data: { clientId: id } }),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!["image/png", "image/jpeg"].includes(file.type)) {
        throw new Error("Upload a PNG or JPEG image.");
      }
      if (file.size > MAX_BYTES) throw new Error("Logos must be 2 MB or smaller.");
      const fileBase64 = await readBase64(file);
      return scope === "organisation"
        ? putOrg({ data: { firmId: id, fileBase64, contentType: file.type } })
        : putCli({ data: { clientId: id, fileBase64, contentType: file.type } });
    },
    onSuccess: () => {
      toast.success("Logo updated. New reports will use it.");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  const remove = useMutation({
    mutationFn: () =>
      scope === "organisation" ? delOrg({ data: { firmId: id } }) : delCli({ data: { clientId: id } }),
    onSuccess: () => {
      toast.success("Logo removed. Reports fall back to text only.");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const url = q.data?.url ?? null;

  return (
    <div className="space-y-3">
      {title && <h3 className="font-display text-base font-semibold">{title}</h3>}
      <p className="text-sm text-muted-foreground">
        {description ??
          "Shown in the header of the monthly management report PDF. PNG or JPEG, up to 2 MB. Reports still generate without a logo."}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-border bg-background">
          {q.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : url ? (
            <img src={url} alt={`${scope === "organisation" ? "Organisation" : "Client"} logo`} className="max-h-14 max-w-36 object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo set</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            upload.mutate(f);
          }}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
          {url ? "Replace logo" : "Upload logo"}
        </Button>
        {url && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
    </div>
  );
}

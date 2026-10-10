import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { savePlatformBranding } from "@/lib/platform-branding.functions";
import { PLATFORM_BRANDING_KEY, usePlatformBranding, DEFAULT_BRANDING } from "@/hooks/usePlatformBranding";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/system/branding")({
  head: () => ({
    meta: [
      { title: "Platform branding — System Admin" },
      { name: "description", content: "Set the product name, logos, favicon and email sender name used across the platform." },
      { property: "og:title", content: "Platform branding — System Admin" },
      { property: "og:description", content: "Product name, logos, favicon and email sender name." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandingPage,
});

const MAX_LOGO = 280_000; // bytes before base64

function readFile(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > max) return reject(new Error("That file is too large"));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

function BrandingPage() {
  const brand = usePlatformBranding();
  const qc = useQueryClient();
  const save = useServerFn(savePlatformBranding);
  const [productName, setProductName] = useState("");
  const [sender, setSender] = useState("");
  const [logoLight, setLogoLight] = useState<string | null>(null);
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [favicon, setFavicon] = useState<string | null>(null);

  useEffect(() => {
    if (!brand.isCustom) return;
    setProductName(brand.productName);
    setSender(brand.emailSenderName);
    setLogoLight(brand.logoLight.startsWith("data:") ? brand.logoLight : null);
    setLogoDark(brand.logoDark.startsWith("data:") ? brand.logoDark : null);
    setFavicon(brand.favicon);
  }, [brand.isCustom]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          productName: productName.trim() || null,
          emailSenderName: sender.trim() || null,
          logoLight,
          logoDark,
          favicon,
        },
      }),
    onSuccess: () => {
      toast.success("Branding saved");
      qc.invalidateQueries({ queryKey: PLATFORM_BRANDING_KEY });
    },
    onError: (e: Error) => toast.error(e.message === "Forbidden" ? "Only super admins can change branding." : "Branding could not be saved."),
  });

  const fileField = (label: string, value: string | null, set: (v: string | null) => void, fallback: string | null, max = MAX_LOGO) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-md border border-border bg-muted p-2">
          {value || fallback ? <img src={value ?? fallback ?? ""} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">None</span>}
        </div>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="max-w-xs"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              set(await readFile(f, max));
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        />
        {value && (
          <Button variant="ghost" size="sm" onClick={() => set(null)}>
            Use default
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <PageContainer width="readable" className="space-y-6">
      <FirmPageHeader
        title="Platform branding"
        description="Used in the menu, header, sign-in pages and email sender name. Anything left empty uses the built-in Traction Advisory branding."
      />
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="pname">Product name</Label>
            <Input id="pname" value={productName} placeholder={DEFAULT_BRANDING.productName} maxLength={80} onChange={(e) => setProductName(e.target.value)} />
          </div>
          {fileField("Logo (light backgrounds)", logoLight, setLogoLight, DEFAULT_BRANDING.logoLight)}
          {fileField("Logo (dark backgrounds)", logoDark, setLogoDark, DEFAULT_BRANDING.logoDark)}
          {fileField("Favicon", favicon, setFavicon, null, 140_000)}
          <div className="space-y-2">
            <Label htmlFor="sender">Email sender name</Label>
            <Input id="sender" value={sender} placeholder={DEFAULT_BRANDING.emailSenderName} maxLength={80} onChange={(e) => setSender(e.target.value)} />
          </div>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Saving…" : "Save branding"}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

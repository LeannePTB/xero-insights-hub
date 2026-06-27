import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveSecurityContact, type SecurityContact } from "@/lib/security.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIELDS: Array<{ key: keyof SecurityContact; label: string; type?: string; placeholder?: string }> = [
  { key: "company_legal_name", label: "Company legal name" },
  { key: "trading_name", label: "Trading name" },
  { key: "abn", label: "ABN / ACN" },
  { key: "registered_address", label: "Registered address" },
  { key: "website", label: "Website", type: "url" },
  { key: "app_name", label: "App name (as registered with Xero)" },
  { key: "xero_client_id", label: "Xero app ID / client ID" },
  { key: "primary_contact_name", label: "Primary contact name" },
  { key: "primary_contact_role", label: "Primary contact role" },
  { key: "primary_contact_email", label: "Primary contact email", type: "email" },
  { key: "primary_contact_phone", label: "Primary contact phone" },
  { key: "assessment_date", label: "Assessment date", type: "date" },
];

export function ContactDetailsCard({ contact }: { contact: SecurityContact }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SecurityContact>(contact);
  const qc = useQueryClient();
  const saveFn = useServerFn(saveSecurityContact);

  useEffect(() => setForm(contact), [contact]);

  const save = useMutation({
    mutationFn: (data: SecurityContact) => saveFn({ data }),
    onSuccess: () => {
      toast.success("Contact details saved.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["security-contact"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Section 1 — Contact details</CardTitle>
          <CardDescription>
            Captured for the Xero Security Assessment. Renders into the Xero assessment mapping doc and the downloaded bundle.
          </CardDescription>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setForm(contact); setEditing(false); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="font-semibold">{f.label}</Label>
            <Input
              type={f.type ?? "text"}
              value={(form[f.key] as string) ?? ""}
              placeholder={f.placeholder}
              readOnly={!editing}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={!editing ? "bg-muted/40" : ""}
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="font-semibold">1.5 — How your application uses the Xero API</Label>
          <p className="text-xs text-muted-foreground">
            Describe how you leverage the Xero API, its purpose, the data used, and any integrations. Helps the Xero Security Team focus their review.
          </p>
          <Textarea
            rows={5}
            value={form.xero_api_usage ?? ""}
            readOnly={!editing}
            onChange={(e) => setForm({ ...form, xero_api_usage: e.target.value })}
            className={!editing ? "bg-muted/40" : ""}
          />
        </div>
      </CardContent>
    </Card>
  );
}

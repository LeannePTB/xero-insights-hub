// Server-only: organisation and client logo upload for report branding.
//
// Invariants (Access Control Spec §0): the firm id / client id in the request
// is a FILTER — the grant comes from public.user_can_access_client /
// platformStaffCanAccessFirm. Only organisation staff may change branding; a
// client viewer may not. Uploads land in the private `client-reports` bucket
// and are only ever read back through a short-lived signed URL.

const BUCKET = "client-reports";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function assertOrganisationStaff(userId: string, firmId: string) {
  const { platformStaffCanAccessFirm } = await import("@/lib/support-access.server");
  if (!(await platformStaffCanAccessFirm(userId, firmId))) {
    throw new Error("Only organisation members may change branding.");
  }
}

async function upload(path: string, bytes: Uint8Array, contentType: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any).storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

function validate(fileBase64: string, contentType: string) {
  const ext = ALLOWED[contentType];
  if (!ext) throw new Error("Upload a PNG or JPEG image.");
  const bytes = decodeBase64(fileBase64);
  if (!bytes.length) throw new Error("That file appears to be empty.");
  if (bytes.length > MAX_BYTES) throw new Error("Logos must be 2 MB or smaller.");
  return { bytes, ext };
}

export async function setOrganisationLogo(opts: {
  supabase: any;
  userId: string;
  firmId: string;
  fileBase64: string;
  contentType: string;
}) {
  await assertOrganisationStaff(opts.userId, opts.firmId);
  const { bytes, ext } = validate(opts.fileBase64, opts.contentType);
  const path = `branding/organisation/${opts.firmId}/logo-${Date.now()}.${ext}`;
  await upload(path, bytes, opts.contentType);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any)
    .from("firms")
    .update({ logo_path: path })
    .eq("id", opts.firmId);
  if (error) throw new Error(error.message);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: opts.userId,
    firmId: opts.firmId,
    action: "organisation_logo_updated",
    targetType: "firms",
    targetId: opts.firmId,
    meta: { logo_path: path },
  });
  return { path, url: await signLogo(path) };
}

export async function setClientLogo(opts: {
  supabase: any;
  userId: string;
  clientId: string;
  fileBase64: string;
  contentType: string;
}) {
  const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
  await assertClientDataAccessForClient(opts.userId, opts.clientId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: client } = await (supabaseAdmin as any)
    .from("clients")
    .select("id, firm_id")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (!client) throw new Error("Client not found.");
  await assertOrganisationStaff(opts.userId, (client as any).firm_id);

  const { bytes, ext } = validate(opts.fileBase64, opts.contentType);
  // The leading client id is required by the storage read policy.
  const path = `${opts.clientId}/branding/logo-${Date.now()}.${ext}`;
  await upload(path, bytes, opts.contentType);

  const { error } = await (supabaseAdmin as any)
    .from("clients")
    .update({ logo_path: path })
    .eq("id", opts.clientId);
  if (error) throw new Error(error.message);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: opts.userId,
    firmId: (client as any).firm_id,
    action: "client_logo_updated",
    targetType: "clients",
    targetId: opts.clientId,
    meta: { logo_path: path },
  });
  return { path, url: await signLogo(path) };
}

export async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function getOrganisationLogo(userId: string, firmId: string) {
  await assertOrganisationStaff(userId, firmId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("firms")
    .select("logo_path")
    .eq("id", firmId)
    .maybeSingle();
  const path = (data as any)?.logo_path ?? null;
  return { path, url: await signLogo(path) };
}

export async function getClientLogo(userId: string, clientId: string) {
  const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
  await assertClientDataAccessForClient(userId, clientId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("clients")
    .select("logo_path")
    .eq("id", clientId)
    .maybeSingle();
  const path = (data as any)?.logo_path ?? null;
  return { path, url: await signLogo(path) };
}

export async function clearOrganisationLogo(userId: string, firmId: string) {
  await assertOrganisationStaff(userId, firmId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any)
    .from("firms")
    .update({ logo_path: null })
    .eq("id", firmId);
  if (error) throw new Error(error.message);
  return { path: null, url: null };
}

export async function clearClientLogo(userId: string, clientId: string) {
  const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
  await assertClientDataAccessForClient(userId, clientId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: client } = await (supabaseAdmin as any)
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) throw new Error("Client not found.");
  await assertOrganisationStaff(userId, (client as any).firm_id);
  const { error } = await (supabaseAdmin as any)
    .from("clients")
    .update({ logo_path: null })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  return { path: null, url: null };
}

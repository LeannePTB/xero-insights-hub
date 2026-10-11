import { randomBytes, createHash } from "crypto";
import { siteUrl } from "@/lib/site-origin";

/**
 * The normal organisation-owner invite: one hashed, 14-day access_invites row
 * plus the firm-invite email. Shared by both ways of adding an organisation in
 * System Admin. Called only after the caller was verified as a System Administrator;
 * `admin` is the service client because access_invites has no browser write path.
 */
export async function issueOwnerInvite(params: {
  admin: any;
  firm: { id: string; name: string };
  email: string;
  invitedBy: string;
}): Promise<{ token: string; emailStatus: string }> {
  const { admin, firm, email, invitedBy } = params;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("access_invites").insert({
    firm_id: firm.id,
    email,
    role: "owner",
    token_hash: createHash("sha256").update(token).digest("hex"),
    expires_at: expiresAt,
    invited_by: invitedBy,
  });
  if (error) throw new Error(error.message);

  const inviteUrl = siteUrl(`/signup/${token}`);
  let emailStatus = "skipped";
  try {
    const { enqueueAppEmail } = await import("@/lib/email/send.server");
    const res = await enqueueAppEmail({
      templateName: "firm-invite",
      firmId: firm.id,
      recipientEmail: email,
      idempotencyKey: `firm-invite-${firm.id}-${token.slice(0, 8)}`,
      templateData: { inviteUrl, role: "owner", firmName: firm.name, inviterName: null },
    });
    emailStatus = res.status;
  } catch (e) {
    console.error("Failed to enqueue invite email", e);
    emailStatus = "failed";
  }
  return { token, emailStatus };
}

/**
 * Server-only helper to enqueue an app email directly via supabaseAdmin,
 * mirroring the logic of /lovable/email/transactional/send so server fns
 * can send emails without a user JWT (e.g. admin invite flow).
 *
 * Do NOT import this file from a client/component module.
 */
import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Traction Advisory";
const SENDER_DOMAIN = "notify.tractionadvisory.com.au";
const FROM_DOMAIN = "tractionadvisory.com.au";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface EnqueueResult {
  status: "queued" | "suppressed" | "skipped" | "failed";
  reason?: string;
}

export async function enqueueAppEmail(opts: {
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, any>;
  idempotencyKey?: string;
}): Promise<EnqueueResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin as any;

  const template = TEMPLATES[opts.templateName];
  if (!template) {
    console.error("Template not found", { templateName: opts.templateName });
    return { status: "failed", reason: "template_not_found" };
  }

  const recipient = (template.to || opts.recipientEmail || "").trim();
  if (!recipient) return { status: "failed", reason: "no_recipient" };
  const normalized = recipient.toLowerCase();
  const messageId = crypto.randomUUID();
  const idempotencyKey = opts.idempotencyKey || messageId;

  // Suppression check
  const { data: suppressed } = await supabase
    .from("suppressed_emails").select("id").eq("email", normalized).maybeSingle();
  if (suppressed) {
    await supabase.from("email_send_log").insert({
      message_id: messageId, template_name: opts.templateName,
      recipient_email: recipient, status: "suppressed",
    });
    return { status: "suppressed" };
  }

  // Get/create unsubscribe token
  let unsubscribeToken: string;
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens").select("token, used_at").eq("email", normalized).maybeSingle();
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else {
    unsubscribeToken = generateToken();
    await supabase.from("email_unsubscribe_tokens").upsert(
      { token: unsubscribeToken, email: normalized },
      { onConflict: "email", ignoreDuplicates: true },
    );
    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens").select("token").eq("email", normalized).maybeSingle();
    if (stored?.token) unsubscribeToken = stored.token;
  }

  // Render
  const data = opts.templateData ?? {};
  const element = React.createElement(template.component as any, data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof template.subject === "function"
    ? template.subject(data) : template.subject;

  await supabase.from("email_send_log").insert({
    message_id: messageId, template_name: opts.templateName,
    recipient_email: recipient, status: "pending",
  });

  const { error: enqErr } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: opts.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
  if (enqErr) {
    console.error("Failed to enqueue email", enqErr);
    await supabase.from("email_send_log").insert({
      message_id: messageId, template_name: opts.templateName,
      recipient_email: recipient, status: "failed",
      error_message: enqErr.message,
    });
    return { status: "failed", reason: enqErr.message };
  }

  return { status: "queued" };
}

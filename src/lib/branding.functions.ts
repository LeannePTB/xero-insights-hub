// Thin wrapper: server-function declarations for report branding.
// All runtime logic lives in branding.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrganisationLogoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    const { getOrganisationLogo } = await import("./branding.server");
    return getOrganisationLogo(context.userId, data.firmId);
  });

export const getClientLogoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { getClientLogo } = await import("./branding.server");
    return getClientLogo(context.userId, data.clientId);
  });

export const uploadOrganisationLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string; fileBase64: string; contentType: string }) => input)
  .handler(async ({ data, context }) => {
    const { setOrganisationLogo } = await import("./branding.server");
    return setOrganisationLogo({
      supabase: context.supabase,
      userId: context.userId,
      firmId: data.firmId,
      fileBase64: data.fileBase64,
      contentType: data.contentType,
    });
  });

export const uploadClientLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; fileBase64: string; contentType: string }) => input)
  .handler(async ({ data, context }) => {
    const { setClientLogo } = await import("./branding.server");
    return setClientLogo({
      supabase: context.supabase,
      userId: context.userId,
      clientId: data.clientId,
      fileBase64: data.fileBase64,
      contentType: data.contentType,
    });
  });

export const removeOrganisationLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    const { clearOrganisationLogo } = await import("./branding.server");
    return clearOrganisationLogo(context.userId, data.firmId);
  });

export const removeClientLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { clearClientLogo } = await import("./branding.server");
    return clearClientLogo(context.userId, data.clientId);
  });

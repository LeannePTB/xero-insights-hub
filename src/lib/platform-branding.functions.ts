import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Platform branding (Path C metadata, never client data).
 * The super-admin + aal2 rule lives in public.save_platform_branding();
 * this function only validates input and forwards the caller's session.
 */
const dataUrl = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^data:image\/(png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/)
    .nullable();

const schema = z.object({
  productName: z.string().trim().max(80).nullable(),
  logoLight: dataUrl(400_000),
  logoDark: dataUrl(400_000),
  favicon: dataUrl(200_000),
  emailSenderName: z.string().trim().max(80).nullable(),
});

export const savePlatformBranding = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("save_platform_branding", {
      _product_name: data.productName,
      _logo_light: data.logoLight,
      _logo_dark: data.logoDark,
      _favicon: data.favicon,
      _email_sender_name: data.emailSenderName,
    });
    if (error) throw new Error(/forbidden|aal2/i.test(error.message) ? "Forbidden" : "Could not save branding");
    return { ok: true };
  });

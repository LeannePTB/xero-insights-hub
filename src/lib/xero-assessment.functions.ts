import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const contactSchema = z.object({
  legal_name: z.string().max(200).nullish(),
  trading_name: z.string().max(200).nullish(),
  abn_acn: z.string().max(50).nullish(),
  address: z.string().max(500).nullish(),
  website: z.string().max(200).nullish(),
  app_name: z.string().max(200).nullish(),
  xero_client_id: z.string().max(200).nullish(),
  contact_name: z.string().max(200).nullish(),
  contact_role: z.string().max(200).nullish(),
  contact_email: z.string().max(255).nullish(),
  contact_phone: z.string().max(50).nullish(),
  assessment_date: z.string().max(20).nullish(),
  api_usage_description: z.string().max(5000).nullish(),
});

export type XeroAssessmentContact = z.infer<typeof contactSchema>;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

export const getAssessmentContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<XeroAssessmentContact> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("xero_assessment_contact")
      .select("*")
      .eq("id", "singleton")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? {}) as XeroAssessmentContact;
  });

export const saveAssessmentContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("xero_assessment_contact")
      .upsert({ id: "singleton", ...data }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

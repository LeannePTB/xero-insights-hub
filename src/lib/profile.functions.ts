import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { displayNameSchema } from "@/lib/profile-name";

export const getMyProfileName = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your name.");
    return { displayName: data?.display_name ?? "" };
  });

export const updateMyProfileName = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => displayNameSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data })
      .eq("id", context.userId);
    if (error) throw new Error("Could not update your name.");
    return { displayName: data };
  });

export const updateProfileNameAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: { userId: string; displayName: string }) => ({
    userId: zUuid(input.userId),
    displayName: displayNameSchema.parse(input.displayName),
  }))
  .handler(async ({ data, context }) => {
    const { data: displayName, error } = await (context.supabase as any).rpc(
      "set_profile_display_name_admin",
      { _target_user_id: data.userId, _display_name: data.displayName },
    );
    if (error) throw new Error("Could not update this name.");
    return { displayName: String(displayName) };
  });

function zUuid(value: string) {
  return z.string().uuid().parse(value);
}

import { z } from "zod";
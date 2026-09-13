import { z } from "zod";

export type ClientAccessRelationship = "business_owner" | "external_adviser";

export const optionalInviterLabelSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z
    .string()
    .min(1)
    .max(80, "Name must be 80 characters or fewer.")
    .refine(
      (value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Name must not be an email address.",
    )
    .nullable(),
);

export function relationshipLabel(value: ClientAccessRelationship | null | undefined) {
  if (value === "business_owner") return "Business owner";
  if (value === "external_adviser") return "External adviser";
  return "Not set";
}

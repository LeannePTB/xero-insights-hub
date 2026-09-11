import { z } from "zod";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(80, "Name must be 80 characters or fewer.")
  .refine((value) => !EMAIL_SHAPE.test(value), "Enter a name, not an email address.");

export function isRealDisplayName(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 80 && !EMAIL_SHAPE.test(trimmed);
}
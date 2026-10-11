import { z } from "zod";

export const updateMediaSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isPublic: z.boolean().optional(),
  password: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const shareEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
  message: z.string().max(1000).optional(),
  sharePassword: z.string().max(100).optional(),
});

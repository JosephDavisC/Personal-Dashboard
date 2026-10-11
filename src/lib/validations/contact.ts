import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  phone: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  company: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  title: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  photoUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  photoMediaId: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export const updateContactSchema = createContactSchema
  .partial()
  .omit({ tags: true })
  .extend({ tags: z.array(z.string()).optional() });

import { z } from "zod";

export const createLinkSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  url: z.string().url("Must be a valid URL"),
  icon: z.string().max(50).optional().nullable(),
  order: z.number().int().optional(),
  pinned: z.boolean().optional(),
  category: z.string().max(50).optional().nullable(),
});

export const updateLinkSchema = createLinkSchema.partial();

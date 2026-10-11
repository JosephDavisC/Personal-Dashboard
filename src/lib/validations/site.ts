import { z } from "zod";

export const createSiteSchema = z.object({
  label: z.string().min(1, "Label is required").max(100),
  url: z.string().url("Must be a valid URL"),
  order: z.number().int().optional(),
});

export const updateSiteSchema = createSiteSchema.partial();

export const reorderSitesSchema = z.object({
  ids: z.array(z.string().min(1)),
});

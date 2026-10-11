import { z } from "zod";

export const createTopicSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  icon: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  category: z
    .enum(["work", "school", "personal", "project", "reference"])
    .optional()
    .nullable(),
  pinned: z.boolean().optional(),
});

export const updateTopicSchema = createTopicSchema.partial().extend({
  order: z.number().int().optional(),
});

export const reorderTopicsSchema = z.object({
  ids: z.array(z.string().min(1)),
});

export const createItemSchema = z.object({
  type: z.enum(["link", "note", "image", "file"]),
  label: z.string().max(500).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  content: z.string().optional().nullable(),
  mediaId: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
});

export const updateItemSchema = createItemSchema.partial().extend({
  order: z.number().int().optional(),
});

export const reorderItemsSchema = z.object({
  ids: z.array(z.string().min(1)),
});

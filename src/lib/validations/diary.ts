import { z } from "zod";

export const createDiarySchema = z.object({
  date: z.string().min(1, "Date is required"),
  content: z.string().max(50000).optional().nullable(),
  mood: z.string().max(10).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateDiarySchema = z.object({
  content: z.string().max(50000).optional().nullable(),
  mood: z.string().max(10).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const addPhotoSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  url: z.string().min(1, "URL is required"),
  caption: z.string().max(500).optional().nullable(),
  mediaId: z.string().optional().nullable(),
  order: z.number().int().optional(),
});

export const updatePhotoSchema = z.object({
  caption: z.string().max(500).optional().nullable(),
});

export const addDiaryLinkSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  url: z.string().min(1, "URL is required").max(2000),
  title: z.string().max(500).optional().nullable(),
});

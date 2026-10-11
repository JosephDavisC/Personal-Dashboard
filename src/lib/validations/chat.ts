import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().max(200).optional().nullable(),
});

export const updateConversationSchema = z.object({
  title: z.string().max(200).optional().nullable(),
});

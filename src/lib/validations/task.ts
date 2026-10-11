import { z } from "zod";

const taskLinkSchema = z.object({
  label: z.string().max(200),
  url: z.string().url().max(2000),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  links: z.array(taskLinkSchema).max(20).optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  order: z.number().int().optional(),
});

export const reorderTaskSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]),
      order: z.number().int(),
    })
  ),
});

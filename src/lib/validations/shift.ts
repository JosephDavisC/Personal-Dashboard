import { z } from "zod";

export const createShiftSchema = z.object({
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().min(1).max(50),
  label: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateShiftSchema = createShiftSchema.partial();

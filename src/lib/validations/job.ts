import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().min(1, "Job title is required").max(200),
  company: z.string().min(1, "Company is required").max(200),
  status: z
    .enum([
      "APPLIED",
      "PHONE_SCREEN",
      "INTERVIEW",
      "OFFER",
      "REJECTED",
      "WITHDRAWN",
    ])
    .optional(),
  dateApplied: z.string(),
  nextSteps: z.string().max(500).optional().nullable(),
  salary: z.string().max(100).optional().nullable(),
  location: z.enum(["REMOTE", "HYBRID", "ON_SITE"]).optional().nullable(),
  jobUrl: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  notes: z.string().max(2000).optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  assessmentType: z
    .enum(["NONE", "CODING", "TAKE_HOME", "SYSTEM_DESIGN", "OTHER"])
    .optional(),
  assessmentNotes: z.string().max(2000).optional().nullable(),
});

export const updateJobSchema = createJobSchema.partial();

export const importJobsSchema = z.object({
  jobs: z.array(createJobSchema).min(1).max(500),
});

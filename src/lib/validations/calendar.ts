import { z } from "zod";

export const calendarEventSchema = z.object({
  summary: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  startDateTime: z.string().min(1, "Start time is required"),
  endDateTime: z.string().min(1, "End time is required"),
  allDay: z.boolean().default(false),
  addGoogleMeet: z.boolean().default(false),
  attendees: z.array(z.string().email()).optional(),
  colorId: z
    .enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"])
    .optional(),
  recurrence: z.array(z.string()).optional(),
  visibility: z.enum(["default", "public", "private"]).optional(),
  transparency: z.enum(["opaque", "transparent"]).optional(),
  reminders: z
    .object({
      useDefault: z.boolean().optional(),
      overrides: z
        .array(
          z.object({
            method: z.enum(["email", "popup"]),
            minutes: z.number().min(0).max(40320),
          })
        )
        .optional(),
    })
    .optional(),
});

export const updateCalendarEventSchema = calendarEventSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

export type CalendarEventFormData = z.infer<typeof calendarEventSchema>;

import { z } from "zod";

// ============ RACKETS ============

export const createRacketSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  brand: z.string().min(1, "Brand is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  headSize: z.number().positive().optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  pattern: z.string().max(20).optional().nullable(),
  balance: z.number().positive().optional().nullable(),
  swingWeight: z.number().positive().optional().nullable(),
  currentString: z.string().max(100).optional().nullable(),
  tension: z.string().max(20).optional().nullable(),
  lastStrung: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateRacketSchema = createRacketSchema.partial();

// ============ RESTRINGS ============

export const createRestringSchema = z.object({
  stringName: z.string().min(1, "String name is required").max(100),
  stringType: z.string().max(20).optional().nullable(),
  tension: z.string().min(1, "Tension is required").max(20),
  crossStringName: z.string().max(100).optional().nullable(),
  crossStringType: z.string().max(20).optional().nullable(),
  crossTension: z.string().max(20).optional().nullable(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateRestringSchema = createRestringSchema.partial();

// ============ STRING INVENTORY ============

export const createStringInventorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.string().min(1, "Type is required").max(20),
  gauge: z.string().max(20).optional().nullable(),
  quantity: z.number().int().min(0).default(1),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateStringInventorySchema = createStringInventorySchema.partial();

// ============ SESSIONS ============

export const createSessionSchema = z.object({
  type: z.enum(["practice", "lesson", "match"]),
  date: z.string().min(1, "Date is required"),
  duration: z.number().positive().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  racketId: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(10000).optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  coach: z.string().max(100).optional().nullable(),
  playedWith: z.string().max(200).optional().nullable(),
  calendarEventId: z.string().optional().nullable(),
  calendarEventTitle: z.string().optional().nullable(),
});

export const updateSessionSchema = createSessionSchema.partial();

// ============ STROKE RATINGS (legacy) ============

export const createStrokeRatingSchema = z.object({
  ratings: z.array(z.object({
    stroke: z.string().min(1).max(50),
    rating: z.number().min(1).max(10).multipleOf(0.5),
  })).min(1, "At least one rating is required"),
  sessionId: z.string().optional().nullable(),
});

// ============ STAGED TENNIS RATINGS ============

const ratingValue = z.number().min(1).max(10).multipleOf(0.5);

export const createTennisRatingSchema = z.object({
  ratedBy: z.string().min(1).max(50),
  forehand: ratingValue,
  bhTopspin: ratingValue,
  bhSlice: ratingValue,
  serve: ratingValue,
  volley: ratingValue,
  overhead: ratingValue,
  returnOf: ratingValue,
  notes: z.string().max(5000).optional().nullable(),
  sessionId: z.string().optional().nullable(),
});

// ============ TENNIS NOTES ============

export const createTennisNoteSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
  tags: z.array(z.string().max(50)).max(10).optional(),
  pinned: z.boolean().optional(),
});

export const updateTennisNoteSchema = createTennisNoteSchema.partial();

// ============ PHOTOS ============

export const addTennisPhotoSchema = z.object({
  url: z.string().min(1, "URL is required"),
  caption: z.string().max(500).optional().nullable(),
  mediaId: z.string().optional().nullable(),
  order: z.number().int().optional(),
});

export const updateTennisPhotoSchema = z.object({
  caption: z.string().max(500).optional().nullable(),
  order: z.number().int().optional(),
});

// ============ VIDEOS ============

export const addSessionVideoSchema = z.object({
  url: z.string().min(1, "URL is required"),
  label: z.string().max(200).optional().nullable(),
  mediaId: z.string().optional().nullable(),
});


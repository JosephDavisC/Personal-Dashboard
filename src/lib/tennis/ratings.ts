import { STAGE_ADVANCE_THRESHOLD, NEW_STAGE_BASE_RATINGS, STROKES } from "./constants";
import type { StrokeKey } from "./constants";

export interface RatingEntry {
  id: string;
  ratedBy: string;
  date: string | Date;
  forehand: number;
  bhTopspin: number;
  bhSlice: number;
  serve: number;
  volley: number;
  overhead: number;
  returnOf: number;
  notes?: string | null;
  sessionId?: string | null;
}

/** Get the latest rating per rater for a given set of ratings */
export function getLatestRatings(ratings: RatingEntry[]): Map<string, RatingEntry> {
  const latest = new Map<string, RatingEntry>();
  const sorted = [...ratings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  for (const rating of sorted) {
    if (!latest.has(rating.ratedBy)) {
      latest.set(rating.ratedBy, rating);
    }
  }
  return latest;
}

/** Compute the "effective" rating for each stroke (average across all raters' latest ratings) */
export function getAverageRatings(ratings: RatingEntry[]): Record<StrokeKey, number> {
  const latest = getLatestRatings(ratings);
  const averages = {} as Record<StrokeKey, number>;

  for (const stroke of STROKES) {
    const values = Array.from(latest.values())
      .map((r) => r[stroke.key] as number)
      .filter((v) => v != null);
    averages[stroke.key] =
      values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2
        : 0;
  }

  return averages;
}

/** Check if ready to advance (based on self ratings only) */
export function canAdvanceStage(ratings: RatingEntry[]): boolean {
  const selfRatings = ratings.filter((r) => r.ratedBy === "self");
  if (selfRatings.length === 0) return false;

  const latest = getLatestRatings(selfRatings);
  const selfLatest = latest.get("self");
  if (!selfLatest) return false;

  return STROKES.every((stroke) => {
    const value = selfLatest[stroke.key] as number;
    return value >= STAGE_ADVANCE_THRESHOLD;
  });
}

/** Count strokes at threshold for a given self rating */
export function getStrokesAtThreshold(rating: RatingEntry): number {
  return STROKES.filter((stroke) => {
    const value = rating[stroke.key] as number;
    return value >= STAGE_ADVANCE_THRESHOLD;
  }).length;
}

/** Generate initial ratings for a new stage */
export function generateNewStageRatings(stageNumber: number): Record<StrokeKey, number> {
  const base = NEW_STAGE_BASE_RATINGS[stageNumber] || 5.0;
  const ratings = {} as Record<StrokeKey, number>;
  for (const stroke of STROKES) {
    ratings[stroke.key] = base;
  }
  return ratings;
}

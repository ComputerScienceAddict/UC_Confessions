/**
 * Security helpers: input validation, constants.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/** Max length for confession body (must match DB and client). */
export const MAX_BODY_LENGTH = 560;

/** Allowed school_id set. */
export const ALLOWED_SCHOOL_IDS = new Set([
  "ucr", "ucla", "ucsd", "uci", "ucb", "ucd", "ucsb", "ucsc",
]);

export function isValidSchoolId(value: unknown): value is string {
  return typeof value === "string" && ALLOWED_SCHOOL_IDS.has(value);
}

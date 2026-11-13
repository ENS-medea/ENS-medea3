import { LessonItem } from '../types';

/**
 * Deterministic pseudo-random generator in [0, 1) based on an integer seed.
 * Ensures every minute gets its own independent random value that stays
 * consistent across devices and refreshes.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Deterministic random integer between min and max (inclusive).
 */
function seededRandomInt(seed: number, min: number, max: number): number {
  const r = seededRandom(seed);
  return min + Math.floor(r * (max - min + 1));
}

/**
 * Integer hash from a string ID
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns the current hour (0-23) in Algeria Time (Africa/Algiers, UTC+1 year-round).
 */
export function getAlgeriaHour(timestampMs: number): number {
  // Algeria (Africa/Algiers) observes CET (UTC+1) year-round without DST.
  // Adding 1 hour in ms and taking UTC hours gives exact local Algeria hour rapidly inside loops.
  return new Date(timestampMs + 3600000).getUTCHours();
}

/**
 * Checks whether a given timestamp falls in Algeria night hours:
 * 23:00 (11 PM) up to 08:00 (8 AM) -> hours 23, 0, 1, 2, 3, 4, 5, 6, 7.
 */
export function isAlgeriaNightTime(timestampMs: number): boolean {
  const hour = getAlgeriaHour(timestampMs);
  return hour >= 23 || hour < 8;
}

const FIRST_24H_MINS = 24 * 60; // 1440 minutes
const MAX_EXACT_SIMULATION_MINS = 100800; // 70 days exact minute-by-minute simulation

/**
 * Simulates per-minute automated likes from `rangeStartMs` up to `currentNowMs`,
 * given the post's original publication timestamp (`postTimestampMs`).
 *
 * Rules:
 * - At t = 0 (fewer than 1 full minute elapsed): returns 0.
 * - First 24 hours (age <= 1440 mins):
 *     - Algeria Night (23:00 - 08:00): random integer [0 .. 4] per minute.
 *     - Algeria Day   (08:00 - 23:00): random integer [4 .. 23] per minute.
 * - After first 24 hours (age > 1440 mins):
 *     - Random integer [0 .. 3] per minute.
 */
export function simulateMinutesRange(
  postId: string,
  postTimestampMs: number,
  rangeStartMs: number,
  currentNowMs: number
): number {
  if (currentNowMs <= rangeStartMs || postTimestampMs <= 0) {
    return 0;
  }

  const elapsedMs = currentNowMs - rangeStartMs;
  const wholeMinutes = Math.floor(elapsedMs / 60000);

  // Strictly 0 automated likes at t = 0 (first minute not yet elapsed)
  if (wholeMinutes <= 0) {
    return 0;
  }

  const baseHash = hashString(String(postId));
  const startMinuteOffset = Math.max(0, Math.floor((rangeStartMs - postTimestampMs) / 60000));

  const minsToSimulate = Math.min(wholeMinutes, MAX_EXACT_SIMULATION_MINS);
  let total = 0;

  for (let m = 1; m <= minsToSimulate; m++) {
    const absoluteMinuteIndex = startMinuteOffset + m;
    const minuteTimestamp = postTimestampMs + absoluteMinuteIndex * 60000;
    const seed = baseHash + absoluteMinuteIndex * 7919;

    if (absoluteMinuteIndex <= FIRST_24H_MINS) {
      if (isAlgeriaNightTime(minuteTimestamp)) {
        // Algeria night (11 PM - 8 AM) even in first 24h: 0 to 4 per minute
        total += seededRandomInt(seed, 0, 4);
      } else {
        // Algeria daytime in first 24h: 4 to 23 per minute
        total += seededRandomInt(seed, 4, 23);
      }
    } else {
      // After first 24h: 0 to 3 per minute
      total += seededRandomInt(seed, 0, 3);
    }
  }

  // O(1) fallback for posts older than 70 days (100,800 mins)
  if (wholeMinutes > MAX_EXACT_SIMULATION_MINS) {
    const remainingMins = wholeMinutes - MAX_EXACT_SIMULATION_MINS;
    // Average of [0, 3] is 1.5 likes/min
    total += Math.floor(remainingMins * 1.5);
  }

  return Math.max(0, total);
}

/**
 * Calculates ONLY the automated simulated portion of likes for a post.
 * Respects Admin pause/resume state:
 * - If autoLikesEnabled === false: returns frozenAutoLikes (0 if paused immediately).
 * - If autoLikesEnabled !== false:
 *     - If previously paused and resumed (`autoLikesResumedAt`), adds newly simulated likes since resume onto `frozenAutoLikes`.
 *     - Otherwise simulates from publication `timestamp` up to `currentNow`.
 */
export function getSimulatedAutoLikesOnly(lesson: LessonItem, currentNow = Date.now()): number {
  const postTimestamp =
    lesson.timestamp && !isNaN(lesson.timestamp) && lesson.timestamp > 0
      ? lesson.timestamp
      : currentNow;

  // If Admin stopped automated likes on this post, freeze automated growth completely
  if (lesson.autoLikesEnabled === false) {
    return typeof lesson.frozenAutoLikes === 'number' ? Math.max(0, lesson.frozenAutoLikes) : 0;
  }

  // If Admin previously paused and later resumed, accumulate from resume time on top of frozen snapshot
  if (lesson.autoLikesResumedAt && lesson.autoLikesResumedAt > postTimestamp) {
    const baseFrozen = typeof lesson.frozenAutoLikes === 'number' ? Math.max(0, lesson.frozenAutoLikes) : 0;
    const deltaSinceResume = simulateMinutesRange(
      lesson.id,
      postTimestamp,
      lesson.autoLikesResumedAt,
      currentNow
    );
    return baseFrozen + deltaSinceResume;
  }

  // Standard automated growth starting strictly from 0 at t = 0
  return simulateMinutesRange(lesson.id, postTimestamp, postTimestamp, currentNow);
}

/**
 * Calculates unified like count:
 * Automated simulated likes + real visitor/user likes.
 *
 * - Strictly starts at 0 at t = 0 (when minsElapsed < 1 and userLikes === 0).
 * - When Admin pauses automated likes (`autoLikesEnabled === false`), real user likes still increment/decrement!
 * - Never drops below userLikes.
 */
export function calculateAutomatedLikes(lesson: LessonItem, currentNow = Date.now()): number {
  const simulatedLikes = getSimulatedAutoLikesOnly(lesson, currentNow);

  const userLikes =
    typeof lesson.userLikes === 'number'
      ? Math.max(0, lesson.userLikes)
      : lesson.isLiked
        ? 1
        : 0;

  const hasManualOffset = typeof lesson.manualLikesOffset === 'number';
  const manualOffset = hasManualOffset ? (lesson.manualLikesOffset as number) : 0;

  const totalCalculated = Math.max(0, simulatedLikes + userLikes + manualOffset);

  // If Admin manually adjusted likes or paused automated likes, respect exact calculated total
  if (lesson.autoLikesEnabled === false || hasManualOffset) {
    return totalCalculated;
  }

  // Monotonic safety when auto-likes are active without manual offset
  const previousLikes = typeof lesson.likesCount === 'number' ? lesson.likesCount : 0;
  return Math.max(previousLikes, totalCalculated);
}

/**
 * Updates an array of lessons by recalculating their automated minute-based likes.
 * Skips automated growth for any lesson where Admin disabled autoLikesEnabled,
 * while keeping real user likes intact.
 */
export function applyAutomatedLikesToLessons(
  lessons: LessonItem[],
  now = Date.now()
): {
  updatedLessons: LessonItem[];
  hasChanges: boolean;
} {
  let hasChanges = false;
  const updatedLessons = lessons.map((lesson) => {
    // If Admin disabled auto-likes, do not increment automatically
    if (lesson.autoLikesEnabled === false) {
      return lesson;
    }

    const newLikesCount = calculateAutomatedLikes(lesson, now);
    if (newLikesCount !== lesson.likesCount) {
      hasChanges = true;
      return {
        ...lesson,
        likesCount: newLikesCount,
        lastLikesSyncedAt: now,
      };
    }
    return lesson;
  });

  return { updatedLessons, hasChanges };
}

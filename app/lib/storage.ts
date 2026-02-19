"use client";

const KEY_WRONG_IDS = "mlh_wrong_ids";
const KEY_WRONG_COUNT_MAP = "mlh_wrong_count_map";
const KEY_DAILY_PROGRESS = "mlh_daily_progress";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getWrongIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_WRONG_IDS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getWrongCountMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY_WRONG_COUNT_MAP);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function addWrong(id: string): void {
  const ids = new Set(getWrongIds());
  ids.add(id);
  localStorage.setItem(KEY_WRONG_IDS, JSON.stringify(Array.from(ids)));

  const map = getWrongCountMap();
  map[id] = (map[id] ?? 0) + 1;
  localStorage.setItem(KEY_WRONG_COUNT_MAP, JSON.stringify(map));
}

export function getDailyProgress(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY_DAILY_PROGRESS);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function getTodayAnsweredCount(): number {
  return getDailyProgress()[todayKey()] ?? 0;
}

export function addDailyProgress(count: number): void {
  const progress = getDailyProgress();
  const key = todayKey();
  progress[key] = (progress[key] ?? 0) + count;
  localStorage.setItem(KEY_DAILY_PROGRESS, JSON.stringify(progress));
}

export function clearWrongIds(): void {
  localStorage.removeItem(KEY_WRONG_IDS);
  localStorage.removeItem(KEY_WRONG_COUNT_MAP);
}

const KEY_PERFECT_COUNT = "mlh_perfect_count";
const KEY_LAST_COUNTED_ATTEMPT_ID = "mlh_last_counted_attempt_id";

export function getPerfectCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(KEY_PERFECT_COUNT);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function tryIncrementPerfectCount(attemptId: string): boolean {
  if (typeof window === "undefined" || !attemptId) return false;
  const last = localStorage.getItem(KEY_LAST_COUNTED_ATTEMPT_ID) ?? "";
  if (last === attemptId) return false;
  const count = getPerfectCount() + 1;
  localStorage.setItem(KEY_PERFECT_COUNT, String(count));
  localStorage.setItem(KEY_LAST_COUNTED_ATTEMPT_ID, attemptId);
  return true;
}

const KEY_ATTEMPT_ID = "mlh_attempt_id";

export function setAttemptId(id: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_ATTEMPT_ID, id);
}

export function getAttemptId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(KEY_ATTEMPT_ID) ?? "";
}

const KEY_LAST_ANSWERS = "mlh_last_answers";

export function setLastAnswers(answers: Record<string, number>): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_LAST_ANSWERS, JSON.stringify(answers));
}

export function getLastAnswers(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY_LAST_ANSWERS);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, number>) : {};
  } catch {
    return {};
  }
}

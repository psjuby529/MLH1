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

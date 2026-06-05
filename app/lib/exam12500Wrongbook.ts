"use client";

import type { Exam12500Question } from "./exam12500";

export const KEY_EXAM_WRONG_IDS = "mlh_exam12500_wrong_ids";
export const KEY_EXAM_WRONG_STATS = "mlh_exam12500_wrong_stats";

export type ExamWrongStat = {
  id: string;
  type: "single" | "multi";
  wrong_count: number;
  last_wrong_at: string;
  last_my_answer: string;
  correct_answer?: string;
  correct_answers?: string[];
  work_item?: string;
  score_value: number;
};

export type ExamWrongResultInput = {
  q: Exam12500Question;
  userSingle?: number;
  userMulti?: string[];
  correct: boolean;
};

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_EXAM_WRONG_IDS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  localStorage.setItem(KEY_EXAM_WRONG_IDS, JSON.stringify(ids));
}

function readStats(): Record<string, ExamWrongStat> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY_EXAM_WRONG_STATS);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj)
      ? (obj as Record<string, ExamWrongStat>)
      : {};
  } catch {
    return {};
  }
}

function writeStats(stats: Record<string, ExamWrongStat>): void {
  localStorage.setItem(KEY_EXAM_WRONG_STATS, JSON.stringify(stats));
}

export function getExamWrongIds(): string[] {
  return readIds();
}

export function getExamWrongStats(): Record<string, ExamWrongStat> {
  return readStats();
}

export function getExamWrongCount(): number {
  return readIds().length;
}

function serializeMyAnswer(input: ExamWrongResultInput): string {
  const { q, userSingle, userMulti } = input;
  if (q.kind === "single") {
    return userSingle !== undefined ? String(userSingle) : "";
  }
  return (userMulti ?? []).join(",");
}

function formatCorrectAnswer(q: Exam12500Question): {
  correct_answer?: string;
  correct_answers?: string[];
} {
  if (q.kind === "single") {
    const letters = ["A", "B", "C", "D"];
    return { correct_answer: letters[q.answer_index ?? 0] ?? "" };
  }
  return { correct_answers: q.correct_answers ?? [] };
}

function upsertWrongStat(input: ExamWrongResultInput): void {
  const { q } = input;
  const ids = new Set(readIds());
  ids.add(q.id);
  writeIds(Array.from(ids));

  const stats = readStats();
  const prev = stats[q.id];
  const now = new Date().toISOString();
  const correctFmt = formatCorrectAnswer(q);
  stats[q.id] = {
    id: q.id,
    type: q.kind,
    wrong_count: (prev?.wrong_count ?? 0) + 1,
    last_wrong_at: now,
    last_my_answer: serializeMyAnswer(input),
    ...correctFmt,
    work_item: q.work_item,
    score_value: q.points,
  };
  writeStats(stats);
}

/** 模擬考交卷：僅寫入答錯題 */
export function recordExamWrongFromResults(rows: ExamWrongResultInput[]): void {
  if (typeof window === "undefined") return;
  for (const row of rows) {
    if (row.correct) continue;
    upsertWrongStat(row);
  }
}

/** 錯題練習答對：從錯題集移除 */
export function removeExamWrongId(id: string): void {
  if (typeof window === "undefined") return;
  const ids = readIds().filter((x) => x !== id);
  writeIds(ids);
  const stats = readStats();
  delete stats[id];
  writeStats(stats);
}

/** 錯題練習答錯：wrong_count +1 */
export function recordExamWrongPracticeMiss(
  q: Exam12500Question,
  userSingle?: number,
  userMulti?: string[]
): void {
  upsertWrongStat({ q, userSingle, userMulti, correct: false });
}

export function clearExamWrongbook(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_EXAM_WRONG_IDS);
  localStorage.removeItem(KEY_EXAM_WRONG_STATS);
}

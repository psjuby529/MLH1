import { shuffle } from "./questions";

export type Y12500Single = {
  id: string;
  question_text: string;
  options: string[];
  answer_index: number;
  chapter?: string;
  work_item?: string;
  work_item_name?: string;
  assets?: { type: string; src: string; alt?: string }[];
  official_note?: string | null;
  review_flag?: boolean;
  explanation?: string;
};

export type Y12500Multi = {
  id: string;
  question_text: string;
  options: string[];
  correct_answers: string[];
  work_item?: string;
  work_item_name?: string;
  assets?: { type: string; src: string; alt?: string }[];
  official_note?: string | null;
  review_flag?: boolean;
  explanation?: string;
};

export type Exam12500Question = {
  id: string;
  kind: "single" | "multi";
  points: 1 | 2;
  question_text: string;
  options: string[];
  answer_index?: number;
  correct_answers?: string[];
  chapter?: string;
  work_item?: string;
  work_item_name?: string;
  assets?: { type: string; src: string; alt?: string }[];
  official_note?: string | null;
  review_flag?: boolean;
  explanation?: string;
};

export const EXAM_DURATION_SEC = 90 * 60;
export const EXAM_SINGLE_COUNT = 60;
export const EXAM_MULTI_COUNT = 20;
export const EXAM_PASS_SCORE = 60;

export async function loadY12500Single(): Promise<Y12500Single[]> {
  const res = await fetch("/data/questions_y12500.json", { cache: "no-store" });
  if (!res.ok) throw new Error("無法載入 y12500 單選題庫");
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error("y12500 單選格式錯誤");
  return raw as Y12500Single[];
}

export async function loadY12500Multi(): Promise<Y12500Multi[]> {
  const res = await fetch("/data/multi/questions_y12500.json", { cache: "no-store" });
  if (!res.ok) throw new Error("無法載入 y12500 複選題庫");
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error("y12500 複選格式錯誤");
  return raw.filter(
    (q: Y12500Multi) => Array.isArray(q.correct_answers) && q.correct_answers.length > 0
  );
}

export function singleToExamQuestion(q: Y12500Single): Exam12500Question {
  return {
    id: q.id,
    kind: "single",
    points: 1,
    question_text: q.question_text,
    options: q.options,
    answer_index: q.answer_index,
    chapter: q.chapter,
    work_item: q.work_item,
    work_item_name: q.work_item_name,
    assets: q.assets,
    official_note: q.official_note,
    review_flag: q.review_flag,
    explanation: q.explanation,
  };
}

export function multiToExamQuestion(q: Y12500Multi): Exam12500Question {
  return {
    id: q.id,
    kind: "multi",
    points: 2,
    question_text: q.question_text,
    options: q.options,
    correct_answers: q.correct_answers,
    work_item: q.work_item,
    work_item_name: q.work_item_name,
    assets: q.assets,
    official_note: q.official_note,
    review_flag: q.review_flag,
    explanation: q.explanation,
  };
}

export function resolveExamQuestionsByIds(
  ids: string[],
  singles: Y12500Single[],
  multis: Y12500Multi[]
): Exam12500Question[] {
  const map = new Map<string, Exam12500Question>();
  for (const s of singles) map.set(s.id, singleToExamQuestion(s));
  for (const m of multis) map.set(m.id, multiToExamQuestion(m));
  const out: Exam12500Question[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) out.push(q);
  }
  return out;
}

export function buildExam12500Deck(singles: Y12500Single[], multis: Y12500Multi[]): Exam12500Question[] {
  const singlePool = shuffle([...singles]);
  const multiPool = shuffle([...multis]);
  const pickedSingle = singlePool.slice(0, Math.min(EXAM_SINGLE_COUNT, singlePool.length));
  const pickedMulti = multiPool.slice(0, Math.min(EXAM_MULTI_COUNT, multiPool.length));

  const singlesOut = pickedSingle.map(singleToExamQuestion);
  const multisOut = pickedMulti.map(multiToExamQuestion);

  return [...singlesOut, ...multisOut];
}

export function multiAnswersEqual(picked: string[], correct: string[]): boolean {
  const norm = (x: string) => x.trim().toUpperCase();
  const sa = new Set(picked.map(norm).filter(Boolean));
  const sb = new Set(correct.map(norm).filter(Boolean));
  if (sa.size !== sb.size) return false;
  return Array.from(sa).every((x) => sb.has(x));
}

export function formatExamTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

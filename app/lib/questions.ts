import type { Question } from "../types";

const QUESTIONS_URL = "/data/questions_v1.json";
let cached: Question[] | null = null;

export async function fetchQuestions(): Promise<Question[]> {
  if (cached) return cached;
  const res = await fetch(QUESTIONS_URL);
  if (!res.ok) throw new Error("題庫載入失敗");
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("題庫格式錯誤");
  cached = data as Question[];
  return cached;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getChapters(questions: Question[]): string[] {
  const set = new Set(questions.map((q) => q.chapter));
  return ["ALL", ...Array.from(set).sort()];
}

import type { Question } from "../types";
import { fetchAllQuestions } from "./datasets";

let cached: Question[] | null = null;
let cachedDataset = "";

export async function fetchQuestions(datasetId?: string): Promise<Question[]> {
  const key = datasetId ?? "ALL";
  if (cached && cachedDataset === key) return cached;
  try {
    cached = await fetchAllQuestions(key);
    cachedDataset = key;
    return cached;
  } catch {
    const res = await fetch("/data/questions_v1.json");
    if (!res.ok) throw new Error("題庫載入失敗");
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) throw new Error("題庫格式錯誤");
    cached = data as Question[];
    cachedDataset = "v1";
    return cached;
  }
}

export async function fetchIndexDatasets(): Promise<{ id: string; label: string }[]> {
  const { fetchIndex } = await import("./datasets");
  const index = await fetchIndex();
  return [{ id: "ALL", label: "全部題庫" }, ...index.datasets.map((d) => ({ id: d.id, label: d.label }))];
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

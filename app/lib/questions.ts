import type { Question } from "../types";
import { fetchAllQuestions } from "./datasets";

let cached: Question[] | null = null;
let cachedDataset = "";

/** 不 fallback：載入失敗一律拋錯，錯誤可見可追蹤。 */
export async function fetchQuestions(datasetId?: string): Promise<Question[]> {
  const key = datasetId ?? "ALL";
  if (cached && cachedDataset === key) return cached;
  cached = await fetchAllQuestions(key);
  cachedDataset = key;
  return cached;
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

// --- B) 抽題去重 + 分層抽樣 ---
function normalizeText(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/[\u3000\u00A0]/g, " ")
    .replace(/[。．.]\s*$/g, "")
    .trim();
}

/** 每題唯一鍵：同一題幹+選項視為同一題，避免 20 題內重複 */
export function getDedupeKey(q: Question): string {
  const text = normalizeText(q.question_text);
  const opts = (q.options || []).map((o) => normalizeText(o)).join("|");
  const raw = text + "|" + opts;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return String(h);
}

/** 題目所屬科目/題庫鍵（用於分層抽樣與易錯統計） */
export function getStratumKey(q: Question): string {
  const id = q.id || "";
  const idx = id.lastIndexOf("_");
  return idx >= 0 ? id.slice(0, idx) : id;
}

/** 依 dedupeKey 去重，保留第一次出現的題目 */
export function dedupeByKey(questions: Question[]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const q of questions) {
    const key = getDedupeKey(q);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

const SUBJECT_CAP_RATIO = 0.35; // 單一科目最多 35%

/** 分層抽樣：依 stratum 分組，每組最多 cap 題，總共取 n 題且不重複 */
export function sampleStratified(questions: Question[], n: number): Question[] {
  if (questions.length === 0 || n <= 0) return [];
  const byStratum = new Map<string, Question[]>();
  for (const q of questions) {
    const k = getStratumKey(q);
    if (!byStratum.has(k)) byStratum.set(k, []);
    byStratum.get(k)!.push(q);
  }
  const cap = Math.max(1, Math.floor(n * SUBJECT_CAP_RATIO));
  const result: Question[] = [];
  const used = new Set<Question>();
  const strata = Array.from(byStratum.entries()).map(([key, list]) => ({ key, list: shuffle([...list]) }));
  shuffle(strata);
  const takenByStratum = new Map<string, number>();
  for (const { key } of strata) takenByStratum.set(key, 0);

  while (result.length < n) {
    let added = 0;
    for (const { key, list } of strata) {
      if (result.length >= n) break;
      if ((takenByStratum.get(key) ?? 0) >= cap) continue;
      const candidate = list.find((q) => !used.has(q));
      if (!candidate) continue;
      used.add(candidate);
      result.push(candidate);
      takenByStratum.set(key, (takenByStratum.get(key) ?? 0) + 1);
      added++;
    }
    if (added === 0) break;
  }
  if (result.length < n) {
    const rest = questions.filter((q) => !used.has(q));
    result.push(...shuffle(rest).slice(0, n - result.length));
  }
  return shuffle(result).slice(0, n);
}

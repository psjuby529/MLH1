import type { Question } from "../types";

export interface DatasetEntry {
  id: string;
  label: string;
  file: string;
}

export interface IndexData {
  datasets: DatasetEntry[];
  default_dataset: string;
}

const INDEX_URL = "/data/index.json";
let cachedIndex: IndexData | null = null;

export async function fetchIndex(): Promise<IndexData> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error("題庫索引載入失敗");
  const data = (await res.json()) as unknown;
  if (!data || typeof data !== "object" || !Array.isArray((data as IndexData).datasets)) {
    throw new Error("題庫索引格式錯誤");
  }
  cachedIndex = data as IndexData;
  return cachedIndex;
}

export async function fetchDatasetFile(file: string): Promise<Question[]> {
  const res = await fetch(`/data/${file}`);
  if (!res.ok) throw new Error(`題庫載入失敗: ${file}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error(`題庫格式錯誤: ${file}`);
  return data as Question[];
}

export async function fetchAllQuestions(datasetId: string): Promise<Question[]> {
  const index = await fetchIndex();
  if (datasetId === "ALL" || !datasetId) {
    const all: Question[] = [];
    const seen = new Set<string>();
    for (const ds of index.datasets) {
      const list = await fetchDatasetFile(ds.file);
      for (const q of list) {
        if (q.type !== "single") continue;
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        all.push(q);
      }
    }
    return all;
  }
  const entry = index.datasets.find((d) => d.id === datasetId);
  if (!entry) throw new Error(`未知題庫: ${datasetId}`);
  return fetchDatasetFile(entry.file);
}

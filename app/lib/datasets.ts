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

export interface DataMeta {
  data_version: string;
  generated_at?: string;
}

const INDEX_URL = "/data/index.json";
const META_URL = "/data/meta.json";
let cachedIndex: IndexData | null = null;
let cachedDataVersion: string | null = null;

/** 取得資料版本號，供 ?v= 原子更新用；若 meta.json 不存在則回傳 "0"。 */
export async function fetchMeta(): Promise<string> {
  if (cachedDataVersion !== null) return cachedDataVersion;
  try {
    const res = await fetch(META_URL, { cache: "no-store" });
    if (!res.ok) {
      cachedDataVersion = "0";
      return cachedDataVersion;
    }
    const data = (await res.json()) as DataMeta | null;
    cachedDataVersion = data?.data_version ?? "0";
    return cachedDataVersion;
  } catch {
    cachedDataVersion = "0";
    return cachedDataVersion;
  }
}

/** 供圖片等資源 URL 加上 ?v= 使用；若尚未載入過索引則先取 meta。 */
export async function getDataVersion(): Promise<string> {
  return fetchMeta();
}

/** 同步取得已快取的資料版本（載入過 index 後才有值）；供 img src 加 ?v= 用。 */
export function getDataVersionSync(): string | null {
  return cachedDataVersion;
}

export async function fetchIndex(): Promise<IndexData> {
  if (cachedIndex) return cachedIndex;
  const v = await fetchMeta();
  const res = await fetch(INDEX_URL + "?v=" + encodeURIComponent(v), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `題庫索引載入失敗：index.json (HTTP ${res.status})。請按「資料更新」清快取；若仍失敗代表部署缺檔。`
    );
  }
  const data = (await res.json()) as unknown;
  if (!data || typeof data !== "object" || !Array.isArray((data as IndexData).datasets)) {
    throw new Error("題庫索引格式錯誤");
  }
  cachedIndex = data as IndexData;
  return cachedIndex;
}

export async function fetchDatasetFile(file: string): Promise<Question[]> {
  const v = await fetchMeta();
  const res = await fetch(`/data/${file}?v=${encodeURIComponent(v)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `題庫載入失敗：${file} (HTTP ${res.status})。請按「資料更新」清快取；若仍失敗代表部署缺檔。`
    );
  }
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

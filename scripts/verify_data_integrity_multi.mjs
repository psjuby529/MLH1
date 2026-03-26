#!/usr/bin/env node
/**
 * 複選題庫（multi）資料完整性：與 single 分離，僅檢查 public/data/multi/
 * 0 errors 則 exit(0)；否則 exit(1)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const DATA_MULTI = path.join(PUBLIC, "data", "multi");

const OPTION_LABELS = new Set(["A", "B", "C", "D"]);

function readJson(filePath, label) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { __readError: `${label}: ${e.message}` };
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

const errors = [];

function err(msg) {
  errors.push(msg);
}

const metaPath = path.join(DATA_MULTI, "meta.json");
let metaObj = null;
if (!exists(metaPath)) err("public/data/multi/meta.json 不存在");
else {
  metaObj = readJson(metaPath, "meta.json");
  if (metaObj.__readError) err(metaObj.__readError);
  else if (!metaObj || typeof metaObj.data_version !== "string") {
    err("public/data/multi/meta.json 缺少 data_version");
  }
}

const indexPath = path.join(DATA_MULTI, "index.json");
if (!exists(indexPath)) err("public/data/multi/index.json 不存在");
const index = readJson(indexPath, "index.json");
if (index.__readError) err(index.__readError);
else if (!index || !Array.isArray(index.datasets)) {
  err("public/data/multi/index.json 格式錯誤（需有 datasets 陣列）");
}

const dataVersion =
  metaObj && !metaObj.__readError && typeof metaObj.data_version === "string"
    ? metaObj.data_version
    : "unknown";

const datasets = index && !index.__readError && Array.isArray(index.datasets) ? index.datasets : [];
let totalQuestions = 0;

for (const ds of datasets) {
  const file = ds.file;
  if (!file || typeof file !== "string") {
    err(`multi index.json 內 dataset 缺少 file: ${JSON.stringify(ds)}`);
    continue;
  }
  const filePath = path.join(DATA_MULTI, file);
  if (!exists(filePath)) {
    err(`multi 題庫檔案不存在: ${file}`);
    continue;
  }
  const list = readJson(filePath, file);
  if (list.__readError) {
    err(list.__readError);
    continue;
  }
  if (!Array.isArray(list)) {
    err(`${file}: 根必須為陣列`);
    continue;
  }
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    if (!q || typeof q !== "object") {
      err(`${file} 第 ${i + 1} 題: 非物件`);
      continue;
    }
    if (q.question_type !== "multi") {
      err(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): question_type 須為 "multi"`);
    }
    if (typeof q.question_text !== "string" || !q.question_text.trim()) {
      err(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): question_text 須為非空字串`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      err(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): options 須為長度 4 的陣列`);
    }
    if (!Array.isArray(q.correct_answers) || q.correct_answers.length < 2) {
      err(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): correct_answers 須為長度 >= 2 的陣列`);
    } else {
      const bad = q.correct_answers.some((a) => typeof a !== "string" || !OPTION_LABELS.has(a));
      if (bad) {
        err(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): correct_answers 僅能為 A/B/C/D`);
      }
      const uniq = new Set(q.correct_answers);
      if (uniq.size < 2) {
        err(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): correct_answers 須至少兩個不同選項`);
      }
    }
    if (!("id" in q) || q.id == null || String(q.id).trim() === "") {
      err(`${file} 第 ${i + 1} 題: 缺少 id`);
    }
    totalQuestions += 1;
    const assets = q.assets;
    if (Array.isArray(assets)) {
      for (const a of assets) {
        if (a && a.type === "image" && typeof a.src === "string" && a.src) {
          const srcPath = a.src.startsWith("/") ? a.src.slice(1) : a.src;
          const absPath = path.join(PUBLIC, srcPath);
          if (!exists(absPath)) {
            err(`multi 圖檔不存在: ${a.src}（題目 ${q.id}，檔案 ${file}）`);
          }
        }
      }
    }
  }
}

const errorCount = errors.length;
console.log("[verify_data_integrity_multi] error_count:", errorCount);
if (errorCount > 0) {
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}

const verifyResult = {
  ok: true,
  bank_kind: "multi",
  data_version: dataVersion,
  dataset_count: datasets.length,
  total_questions: totalQuestions,
  error_count: 0,
  verified_at: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(DATA_MULTI, "verify_result_multi.json"),
  JSON.stringify(verifyResult, null, 2),
  "utf8"
);
console.log(
  "[verify_data_integrity_multi] OK:",
  dataVersion,
  "|",
  datasets.length,
  "題庫",
  totalQuestions,
  "題 | errors: 0"
);

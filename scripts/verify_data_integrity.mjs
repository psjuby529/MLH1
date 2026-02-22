#!/usr/bin/env node
/**
 * 部署前資料完整性檢查：缺檔/缺圖/JSON 壞掉則 process.exit(1)，不允許上線。
 * 接在 prebuild，Vercel build 會先跑此腳本。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(PUBLIC, "data");

function fail(msg) {
  console.error("[verify_data_integrity] FAIL:", msg);
  process.exit(1);
}

function readJson(filePath, label) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    fail(`${label}: ${e.message}`);
  }
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// 1) meta.json 必須存在且含 data_version
const metaPath = path.join(DATA, "meta.json");
if (!exists(metaPath)) fail("public/data/meta.json 不存在");
const meta = readJson(metaPath, "meta.json");
if (!meta || typeof meta.data_version !== "string") {
  fail("public/data/meta.json 缺少 data_version");
}
const dataVersion = meta.data_version;

// 2) index.json 必須存在且含 datasets
const indexPath = path.join(DATA, "index.json");
if (!exists(indexPath)) fail("public/data/index.json 不存在");
const index = readJson(indexPath, "index.json");
if (!index || !Array.isArray(index.datasets)) {
  fail("public/data/index.json 格式錯誤（需有 datasets 陣列）");
}

const datasets = index.datasets;
let totalQuestions = 0;
const requiredQuestionFields = ["id", "question_text", "options", "answer_index", "type"];

for (const ds of datasets) {
  const file = ds.file;
  if (!file || typeof file !== "string") fail(`index.json 內 dataset 缺少 file: ${JSON.stringify(ds)}`);
  const filePath = path.join(DATA, file);
  if (!exists(filePath)) fail(`題庫檔案不存在: ${file}`);
  const list = readJson(filePath, file);
  if (!Array.isArray(list)) fail(`${file}: 根必須為陣列`);
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    if (!q || typeof q !== "object") fail(`${file} 第 ${i + 1} 題: 非物件`);
    for (const field of requiredQuestionFields) {
      if (!(field in q)) fail(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): 缺少欄位 ${field}`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      fail(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): options 須為長度 4 的陣列`);
    }
    const ai = q.answer_index;
    if (typeof ai !== "number" || ai < 0 || ai > 3) {
      fail(`${file} 第 ${i + 1} 題 (id=${q.id ?? "?"}): answer_index 須為 0–3`);
    }
    totalQuestions += 1;
    // 圖題：檢查圖檔存在
    const assets = q.assets;
    if (Array.isArray(assets)) {
      for (const a of assets) {
        if (a && a.type === "image" && typeof a.src === "string" && a.src) {
          // src 如 /assets/q/slug/Q001.png -> public/assets/q/slug/Q001.png
          const srcPath = a.src.startsWith("/") ? a.src.slice(1) : a.src;
          const absPath = path.join(PUBLIC, srcPath);
          if (!exists(absPath)) {
            fail(`圖檔不存在: ${a.src}（題目 ${q.id}，檔案 ${file}）`);
          }
        }
      }
    }
  }
}

// 通過：寫入 verify_result.json（build 時輸出，供首頁資料狀態燈使用）
const verifyResult = {
  ok: true,
  data_version: dataVersion,
  dataset_count: datasets.length,
  total_questions: totalQuestions,
  verified_at: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(DATA, "verify_result.json"),
  JSON.stringify(verifyResult, null, 2),
  "utf8"
);
console.log("[verify_data_integrity] OK:", dataVersion, "|", datasets.length, "題庫", totalQuestions, "題");

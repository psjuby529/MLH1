#!/usr/bin/env node
/**
 * PDF 集合一致性：比對 raw_pdfs 目錄與 pdf_expected_count.json 的檔案清單。
 * 若「預期有但 raw_pdfs 沒有」則 exit(1)。
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");

function getRawPdfsDir() {
  const a = path.join(ROOT, "raw_pdfs");
  const b = path.join(ROOT, "raw_pdfs:");
  if (fs.existsSync(a) && fs.statSync(a).isDirectory()) return a;
  if (fs.existsSync(b) && fs.statSync(b).isDirectory()) return b;
  return null;
}

function listPdfs(dir) {
  if (!dir) return [];
  return fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort();
}

const pdfExpectedPath = path.join(SCRIPTS, "pdf_expected_count.json");
if (!fs.existsSync(pdfExpectedPath)) {
  console.error("[verify_pdf_set] 缺少 scripts/pdf_expected_count.json，請先執行 npm run expected:pdf");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(pdfExpectedPath, "utf-8"));
const expectedFiles = Array.isArray(data.items)
  ? data.items.map((x) => (x && x.file) || "").filter(Boolean).sort()
  : [];

const rawDir = getRawPdfsDir();
const actualFiles = rawDir ? listPdfs(rawDir) : [];

const expectedSet = new Set(expectedFiles);
const actualSet = new Set(actualFiles);

const missing_in_raw_pdfs = expectedFiles.filter((f) => !actualSet.has(f));
const extra_in_raw_pdfs = actualFiles.filter((f) => !expectedSet.has(f));

console.log("raw_pdfs 目錄:", rawDir ?? "(不存在)");
console.log("預期 PDF 數量 (pdf_expected_count.json):", expectedFiles.length);
console.log("實際 PDF 數量 (raw_pdfs):", actualFiles.length);
console.log("missing_in_raw_pdfs:", missing_in_raw_pdfs.length ? missing_in_raw_pdfs : "[]");
console.log("extra_in_raw_pdfs:", extra_in_raw_pdfs.length ? extra_in_raw_pdfs : "[]");

if (missing_in_raw_pdfs.length > 0) {
  console.error("[verify_pdf_set] 有預期 PDF 不在 raw_pdfs 中，請補齊後再匯入。");
  process.exit(1);
}

console.log("[verify_pdf_set] OK：預期 PDF 皆存在於 raw_pdfs。");

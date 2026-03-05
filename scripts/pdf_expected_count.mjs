#!/usr/bin/env node
/**
 * 產出 scripts/pdf_expected_count.json：
 * - 若有 raw_pdfs（或 raw_pdfs:）且可跑 Python，從每份 PDF 擷取「題數宣告」→ expected + evidence
 * - 否則以 import_report.json 的 parsed 為 expected，evidence 為「匯入報告 parsed 題數」
 * 終端輸出 TOTAL_EXPECTED。
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");
const RAW_PDFS = path.join(ROOT, "raw_pdfs");
const RAW_PDFS_COLON = path.join(ROOT, "raw_pdfs:");

function getPdfDir() {
  if (fs.existsSync(RAW_PDFS) && fs.statSync(RAW_PDFS).isDirectory()) return RAW_PDFS;
  if (fs.existsSync(RAW_PDFS_COLON) && fs.statSync(RAW_PDFS_COLON).isDirectory()) return RAW_PDFS_COLON;
  return null;
}

function runPythonExtract(pdfDir) {
  const dirName = path.basename(pdfDir);
  try {
    const out = execSync(
      `python3 "${path.join(SCRIPTS, "extract_pdf_expected.py")}" --input-dir "${dirName}" --root "${ROOT}"`,
      { encoding: "utf-8", maxBuffer: 2 * 1024 * 1024 }
    );
    const arr = JSON.parse(out.trim());
    if (Array.isArray(arr) && !arr[0]?.error) return arr;
  } catch (e) {
    // Python 失敗或無 PDF 引擎 → 改讀 import_report
  }
  return null;
}

function fromImportReport() {
  const reportPath = path.join(SCRIPTS, "import_report.json");
  if (!fs.existsSync(reportPath)) return null;
  const raw = fs.readFileSync(reportPath, "utf-8");
  const report = JSON.parse(raw);
  if (!Array.isArray(report)) return null;
  return report.map((r) => ({
    file: r.file,
    expected: r.parsed != null ? r.parsed : null,
    evidence: r.parsed != null ? "匯入報告 parsed 題數" : null,
  }));
}

const pdfDir = getPdfDir();
let items = pdfDir ? runPythonExtract(pdfDir) : null;
if (!items || items.length === 0) items = fromImportReport();
if (!items || items.length === 0) {
  console.error("無法取得 PDF 題數：無 raw_pdfs 且無 import_report.json");
  process.exit(1);
}

const totalExpected = items.reduce((sum, r) => sum + (r.expected == null ? 0 : r.expected), 0);
const output = {
  totalExpected,
  generatedAt: new Date().toISOString(),
  source: pdfDir ? "pdf_declaration" : "import_report",
  items,
};

const outPath = path.join(SCRIPTS, "pdf_expected_count.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

console.log("Wrote:", outPath);
console.log("TOTAL_EXPECTED =", totalExpected);
items.forEach((r) => console.log("  ", r.file, "→", r.expected ?? "?", r.evidence ? `(${String(r.evidence).slice(0, 40)}...)` : ""));

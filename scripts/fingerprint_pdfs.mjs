#!/usr/bin/env node
/**
 * 對 raw_pdfs 內 PDF 計算 sha256 + 檔案大小，寫入 scripts/pdf_fingerprints.json。
 * 用於比對「Expected=2037 那批 PDF」是否與本機 raw_pdfs 內容一致。
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");
const OUT_PATH = path.join(SCRIPTS, "pdf_fingerprints.json");

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

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const rawDir = getRawPdfsDir();
if (!rawDir) {
  console.error("[fingerprint_pdfs] 找不到 raw_pdfs 目錄");
  process.exit(1);
}

const files = listPdfs(rawDir);
const items = files.map((f) => {
  const full = path.join(rawDir, f);
  const stat = fs.statSync(full);
  return {
    file: f,
    size: stat.size,
    sha256: sha256File(full),
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  rawPdfsDir: rawDir,
  count: items.length,
  items,
};
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
console.log("Wrote:", OUT_PATH);
console.log("Fingerprinted", items.length, "PDFs");

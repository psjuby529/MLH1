#!/usr/bin/env node
/**
 * 彙總 Expected vs Parsed 差距、指紋、文字診斷，產出 scripts/pdf_rootcause_report.md。
 * 用於一次定位：是否換了 PDF、是否掃描圖、是否題號模式不匹配。
 */
import fs from "fs";
import path from "path";
import { spawnSync, execSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");
const OUT_PATH = path.join(SCRIPTS, "pdf_rootcause_report.md");

function readJson(name) {
  const p = path.join(SCRIPTS, name);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

// 先確保 fingerprint 與 diagnostics 存在
try {
  execSync("node scripts/fingerprint_pdfs.mjs", { cwd: ROOT, stdio: "pipe" });
} catch (e) {}
const py = path.join(ROOT, ".venv", "bin", "python3");
if (fs.existsSync(py)) {
  try {
    spawnSync(py, [path.join(SCRIPTS, "pdf_text_diagnostics.py")], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {}
}

const expectedData = readJson("pdf_expected_count.json");
const importReport = readJson("import_report.json");
const fingerprints = readJson("pdf_fingerprints.json");
const diagnostics = readJson("pdf_text_diagnostics.json");

const expectedByFile = new Map();
if (expectedData && Array.isArray(expectedData.items)) {
  expectedData.items.forEach((x) => {
    if (x && x.file) expectedByFile.set(x.file, x.expected);
  });
}

const parsedByFile = new Map();
if (Array.isArray(importReport)) {
  importReport.forEach((r) => {
    if (r && r.file != null) parsedByFile.set(r.file, r.parsed);
  });
}

const fpByFile = new Map();
if (fingerprints && Array.isArray(fingerprints.items)) {
  fingerprints.items.forEach((x) => {
    if (x && x.file) fpByFile.set(x.file, { size: x.size, sha256: x.sha256 });
  });
}

const diagByFile = new Map();
if (diagnostics && Array.isArray(diagnostics.items)) {
  diagnostics.items.forEach((x) => {
    if (x && x.file) diagByFile.set(x.file, x);
  });
}

const totalExpected = expectedData?.totalExpected ?? 0;
const totalParsed = Array.from(parsedByFile.values()).reduce((s, n) => s + (n || 0), 0);
const gap = totalExpected - totalParsed;

const lines = [];
lines.push("# PDF 根因報告：Expected 與 Imported 不一致");
lines.push("");
lines.push("## 摘要");
lines.push("");
lines.push("| 指標 | 數值 |");
lines.push("|------|------|");
lines.push("| **Expected（宣告/預期）** | " + totalExpected + " |");
lines.push("| **Parsed（本次匯入 import_report 加總）** | " + totalParsed + " |");
lines.push("| **差距** | " + gap + " |");
lines.push("");
lines.push("**結論方向**：");
if (gap > 0) {
  lines.push("- Expected > Parsed → 可能原因：本機 PDF 與「計算 Expected 那批」內容不同（sha256 比對）、或為掃描圖（無文字）、或題號/版式不符解析規則、或**解析器只處理部分頁/題**（需檢查 parser 頁數/題號切分邏輯）。");
} else {
  lines.push("- Parsed ≥ Expected → 題庫已達預期。");
}
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 逐檔：Expected vs Parsed vs 診斷");
lines.push("");
lines.push("| 檔案 | Expected | Parsed | 差距 | 有文字頁/總頁 | 題號模式 | 疑似問題 |");
lines.push("|------|----------|--------|------|----------------|----------|----------|");

const allFiles = new Set([...expectedByFile.keys(), ...parsedByFile.keys(), ...diagByFile.keys()]);
const sortedFiles = Array.from(allFiles).sort();

sortedFiles.forEach((file) => {
  const exp = expectedByFile.get(file);
  const parsed = parsedByFile.get(file);
  const diag = diagByFile.get(file);
  const expStr = exp != null ? String(exp) : "—";
  const parsedStr = parsed != null ? String(parsed) : "—";
  const diff = exp != null && parsed != null ? exp - parsed : "—";
  let pagesStr = "—";
  let patternStr = "—";
  let flag = "";
  if (diag) {
    const total = diag.pages_total || 0;
    const withText = diag.pages_with_text ?? 0;
    pagesStr = total ? `${withText}/${total}` : "0/0";
    patternStr = diag.has_question_number_pattern === true ? "是" : diag.has_question_number_pattern === false ? "否" : "—";
    if (total > 0 && withText === 0) flag = "疑似掃描圖（無文字）";
    else if (total > 0 && withText > 0 && patternStr === "否" && (parsed == null || parsed === 0)) flag = "題號模式不匹配";
    else if (exp != null && parsed != null && exp > parsed) flag = "解析題數少於宣告";
  }
  lines.push("| " + [file, expStr, parsedStr, diff, pagesStr, patternStr, flag].join(" | ") + " |");
});

lines.push("");
lines.push("---");
lines.push("");
lines.push("## 指紋（sha256）— 用於比對是否為同一批 PDF");
lines.push("");
lines.push("若與「當初計算 Expected=2037 的環境」比對 sha256 不一致，則表示本機 PDF 與該批不同。");
lines.push("");

if (fingerprints && Array.isArray(fingerprints.items)) {
  fingerprints.items.slice(0, 5).forEach((x) => {
    lines.push("- **" + x.file + "**: `" + (x.sha256 || "").slice(0, 16) + "…` size=" + x.size);
  });
  if (fingerprints.items.length > 5) {
    lines.push("- … 共 " + fingerprints.items.length + " 份，詳見 `scripts/pdf_fingerprints.json`");
  }
} else {
  lines.push("（未產出 pdf_fingerprints.json，請執行 `node scripts/fingerprint_pdfs.mjs`）");
}

lines.push("");
lines.push("---");
lines.push("");
lines.push("*產出時間: " + new Date().toISOString() + "*");

fs.writeFileSync(OUT_PATH, lines.join("\n"), "utf-8");
console.log("Wrote:", OUT_PATH);

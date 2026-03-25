#!/usr/bin/env node
/**
 * 複選題庫（multi）KPI v2 口徑（與 single 分離）
 * - ImportedThisRunMulti：import_report_multi.json 的 parsed 加總（無檔則 0）
 * - BankTotalThisRunDatasetsMulti：本輪 datasets 對應檔案題數加總
 * - LegacyBankMulti：其餘 public/data/multi/questions_*.json 題數
 * - BankTotalAllMulti：全部 multi 題庫
 * Phase 1：ImportedThisRunMulti === BankTotalThisRunDatasetsMulti、BankTotalAllMulti >= 0
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");

try {
  execSync("node scripts/question_bank_summary_multi.mjs", { cwd: ROOT, encoding: "utf-8", stdio: "pipe" });
} catch (e) {
  // ignore
}

function readJson(relPath) {
  const p = path.join(SCRIPTS, relPath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

const importReportMulti = readJson("import_report_multi.json");
const summaryData = readJson("question_bank_summary_multi.json");

const thisRunFiles = new Set();
let ImportedThisRunMulti = 0;
if (Array.isArray(importReportMulti)) {
  for (const r of importReportMulti) {
    ImportedThisRunMulti += Number(r.parsed) || 0;
    if (r.dataset_id) {
      thisRunFiles.add("public/data/multi/questions_" + r.dataset_id + ".json");
    }
  }
}

const summary = summaryData?.summary ?? [];
let BankTotalThisRunDatasetsMulti = 0;
let LegacyBankMulti = 0;
for (const row of summary) {
  const count = typeof row.count === "number" ? row.count : 0;
  if (thisRunFiles.has(row.file)) {
    BankTotalThisRunDatasetsMulti += count;
  } else {
    LegacyBankMulti += count;
  }
}

const BankTotalAllMulti =
  summaryData?.total ?? BankTotalThisRunDatasetsMulti + LegacyBankMulti;

const bankTotalSource = "ran-summary-multi";

console.log("");
console.log("--- KPI Report Multi (v2) ---");
console.log("ImportedThisRunMulti:", ImportedThisRunMulti);
console.log("BankTotalThisRunDatasetsMulti:", BankTotalThisRunDatasetsMulti);
console.log("LegacyBankMulti:", LegacyBankMulti);
console.log("BankTotalAllMulti:", BankTotalAllMulti);
console.log("bankTotalSource:", bankTotalSource);
console.log("------------------");
console.log("");

if (ImportedThisRunMulti !== BankTotalThisRunDatasetsMulti) {
  console.error(
    `[kpi_report_multi] ImportedThisRunMulti (${ImportedThisRunMulti}) !== BankTotalThisRunDatasetsMulti (${BankTotalThisRunDatasetsMulti})`
  );
  process.exit(1);
}

if (BankTotalAllMulti < 0) {
  console.error(`[kpi_report_multi] BankTotalAllMulti (${BankTotalAllMulti}) < 0`);
  process.exit(1);
}

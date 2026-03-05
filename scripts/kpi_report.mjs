#!/usr/bin/env node
/**
 * KPI 報告（口徑 v2）：
 * - ImportedThisRun：本輪 import_report.json 的 parsed 加總
 * - BankTotalThisRunDatasets：本輪寫入的 questions_<dataset_id>.json 加總
 * - LegacyBank：非本輪寫入但仍存在的題庫題數（如 questions_a/b）
 * - BankTotalAll：全部題庫
 * 簽核規則 v2：ImportedThisRun == BankTotalThisRunDatasets、BankTotalAll ≥ 2037
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");

function ensureFile(name, runScript) {
  const p = path.join(SCRIPTS, name);
  if (!fs.existsSync(p)) {
    try {
      execSync(`node "${path.join(SCRIPTS, runScript)}"`, { cwd: ROOT, stdio: "inherit" });
    } catch (e) {
      // ignore
    }
  }
}

ensureFile("pdf_expected_count.json", "pdf_expected_count.mjs");

// 強制先跑 summary，再讀檔
try {
  execSync("node scripts/question_bank_summary.mjs", { cwd: ROOT, encoding: "utf-8", stdio: "pipe" });
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

const importReport = readJson("import_report.json");
const summaryData = readJson("question_bank_summary.json");

// 本輪寫入的檔名集合（與 import_report 的 dataset_id 對應）
const thisRunFiles = new Set();
let ImportedThisRun = 0;
if (Array.isArray(importReport)) {
  for (const r of importReport) {
    ImportedThisRun += Number(r.parsed) || 0;
    if (r.dataset_id) thisRunFiles.add("public/data/questions_" + r.dataset_id + ".json");
  }
}

const summary = summaryData?.summary ?? [];
let BankTotalThisRunDatasets = 0;
let LegacyBank = 0;
for (const row of summary) {
  const count = row.count ?? 0;
  if (thisRunFiles.has(row.file)) {
    BankTotalThisRunDatasets += count;
  } else {
    LegacyBank += count;
  }
}

const BankTotalAll = summaryData?.total ?? (BankTotalThisRunDatasets + LegacyBank);

console.log("");
console.log("--- KPI Report (v2) ---");
console.log("ImportedThisRun:", ImportedThisRun);
console.log("BankTotalThisRunDatasets:", BankTotalThisRunDatasets);
console.log("LegacyBank:", LegacyBank);
console.log("BankTotalAll:", BankTotalAll);
console.log("------------------");
console.log("");

// v2 簽核：本輪匯入完整性
if (ImportedThisRun !== BankTotalThisRunDatasets) {
  console.error(`[kpi_report] ImportedThisRun (${ImportedThisRun}) !== BankTotalThisRunDatasets (${BankTotalThisRunDatasets})，本輪寫入與題庫不一致。`);
  process.exit(1);
}

// v2 簽核：全站總題量
if (BankTotalAll < 2037) {
  console.error(`[kpi_report] BankTotalAll (${BankTotalAll}) < 2037，未達簽核門檻。`);
  process.exit(1);
}

// 可選：環境變數門檻
const failIfUnder = process.env.KPI_FAIL_IF_BANK_UNDER ? Number(process.env.KPI_FAIL_IF_BANK_UNDER) : 0;
if (failIfUnder > 0 && BankTotalAll < failIfUnder) {
  console.error(`[kpi_report] BankTotalAll (${BankTotalAll}) < ${failIfUnder}，建議修正後再部署。`);
  process.exit(1);
}

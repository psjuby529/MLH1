#!/usr/bin/env node
/**
 * 混合 PDF 匯入 → verify:data → verify:multi → approval:bundle:multi
 * 日誌：scripts/import_last_run_mixed.log
 */
import fs from "fs";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = `${ROOT}/scripts`;
const LOG_PATH = `${SCRIPTS}/import_last_run_mixed.log`;

function run(cmd, inherit = false) {
  return spawnSync(cmd, [], {
    cwd: ROOT,
    encoding: "utf-8",
    shell: true,
    stdio: inherit ? "inherit" : ["inherit", "pipe", "pipe"],
  });
}

console.log("1/4 執行 mixed 匯入（python3 scripts/import_pdfs_mixed.py）→ log import_last_run_mixed.log ...");
const importRun = run(
  "python3 scripts/import_pdfs_mixed.py --input-dir raw_pdfs_mixed",
  false
);
const importOut = [importRun.stdout || "", importRun.stderr || ""].join("\n");
fs.writeFileSync(LOG_PATH, importOut, "utf-8");
console.log("匯入 exit code:", importRun.status);
if (importRun.stdout) process.stdout.write(importRun.stdout);
if (importRun.stderr) process.stderr.write(importRun.stderr);

if (importRun.status !== 0) {
  console.error("mixed 匯入失敗，中止後續驗證。");
  process.exit(importRun.status ?? 1);
}

const mixLine = importOut.split("\n").find((l) => l.includes("MIXED_RUN_TOTAL"));
if (mixLine) console.log("  ", mixLine.trim());

console.log("2/4 verify:data...");
const v1 = run("npm run verify:data", true);
if (v1.status !== 0) process.exit(v1.status ?? 1);

console.log("3/4 verify:multi...");
const v2 = run("npm run verify:multi", false);
if (v2.stdout) process.stdout.write(v2.stdout);
if (v2.stderr) process.stderr.write(v2.stderr);
if (v2.status !== 0) process.exit(v2.status ?? 1);

console.log("4/4 approval:bundle:multi...");
const approval = run("npm run approval:bundle:multi", true);
process.exit(approval.status ?? 0);

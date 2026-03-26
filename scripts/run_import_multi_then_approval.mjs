#!/usr/bin/env node
/**
 * Phase 2A smoke：npm run import:multi（允許無 PDF 時 demo fallback）
 * → summary:multi → verify:multi → kpi:multi → approval:bundle:multi
 * 匯入輸出寫入 scripts/import_last_run_multi.log。
 */
import fs from "fs";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = `${ROOT}/scripts`;
const LOG_PATH = `${SCRIPTS}/import_last_run_multi.log`;

function run(cmd, inherit = false) {
  return spawnSync(cmd, [], {
    cwd: ROOT,
    encoding: "utf-8",
    shell: true,
    stdio: inherit ? "inherit" : ["inherit", "pipe", "pipe"],
  });
}

console.log("1/5 執行 import:multi（smoke，可 demo fallback；log → import_last_run_multi.log）...");
const importRun = run("npm run import:multi", false);
const importOut = [importRun.stdout || "", importRun.stderr || ""].join("\n");
fs.writeFileSync(LOG_PATH, importOut, "utf-8");
console.log("匯入 exit code:", importRun.status);

if (importRun.status !== 0) {
  console.error("import:multi 失敗，中止。");
  process.exit(importRun.status ?? 1);
}

const fiveLines = importOut.split("\n").filter((line) =>
  /^IMPORT_OUTPUT_JSON_MULTI=|^wroteIndexMulti=|^wroteQuestionsFilesCountMulti=|^wroteQuestionsFilesSampleMulti=|^totalWrittenQuestionsMulti=/.test(
    line.trim()
  )
);
if (fiveLines.length) {
  console.log("診斷 5 行（multi）：");
  fiveLines.forEach((l) => console.log("  ", l));
}

console.log("2/5 summary:multi...");
const sum = run("npm run summary:multi", true);
if (sum.status !== 0) process.exit(sum.status ?? 1);

console.log("3/5 verify:multi...");
const verify = run("npm run verify:multi", false);
if (verify.stdout) process.stdout.write(verify.stdout);
if (verify.stderr) process.stderr.write(verify.stderr);
if (verify.status !== 0) process.exit(verify.status ?? 1);

console.log("4/5 kpi:multi...");
const kpi = run("npm run kpi:multi", false);
if (kpi.stdout) process.stdout.write(kpi.stdout);
if (kpi.stderr) process.stderr.write(kpi.stderr);
if (kpi.status !== 0) process.exit(kpi.status ?? 1);

console.log("5/5 approval:bundle:multi...");
const approval = run("npm run approval:bundle:multi", true);
process.exit(approval.status ?? 0);

#!/usr/bin/env node
/**
 * 一鍵：跑匯入 → 跑簽核包。匯入 stdout/stderr 寫入 scripts/import_last_run.log，方便 PR 貼 5 行診斷。
 * 若匯入失敗（例如缺 PDF 套件），仍會寫 log，再跑 approval:bundle（會是未達標結果）。
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");
const LOG_PATH = path.join(SCRIPTS, "import_last_run.log");

console.log("1/2 執行匯入（log 寫入 " + LOG_PATH + "）...");
const importRun = spawnSync(
  "npm run import:allpdf",
  [],
  { cwd: ROOT, encoding: "utf-8", shell: true, stdio: ["inherit", "pipe", "pipe"] }
);
const importOut = [importRun.stdout || "", importRun.stderr || ""].join("\n");
fs.writeFileSync(LOG_PATH, importOut, "utf-8");
console.log("匯入 exit code:", importRun.status);

if (importOut) {
  const fiveLines = importOut.split("\n").filter((line) =>
    /^IMPORT_OUTPUT_JSON=|^wroteIndex=|^wroteQuestionsFilesCount=|^wroteQuestionsFilesSample=|^totalWrittenQuestions=/.test(line)
  );
  if (fiveLines.length) {
    console.log("診斷 5 行已寫入 log，可貼至 PR 頂部：");
    fiveLines.forEach((l) => console.log("  ", l));
  }
}

console.log("2/5 執行 summary:questions（更新題庫總數）...");
spawnSync("npm run summary:questions", [], { cwd: ROOT, encoding: "utf-8", shell: true, stdio: "pipe" });
console.log("3/5 執行 verify:data...");
const verify = spawnSync("npm run verify:data", [], { cwd: ROOT, encoding: "utf-8", shell: true, stdio: "pipe" });
if (verify.status !== 0) {
  console.error(verify.stdout || verify.stderr || "verify:data failed");
  process.exit(verify.status ?? 1);
}
console.log("4/5 執行 kpi:report...");
const kpi = spawnSync("npm run kpi:report", [], { cwd: ROOT, encoding: "utf-8", shell: true, stdio: "pipe" });
if (kpi.stdout) process.stdout.write(kpi.stdout);
if (kpi.stderr) process.stderr.write(kpi.stderr);
console.log("5/5 執行 approval:bundle...");
const approval = spawnSync("npm run approval:bundle", [], {
  cwd: ROOT,
  encoding: "utf-8",
  shell: true,
  stdio: "inherit",
});
process.exit(approval.status ?? 0);

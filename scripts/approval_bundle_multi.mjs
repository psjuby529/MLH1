#!/usr/bin/env node
/**
 * 複選題庫（multi）簽核包：產出 scripts/approval_bundle_multi.txt
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");
const OUT_PATH = path.join(SCRIPTS, "approval_bundle_multi.txt");
const MERGE_COMMENT_OUT = path.join(SCRIPTS, "pr_comment_merge_check_multi.md");

function run(command) {
  const c = spawnSync(command, [], {
    cwd: ROOT,
    encoding: "utf-8",
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });
  const out = [c.stdout || "", c.stderr || ""].filter(Boolean).join("\n").trim();
  return { out, code: c.status };
}

const lines = [];

lines.push("=== 小LIN 簽核包 multi（Phase 1 管線）===");
lines.push("產出時間: " + new Date().toISOString());
lines.push("");

lines.push("--- 1) npm run kpi:multi ---");
const kpi = run("npm run kpi:multi");
lines.push(kpi.out);
if (kpi.code !== 0) lines.push("(exit code: " + kpi.code + ")");
lines.push("");

lines.push("--- 2) npm run summary:multi (TOTAL) ---");
const summary = run("npm run summary:multi");
lines.push(summary.out);
lines.push("");

lines.push("--- 3) ls -lt public/data/multi（略過 verify_result_multi.json）---");
const ls = run("ls -lt public/data/multi");
if (ls.out) {
  const rows = ls.out.split("\n").filter((line) => !line.includes("verify_result_multi.json"));
  lines.push(rows.slice(0, 5).join("\n"));
} else {
  lines.push("(目錄不存在或無法讀取)");
}
lines.push("");

lines.push("--- 4) npm run verify:multi ---");
const verify = run("npm run verify:multi");
lines.push(verify.out);
if (verify.code !== 0) lines.push("(exit code: " + verify.code + ")");
lines.push("");

lines.push("=== 簽核標準 multi v2（Phase 1）===");
lines.push("ImportedThisRunMulti == BankTotalThisRunDatasetsMulti");
lines.push("BankTotalAllMulti >= 0");
lines.push("verify:multi error_count == 0");
lines.push("public/data/multi 結構完整（meta + index）");

const content = lines.join("\n");
fs.writeFileSync(OUT_PATH, content, "utf-8");
console.log("Wrote:", path.relative(ROOT, OUT_PATH) || OUT_PATH);

if (verify.code !== 0) {
  process.exit(verify.code ?? 1);
}

function parseErrorCount(verifyStdout) {
  const m = verifyStdout.match(/error_count:\s*(\d+)/);
  return m ? m[1] : "?";
}

function readSummaryTotal() {
  const p = path.join(SCRIPTS, "question_bank_summary_multi.json");
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (typeof j.total === "number") return String(j.total);
  } catch {
    /* ignore */
  }
  return "?";
}

function gitHeadSha() {
  const g = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (g.status === 0 && g.stdout) return g.stdout.trim();
  return "（無法取得：非 git 目錄或 git 不可用）";
}

const errorCountStr = parseErrorCount(verify.out);
const totalMulti = readSummaryTotal();
const sha = gitHeadSha();

const mergeComment = [
  "### 合併前補充（Vercel + multi 簽核精簡）",
  "",
  "- **Vercel Preview URL**：`（請從 Vercel Dashboard 複製本 PR 的 Preview 網址；若無則填：無／僅 Production）`",
  "- **驗證 commit**：`" + sha + "`",
  "",
  "- **`npm run approval:bundle:multi`（精簡結果）**",
  "  - `verify:multi` → **`error_count: " + errorCountStr + "`**",
  "  - `summary:multi` → **`TOTAL (multi): " + totalMulti + "`**",
  "",
  "以上於本機／CI 在 **與本 PR 相同 commit** 上執行；**Build OK** 與完整簽核包仍以 PR 描述為準。",
  "Reviewer 一眼可確認：有 Preview 可點、數字與 Phase 1 預期一致、error_count=0 → 可安心 Merge。",
  "",
  "> 可選：若希望後續更自動化，可在 Vercel Preview 的 Build 後加跑 `npm run approval:bundle:multi`，再把 error_count / TOTAL 從 Build Log 複製貼到此 comment。",
  "",
].join("\n");

fs.writeFileSync(MERGE_COMMENT_OUT, mergeComment, "utf-8");
console.log("Wrote:", path.relative(ROOT, MERGE_COMMENT_OUT) || MERGE_COMMENT_OUT);

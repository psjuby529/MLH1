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
console.log("Wrote:", OUT_PATH);

if (verify.code !== 0) {
  process.exit(verify.code ?? 1);
}

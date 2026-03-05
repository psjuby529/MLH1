#!/usr/bin/env node
/**
 * 小LIN 簽核包 v1：產出 scripts/approval_bundle.txt，內含三段結果。
 * 匯入結束後執行 npm run approval:bundle，PR 描述直接貼該檔內容。
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, "scripts");
const OUT_PATH = path.join(SCRIPTS, "approval_bundle.txt");

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

lines.push("=== 小LIN 簽核包 v1 ===");
lines.push("產出時間: " + new Date().toISOString());
lines.push("");

// 1) npm run kpi:report（即使 exit code != 0 也寫入）
lines.push("--- 1) npm run kpi:report ---");
const kpi = run("npm run kpi:report");
lines.push(kpi.out);
if (kpi.code !== 0) lines.push("(exit code: " + kpi.code + ")");
lines.push("");

// 2) npm run summary:questions（TOTAL）
lines.push("--- 2) npm run summary:questions (TOTAL) ---");
const summary = run("npm run summary:questions");
lines.push(summary.out);
lines.push("");

// 3) ls -lt public/data | head -n 5
lines.push("--- 3) ls -lt public/data | head -n 5 ---");
const ls = run("ls -lt public/data");
if (ls.out) {
  const head5 = ls.out.split("\n").slice(0, 5).join("\n");
  lines.push(head5);
} else {
  lines.push("(目錄不存在或無法讀取)");
}
lines.push("");
lines.push("=== 簽核標準：Diff=0、TOTAL≥2037、public/data 時間為匯入後 ===");

const content = lines.join("\n");
fs.writeFileSync(OUT_PATH, content, "utf-8");
console.log("Wrote:", OUT_PATH);

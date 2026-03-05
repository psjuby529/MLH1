#!/usr/bin/env node
/**
 * 讀取 scripts/parser_debug/*.json，產出 scripts/parser_debug/<pdf>_before_after.md（或 summary）。
 * 用於單檔回歸：對比修 parser 前後的 detected_question_count / parsed_questions_count / drop_reasons_top。
 */
import fs from "fs";
import path from "path";

const SCRIPTS = path.join(process.cwd(), "scripts");
const DEBUG_DIR = path.join(SCRIPTS, "parser_debug");

if (!fs.existsSync(DEBUG_DIR)) {
  console.log("scripts/parser_debug 不存在，請先跑單檔或全量匯入。");
  process.exit(0);
}

const files = fs.readdirSync(DEBUG_DIR).filter((f) => f.endsWith(".json"));
const lines = ["# Parser Debug 摘要（before/after 對比）", ""];

for (const f of files.sort()) {
  const p = path.join(DEBUG_DIR, f);
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  const name = data.file || f.replace(/\.json$/, "");
  lines.push("## " + name);
  lines.push("");
  lines.push("- **detected_question_count**: " + (data.detected_question_count ?? "—"));
  lines.push("- **parsed_questions_count**: " + (data.parsed_questions_count ?? "—"));
  lines.push("- **top_drop_reasons**: " + JSON.stringify(data.drop_reasons_top || {}));
  lines.push("");
}

const outPath = path.join(DEBUG_DIR, "summary_before_after.md");
fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log("Wrote:", outPath);

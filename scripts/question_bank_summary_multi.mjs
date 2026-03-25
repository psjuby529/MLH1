/**
 * 複選題庫（multi）題數彙總：僅掃描 public/data/multi/questions_*.json
 */
import fs from "fs";
import path from "path";

function countQuestions(json) {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === "object") {
    if (Array.isArray(json.questions)) return json.questions.length;
    if (Array.isArray(json.items)) return json.items.length;
    let n = 0;
    for (const v of Object.values(json)) if (Array.isArray(v)) n += v.length;
    return n;
  }
  return 0;
}

const dir = path.join(process.cwd(), "public", "data", "multi");
const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => /^questions_.*\.json$/i.test(f))
  : [];

const summary = [];
let total = 0;

for (const f of files.sort()) {
  const p = path.join(dir, f);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw);
    const n = countQuestions(json);
    total += n;
    summary.push({ file: `public/data/multi/${f}`, count: n });
  } catch (e) {
    summary.push({ file: `public/data/multi/${f}`, error: String(e) });
  }
}

const outPath = path.join(process.cwd(), "scripts", "question_bank_summary_multi.json");
fs.writeFileSync(outPath, JSON.stringify({ total, summary, bank_kind: "multi" }, null, 2), "utf-8");

console.log("Wrote:", path.relative(process.cwd(), outPath) || outPath);
console.log("TOTAL (multi):", total);
for (const row of summary) console.log(row.file, row.count ?? row.error);

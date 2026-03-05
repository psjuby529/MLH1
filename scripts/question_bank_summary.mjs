import fs from "fs";
import path from "path";

function countQuestions(json) {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === "object") {
    if (Array.isArray(json.questions)) return json.questions.length;
    if (Array.isArray(json.items)) return json.items.length;
    // fallback: sum list-like values
    let n = 0;
    for (const v of Object.values(json)) if (Array.isArray(v)) n += v.length;
    return n;
  }
  return 0;
}

const dir = path.join(process.cwd(), "public", "data");
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
    summary.push({ file: `public/data/${f}`, count: n });
  } catch (e) {
    summary.push({ file: `public/data/${f}`, error: String(e) });
  }
}

const outDir = path.join(process.cwd(), "scripts");
const outPath = path.join(outDir, "question_bank_summary.json");
fs.writeFileSync(outPath, JSON.stringify({ total, summary }, null, 2), "utf-8");

console.log("Wrote:", outPath);
console.log("TOTAL:", total);
for (const row of summary) console.log(row.file, row.count ?? row.error);

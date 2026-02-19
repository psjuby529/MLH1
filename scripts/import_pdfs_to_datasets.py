#!/usr/bin/env python3
"""
MLH Quiz v1.2 — 將 raw_pdfs/ 內 PDF 轉成 public/data/questions_<id>.json，
並更新 public/data/index.json、產出 scripts/import_report.json。
依賴：pip install pymupdf
執行：在專案根目錄執行
  python3 scripts/import_pdfs_to_datasets.py [--input-dir raw_pdfs] [--output-dir public/data]
若 PDF 資料夾名稱含冒號（如 raw_pdfs:）請用：
  python3 scripts/import_pdfs_to_datasets.py --input-dir "raw_pdfs:"
"""
from __future__ import annotations

import argparse
import json
import re
import os
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None  # type: ignore

# 專案根目錄 = 本腳本所在目錄的上一層
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = "raw_pdfs"
DEFAULT_OUTPUT = "public/data"


def slug_from_filename(name: str) -> str:
    """從檔名取得簡短 id（用於 dataset id 與檔名）。"""
    base = Path(name).stem.strip()
    # 去掉常見後綴與空格，只留數字或簡短代碼
    base = re.sub(r"\s+", "_", base)
    if re.match(r"^\d+", base):
        # 例如 "105-126002工程管理學科" -> 105
        m = re.match(r"^(\d+)", base)
        if m:
            return m.group(1)
    # 例如 "綜合A" -> 綜合A
    return base[:20] if len(base) > 20 else base


def extract_text_from_pdf(path: Path) -> list[tuple[int, str]]:
    """回傳 (page_1based, text) 列表。"""
    if not fitz:
        return []
    doc = fitz.open(path)
    out = []
    for i, page in enumerate(doc):
        out.append((i + 1, page.get_text()))
    doc.close()
    return out


# 題目開頭：數字.(答案) 或 數字.（答案）
QUESTION_HEAD = re.compile(r"^(\d+)[.．]\s*[（(]?([①②③④])[）)]?\s*", re.MULTILINE)
OPTION_MARK = re.compile(r"[①②③④]")

ANSWER_MAP = {"①": 0, "②": 1, "③": 2, "④": 3}


def parse_questions_from_text(full_text: str, source_prefix: str) -> list[dict]:
    """從合併後的全文解析題目，source_prefix 如 '106學科.pdf#p3'。"""
    questions = []
    # 以 題號.(答案) 切出區塊
    parts = QUESTION_HEAD.split(full_text)
    # parts[0] 為開頭雜文，之後 [題號, 答案, 題幹+選項, 題號, 答案, ...]
    i = 1
    while i + 2 <= len(parts):
        q_num = parts[i].strip()
        ans_char = parts[i + 1].strip()
        block = parts[i + 2] if i + 2 < len(parts) else ""
        i += 3

        if not q_num.isdigit() or ans_char not in ANSWER_MAP:
            continue

        # 選項以 ①②③④ 切（保留符號後的內容）
        opts = []
        for m in OPTION_MARK.finditer(block):
            start = m.start()
            # 取此符號到下一個 ①②③④ 或結尾
            end = len(block)
            next_m = OPTION_MARK.search(block, start + 1)
            if next_m:
                end = next_m.start()
            opts.append((m.group(), block[start:end].replace(m.group(), "", 1).strip()))
        # 依 ①②③④ 排序成 [A,B,C,D]
        ordered = [None, None, None, None]
        for ch, text in opts:
            idx = ANSWER_MAP.get(ch)
            if idx is not None and 0 <= idx <= 3:
                ordered[idx] = text[:500] if text else ""
        if None in ordered or not all(ordered):
            continue
        first_opt = block.find("①")
        question_text = (block[:first_opt].strip() if first_opt >= 0 else block.strip())[:2000] or "（題幹解析略）"

        q_id = f"{q_num}"
        questions.append({
            "id": q_id,
            "subject": "室內裝修工程管理",
            "year": int(q_num) if q_num.isdigit() and len(q_num) <= 4 else None,
            "chapter": "ALL",
            "type": "single",
            "question_text": question_text,
            "options": ordered,
            "answer_index": ANSWER_MAP[ans_char],
            "explanation": "",
            "source": f"{source_prefix}#Q{q_num}",
        })
    return questions


def process_pdf(input_dir: Path, output_dir: Path, pdf_path: Path, report: list) -> tuple[str, list[dict]]:
    """處理單一 PDF，回傳 (dataset_id, questions)。"""
    dataset_id = slug_from_filename(pdf_path.name)
    pages_text = extract_text_from_pdf(pdf_path)
    if not pages_text:
        report.append({
            "file": pdf_path.name,
            "dataset_id": dataset_id,
            "parsed": 0,
            "failed": 0,
            "image_questions": [],
            "error": "PyMuPDF not installed or no text extracted",
        })
        return dataset_id, []

    full_text = "\n".join(t for _, t in pages_text)
    all_questions = []
    for page_no, text in pages_text:
        prefix = f"{pdf_path.name}#p{page_no}"
        qs = parse_questions_from_text(text, prefix)
        for q in qs:
            q["id"] = f"{dataset_id}_{q['id']}"
            q["source"] = f"{pdf_path.name}#p{page_no}#Q{q['source'].split('#Q')[-1]}"
            all_questions.append(q)

    # 若分頁解析結果太少，改為全文解析一次
    if len(all_questions) < 3 and len(pages_text) > 0:
        full_prefix = f"{pdf_path.name}"
        qs = parse_questions_from_text(full_text, full_prefix)
        seen = set()
        all_questions = []
        for q in qs:
            uid = f"{dataset_id}_{q['id']}"
            if uid in seen:
                continue
            seen.add(uid)
            q["id"] = uid
            all_questions.append(q)

    report.append({
        "file": pdf_path.name,
        "dataset_id": dataset_id,
        "parsed": len(all_questions),
        "failed": 0,
        "image_questions": [],
    })
    return dataset_id, all_questions


def main() -> None:
    parser = argparse.ArgumentParser(description="MLH Quiz: PDF → JSON 題庫")
    parser.add_argument("--input-dir", default=DEFAULT_INPUT, help="PDF 所在資料夾（相對專案根）")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT, help="輸出目錄（相對專案根）")
    args = parser.parse_args()

    input_dir = ROOT / args.input_dir
    output_dir = ROOT / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if not fitz:
        print("請先安裝 PyMuPDF: pip install pymupdf")
        return

    if not input_dir.is_dir():
        print(f"找不到輸入目錄: {input_dir}")
        return

    pdf_files = sorted(input_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"在 {input_dir} 下沒有找到 .pdf 檔案")
        return

    report = []
    datasets = []
    existing_index_path = output_dir / "index.json"
    if existing_index_path.exists():
        try:
            data = json.loads(existing_index_path.read_text(encoding="utf-8"))
            for d in data.get("datasets", []):
                if d["id"] == "v1":
                    datasets.append(d)
                    break
        except Exception:
            pass
    if not any(d["id"] == "v1" for d in datasets):
        datasets.append({"id": "v1", "label": "v1 測試題庫", "file": "questions_v1.json"})

    for pdf_path in pdf_files:
        dataset_id, questions = process_pdf(input_dir, output_dir, pdf_path, report)
        out_file = output_dir / f"questions_{dataset_id}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        label = pdf_path.stem[:30]
        datasets.append({"id": dataset_id, "label": label, "file": f"questions_{dataset_id}.json"})
        print(f"  {pdf_path.name} -> {out_file.name} ({len(questions)} 題)")

    index = {"datasets": datasets, "default_dataset": "ALL"}
    (output_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    report_path = ROOT / "scripts" / "import_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"index.json、各 questions_*.json 已寫入 {output_dir}")
    print(f"import_report.json 已寫入 {report_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MLH Quiz — multi（複選）題庫匯入：PDF → public/data/multi/
與 single（import_pdfs_to_datasets.py）分離；複用其文字擷取與題塊切分。

輸出：index.json、questions_<slug>.json、meta.json、scripts/import_report_multi.json
診斷 5 行：IMPORT_OUTPUT_JSON_MULTI=、wroteIndexMulti=、…
Phase 2A：無 PDF 時可自動寫入 Demo（stderr WARNING）— 僅管線 smoke，非正式題庫。
Phase 2B：請使用 --no-demo-fallback（npm import:multi:real），無 PDF 即失敗。
"""
from __future__ import print_function, unicode_literals

import argparse
import importlib.util
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_MULTI = ROOT / "public" / "data" / "multi"
DEFAULT_INPUT_MULTI = "raw_pdfs_multi"

NUM_TO_LETTER = {"1": "A", "2": "B", "3": "C", "4": "D"}
CIRCLED_TO_NUM = {"①": "1", "②": "2", "③": "3", "④": "4"}


def load_single_module():
    p = ROOT / "scripts" / "import_pdfs_to_datasets.py"
    spec = importlib.util.spec_from_file_location("import_pdfs_single", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _norm_letters(seq):
    out = []
    for x in seq:
        u = str(x).strip().upper()
        if u in ("A", "B", "C", "D"):
            out.append(u)
    seen = set()
    res = []
    for a in out:
        if a not in seen:
            seen.add(a)
            res.append(a)
    return res


def extract_multi_correct_answers(block):
    """v1：見 docs/MULTI_PIPELINE.md「答案解析」。"""
    head = block[:280]

    digits = re.findall(r"[（(]\s*([1-4])\s*[)）]", head)
    if len(digits) >= 2:
        letters = _norm_letters([NUM_TO_LETTER[d] for d in digits])
        if len(letters) >= 2:
            return letters, "paren_digits"

    lets = re.findall(r"[（(]\s*([A-Da-d])\s*[)）]", head)
    if len(lets) >= 2:
        letters = _norm_letters(lets)
        if len(letters) >= 2:
            return letters, "paren_letters"

    circ = []
    for ch in head:
        if ch in CIRCLED_TO_NUM:
            circ.append(CIRCLED_TO_NUM[ch])
    if len(circ) >= 2:
        letters = _norm_letters([NUM_TO_LETTER[d] for d in circ])
        if len(letters) >= 2:
            return letters, "circled_digits"

    tail = re.sub(r"^\s*\d+[\.．\、\)）]?\s*", "", head, count=1)
    tail = re.sub(r"^\s*\d+[\.．\、\)）]?\s*\([1-4]\)\s*", "", tail, count=1)

    m_ans_d = re.search(
        r"(?:答案|參考答案|答)\s*[：:]\s*([1-4])\s*[,、，\s]+\s*([1-4])",
        tail[:120],
        re.IGNORECASE,
    )
    if m_ans_d:
        letters = _norm_letters([NUM_TO_LETTER[m_ans_d.group(1)], NUM_TO_LETTER[m_ans_d.group(2)]])
        if len(letters) >= 2:
            return letters, "answer_colon_digits"

    m_ans_l = re.search(
        r"(?:答案|參考答案|答)\s*[：:]\s*([A-Da-d])\s*[,、，\s]+\s*([A-Da-d])",
        tail[:120],
        re.IGNORECASE,
    )
    if m_ans_l:
        letters = _norm_letters([m_ans_l.group(1), m_ans_l.group(2)])
        if len(letters) >= 2:
            return letters, "answer_colon_letters"

    m_sep = re.search(r"\b([A-Da-d])\s*[,、，\s]+\s*([A-Da-d])\b", tail[:100])
    if m_sep:
        letters = _norm_letters([m_sep.group(1), m_sep.group(2)])
        if len(letters) >= 2:
            return letters, "sep_letters"

    m_adj = re.search(r"(?<![A-Za-z])([A-Da-d])([A-Da-d])(?![A-Za-z])", tail[:50])
    if m_adj:
        letters = _norm_letters([m_adj.group(1), m_adj.group(2)])
        if len(letters) >= 2:
            return letters, "adjacent_letters"

    return None, None


def parse_multi_questions_from_text(full_text, slug, page_no, drop_reasons, S):
    questions = []
    parse_failed = []
    cross_question_suspects = []
    blocks = S._split_blocks_by_line_start_question(full_text)

    for q_num, block in blocks:
        if not q_num.isdigit():
            drop_reasons["qno_not_digit"] = drop_reasons.get("qno_not_digit", 0) + 1
            continue
        if len(block) < 5:
            drop_reasons["block_too_short"] = drop_reasons.get("block_too_short", 0) + 1
            continue

        question_text = None
        ordered = None
        if "①" in block or "②" in block or "③" in block or "④" in block:
            question_text, ordered = S._split_options_circled(block)
        if ordered is None:
            question_text, ordered = S._split_options_abcd(block)
        if ordered is None:
            question_text, ordered = S._split_options_numbered(block)
        options_placeholder = False
        if ordered is None or len(ordered) != 4 or not all(ordered):
            question_text = (block[:2000].strip() or "（題幹略）")
            ordered = ["(選項未辨識)"] * 4
            drop_reasons["options_placeholder"] = drop_reasons.get("options_placeholder", 0) + 1
            options_placeholder = True
        else:
            ordered = [o or "(選項未辨識)" for o in ordered]

        question_text = question_text or "（題幹解析略）"
        question_text = re.sub(
            r"^\s*\d+[\.．\、\)）]?\s*\([1-4]\)\s*", "", question_text
        ).strip() or question_text

        cross_suspects_here = []
        q_trimmed, snip = S._trim_tail_at_next_question_or_header(question_text)
        if snip:
            cross_suspects_here.append(
                {
                    "slug": slug,
                    "qno": q_num,
                    "reason": "next_question_or_header_in_stem",
                    "snippet": snip[:80],
                }
            )
        question_text = q_trimmed or question_text
        for i, opt in enumerate(ordered):
            opt_trimmed, snip = S._trim_tail_at_next_question_or_header(opt)
            if snip:
                cross_suspects_here.append(
                    {
                        "slug": slug,
                        "qno": q_num,
                        "reason": "next_question_or_header_in_option",
                        "snippet": snip[:80],
                    }
                )
            ordered[i] = opt_trimmed or opt

        letters, method = extract_multi_correct_answers(block)
        multi_parse_flags = {}
        if not letters or len(letters) < 2:
            letters = ["A", "B"]
            multi_parse_flags["answer_placeholder"] = True
            drop_reasons["answer_placeholder"] = drop_reasons.get("answer_placeholder", 0) + 1
        else:
            multi_parse_flags["answer_parse_method"] = method

        if options_placeholder:
            multi_parse_flags["options_placeholder"] = True

        explanation = S._extract_explanation(block)
        if page_no is not None:
            source = "{}#p{}#Q{}".format(slug, page_no, q_num)
            source_display = "{} 第{}頁 第{}題".format(
                S.slug_to_label(slug), page_no, q_num
            )
        else:
            source = "{}#Q{}".format(slug, q_num)
            source_display = "{} 第{}題".format(S.slug_to_label(slug), q_num)

        qobj = {
            "id": q_num,
            "question_type": "multi",
            "question_text": question_text,
            "options": ordered,
            "correct_answers": letters,
            "explanation": explanation or "",
            "source": source,
            "source_display": source_display,
        }
        if multi_parse_flags:
            qobj["multi_parse_flags"] = multi_parse_flags

        questions.append(qobj)
        for s in cross_suspects_here:
            cross_question_suspects.append(
                {
                    "dataset_id": slug,
                    "qno": q_num,
                    "reason": s["reason"],
                    "snippet": s["snippet"],
                }
            )

    return questions, parse_failed, cross_question_suspects


def process_pdf_multi(S, pdf_path, report):
    raw_id = S.slug_from_filename(pdf_path.name)
    slug = S.to_ascii_slug(raw_id)
    print("    [multi] 解析文字...", end=" ", flush=True)
    pages_text = S.extract_text_from_pdf(pdf_path)
    if not pages_text:
        print("(無文字)", flush=True)
        report.append(
            {
                "file": pdf_path.name,
                "dataset_id": slug,
                "parsed": 0,
                "errors": ["無法擷取 PDF 文字"],
                "suspicious_count": 0,
                "parse_failed_count": 0,
                "parse_failed": [],
                "cross_question_suspects_count": 0,
                "cross_question_suspects": [],
            }
        )
        return slug, []

    full_text = "\n".join(t for _, t in pages_text)
    drop_reasons_merged = {}
    all_questions = []
    all_parse_failed = []
    all_cross_suspects = []

    if len(pages_text) > 1:
        qs, failed, cross = parse_multi_questions_from_text(
            full_text, slug, None, drop_reasons_merged, S
        )
        all_parse_failed.extend(failed)
        all_cross_suspects.extend(cross)
        for q in qs:
            q["id"] = slug + "_" + q["id"]
            all_questions.append(q)
    else:
        for page_no, text in pages_text:
            text_cleaned = S._strip_header_footer(text)
            qs, failed, cross = parse_multi_questions_from_text(
                text_cleaned, slug, page_no, drop_reasons_merged, S
            )
            all_parse_failed.extend(failed)
            all_cross_suspects.extend(cross)
            for q in qs:
                q["id"] = slug + "_" + q["id"]
                all_questions.append(q)

    full_cleaned = S._strip_header_footer(full_text)
    if len(all_questions) < 3 and len(pages_text) > 0:
        qs, failed, cross = parse_multi_questions_from_text(
            full_cleaned, slug, None, drop_reasons_merged, S
        )
        all_parse_failed.extend(failed)
        all_cross_suspects.extend(cross)
        seen = set()
        all_questions = []
        for q in qs:
            uid = slug + "_" + q["id"]
            if uid in seen:
                continue
            seen.add(uid)
            q["id"] = uid
            all_questions.append(q)

    suspicious_count = sum(
        1
        for q in all_questions
        if q.get("multi_parse_flags", {}).get("answer_placeholder")
        or q.get("multi_parse_flags", {}).get("options_placeholder")
    )

    dbg_dir = ROOT / "scripts" / "parser_debug_multi"
    dbg_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^\w\-.]", "_", pdf_path.name)
    dbg_path = dbg_dir / (safe_name + ".json")
    with open(dbg_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "bank_kind": "multi",
                "file": pdf_path.name,
                "dataset_id": slug,
                "parsed": len(all_questions),
                "drop_reasons": drop_reasons_merged,
                "suspicious_count": suspicious_count,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    report.append(
        {
            "file": pdf_path.name,
            "dataset_id": slug,
            "parsed": len(all_questions),
            "parse_failed_count": len(all_parse_failed),
            "parse_failed": all_parse_failed,
            "cross_question_suspects_count": len(all_cross_suspects),
            "cross_question_suspects": all_cross_suspects,
            "errors": [],
            "suspicious_count": suspicious_count,
        }
    )
    print("{} 題".format(len(all_questions)), flush=True)
    return slug, all_questions


def backup_multi_dir(multi_dir):
    if not multi_dir.is_dir() or not any(multi_dir.iterdir()):
        return
    backup_root = ROOT / "scripts" / "backup"
    backup_root.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    dest = backup_root / ts / "public_data_multi"
    try:
        shutil.copytree(multi_dir, dest)
        print("已備份 {} -> {}".format(multi_dir, dest), flush=True)
    except Exception as e:
        print("備份警告: {}（繼續匯入）".format(e), flush=True)


def write_demo_questions():
    """最小 Demo：2 題合法 multi，verify 可過。"""
    slug = "multidemo"
    questions = [
        {
            "id": slug + "_1",
            "question_type": "multi",
            "question_text": "（Demo）複選題示範：請選兩個以上正確選項。",
            "options": ["第一選項", "第二選項", "第三選項", "第四選項"],
            "correct_answers": ["A", "C"],
            "explanation": "示範用題，非考古原文。",
            "source": "demo#Q1",
            "source_display": "Multi Demo 第1題",
            "multi_parse_flags": {"demo": True},
        },
        {
            "id": slug + "_2",
            "question_type": "multi",
            "question_text": "（Demo）第二題：答案格式 (B)(D)。",
            "options": ["選項甲", "選項乙", "選項丙", "選項丁"],
            "correct_answers": ["B", "D"],
            "explanation": "",
            "source": "demo#Q2",
            "source_display": "Multi Demo 第2題",
            "multi_parse_flags": {"demo": True},
        },
    ]
    OUTPUT_MULTI.mkdir(parents=True, exist_ok=True)
    backup_multi_dir(OUTPUT_MULTI)
    out_file = OUTPUT_MULTI / ("questions_" + slug + ".json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    datasets = [{"id": slug, "label": "Multi Demo", "file": "questions_" + slug + ".json"}]
    index = {"bank_kind": "multi", "datasets": datasets, "default_dataset": "ALL"}
    with open(OUTPUT_MULTI / "index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    data_version = datetime.now().strftime("%Y-%m-%d-%H%M")
    meta = {
        "data_version": data_version,
        "generated_at": datetime.now().isoformat(),
        "bank_kind": "multi",
    }
    with open(OUTPUT_MULTI / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    report = [
        {
            "file": "__demo__",
            "dataset_id": slug,
            "parsed": len(questions),
            "errors": [],
            "suspicious_count": 0,
            "parse_failed_count": 0,
            "parse_failed": [],
            "cross_question_suspects_count": 0,
            "cross_question_suspects": [],
        }
    ]
    report_path = ROOT / "scripts" / "import_report_multi.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    wrote_files = [str(out_file.resolve())]
    total_q = len(questions)
    index_abs = str((OUTPUT_MULTI / "index.json").resolve())
    return wrote_files, total_q, index_abs


def print_five_lines(output_root, wrote_files, total_q, index_abs):
    import_output = {
        "outputRoot": output_root,
        "wroteQuestionsFiles": wrote_files,
        "wroteIndex": index_abs,
        "totalWrittenQuestions": total_q,
    }
    print("IMPORT_OUTPUT_JSON_MULTI: {}".format(json.dumps(import_output, ensure_ascii=False)))
    print("IMPORT_OUTPUT_JSON_MULTI={}".format(output_root), flush=True)
    print("wroteIndexMulti={}".format(import_output["wroteIndex"]), flush=True)
    print("wroteQuestionsFilesCountMulti={}".format(len(wrote_files)), flush=True)
    print("wroteQuestionsFilesSampleMulti={}".format(wrote_files[:3]), flush=True)
    print("totalWrittenQuestionsMulti={}".format(total_q), flush=True)


def main():
    global ROOT, OUTPUT_MULTI
    parser = argparse.ArgumentParser(description="MLH Quiz: PDF → multi 複選題庫")
    parser.add_argument("--input-dir", default=DEFAULT_INPUT_MULTI, help="複選 PDF 目錄（相對專案根）")
    parser.add_argument("--root", default=None, help="專案根目錄")
    parser.add_argument("--demo", action="store_true", help="僅寫入 Demo 題庫")
    parser.add_argument("--pdf", default=None, help="僅處理指定檔名")
    parser.add_argument(
        "--no-demo-fallback",
        action="store_true",
        help="目錄無 PDF 時不寫 Demo，改為失敗（exit 1）",
    )
    args = parser.parse_args()

    if args.root:
        ROOT = Path(args.root).resolve()
    OUTPUT_MULTI = ROOT / "public" / "data" / "multi"

    if args.demo:
        wrote_q, total_q, index_abs = write_demo_questions()
        print_five_lines(str(OUTPUT_MULTI.resolve()), wrote_q, total_q, index_abs)
        return 0

    input_dir = ROOT / args.input_dir
    if not input_dir.is_dir():
        print("找不到輸入目錄: {}".format(input_dir), file=sys.stderr)
        return 1

    pdf_files = sorted(input_dir.glob("*.pdf"))
    if args.pdf:
        pdf_files = [p for p in pdf_files if p.name == args.pdf]

    # 無 PDF 時先走 Demo，不必載入 pdfplumber（鏈路驗證 / CI）
    if not pdf_files:
        if args.no_demo_fallback:
            print("在 {} 下沒有 .pdf".format(input_dir), file=sys.stderr)
            return 1
        print(
            "WARNING: raw_pdfs_multi 內無 PDF，改寫入 Demo 題庫以供鏈路驗證。",
            file=sys.stderr,
        )
        wrote_q, total_q, index_abs = write_demo_questions()
        print_five_lines(str(OUTPUT_MULTI.resolve()), wrote_q, total_q, index_abs)
        return 0

    S = load_single_module()
    if S.PDF_ENGINE is None:
        print("請先安裝 PDF 套件：pip install pdfplumber", file=sys.stderr)
        return 1

    OUTPUT_MULTI.mkdir(parents=True, exist_ok=True)
    backup_multi_dir(OUTPUT_MULTI)

    report = []
    datasets = []
    wrote_question_files = []
    total_written_questions = 0

    for idx, pdf_path in enumerate(pdf_files, 1):
        print("處理中 ({}/{}): {} ...".format(idx, len(pdf_files), pdf_path.name), flush=True)
        slug, questions = process_pdf_multi(S, pdf_path, report)
        out_file = OUTPUT_MULTI / ("questions_" + slug + ".json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        wrote_question_files.append(str(out_file.resolve()))
        total_written_questions += len(questions)
        label = S.slug_to_label(slug)
        datasets.append({"id": slug, "label": label, "file": "questions_" + slug + ".json"})

    index = {"bank_kind": "multi", "datasets": datasets, "default_dataset": "ALL"}
    index_path = OUTPUT_MULTI / "index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    data_version = datetime.now().strftime("%Y-%m-%d-%H%M")
    meta = {
        "data_version": data_version,
        "generated_at": datetime.now().isoformat(),
        "bank_kind": "multi",
    }
    with open(OUTPUT_MULTI / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    report_path = ROOT / "scripts" / "import_report_multi.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    output_root = str(OUTPUT_MULTI.resolve())
    print_five_lines(
        output_root,
        wrote_question_files,
        total_written_questions,
        str(index_path.resolve()),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)

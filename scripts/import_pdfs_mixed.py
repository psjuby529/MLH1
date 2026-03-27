#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
混合 PDF（同檔含 single + multi）匯入：分區標記 → 題號切塊 → 依分區與答案數分流。

輸出：
- single: public/data/questions_<slug>.json, index.json, meta.json, import_report.json
- multi:  public/data/multi/questions_<slug>.json, index.json, meta.json, import_report_multi.json
- scripts/import_report_mixed.json（conflict / suspect 與統計）

分區標記（須有全形／半形冒號）：單選題：、複選題： 等（避免誤匹配試卷說明「複選選擇題 20 題」）。
首個標記前文字預設為 single 分區。
mixed 分區內**不**呼叫 single 的 _strip_header_footer（會誤刪 10.～60. 題列）。
題型判定僅依「題號後第一組括號答案」，不用整塊圈號 heuristics。
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
DEFAULT_INPUT = "raw_pdfs_mixed"
OUT_SINGLE = ROOT / "public" / "data"
OUT_MULTI = ROOT / "public" / "data" / "multi"

# 須含冒號，避免匹配「單選選擇題 60 題…複選選擇題 20 題」說明文
SECTION_RX = re.compile(
    r"(?:^|\n)\s*((?:單選|複選)(?:選擇題|題))[:：]\s*",
    re.MULTILINE,
)

# 題號後第一組括號答案（OCR 容許空格）；題號可為 6 1 . 形式
Q_HEAD_RX = re.compile(
    r"(?:^|[\n\r])(?P<qstart>\s*(?P<qnum>\d(?:\s*\d){0,5})\s*[\.\．、]\s*[(（]\s*(?P<ans>[\d\s]+)\s*[)）])",
    re.MULTILINE,
)

NUM_TO_LETTER = {"1": "A", "2": "B", "3": "C", "4": "D"}


def load_single_module():
    p = ROOT / "scripts" / "import_pdfs_to_datasets.py"
    spec = importlib.util.spec_from_file_location("import_pdfs_single", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def split_mixed_blocks(segment_text):
    """
    依「題號 . ( 答案 )」切題塊；避免 multi 區 (13) 被誤判成第 13 題。
    回傳 [(qnum_norm, block_text), ...]
    """
    matches = list(Q_HEAD_RX.finditer(segment_text))
    out = []
    for i, m in enumerate(matches):
        start = m.start("qstart")
        end = matches[i + 1].start("qstart") if i + 1 < len(matches) else len(segment_text)
        q_norm = re.sub(r"\s+", "", m.group("qnum") or "")
        out.append((q_norm, segment_text[start:end]))
    return out


def extract_authoritative_answer(block):
    """
    題號後第一組括號內為答案；normalize 去除空格。
    回傳 (qnum_norm, ans_norm) 或 (None, None)
    """
    m = Q_HEAD_RX.search(block)
    if not m:
        return None, None
    qn = re.sub(r"\s+", "", m.group("qnum") or "")
    an = re.sub(r"\s+", "", m.group("ans") or "")
    return qn, an


def classify_mixed_block(section_kind, block):
    """
    僅依分區 + 題號後括號答案長度判定（不依賴選項 ①②③④）。
    回傳 (kind, reason) kind in single|multi|conflict|suspect|skip
    """
    qn, an = extract_authoritative_answer(block)
    if not qn or not an:
        return "skip", "無法解析題號後括號答案欄"
    if not re.fullmatch(r"[1-4]+", an):
        return "skip", "答案欄含非 1–4 字元：{}".format(an[:20])

    L = len(an)
    if section_kind == "single":
        if L >= 2:
            return "conflict", "單選分區但答案欄（normalize 後）長度>=2"
        return "single", None
    if L >= 2:
        return "multi", None
    return "suspect", "複選分區但答案欄（normalize 後）長度==1"


def split_text_by_sections(full_text):
    """回傳 [(section_kind, segment_text), ...]，kind 為 'single' 或 'multi'。"""
    chunks = []
    cur = "single"
    last = 0
    for m in SECTION_RX.finditer(full_text):
        if m.start() > last:
            raw = full_text[last : m.start()]
            if raw.strip():
                chunks.append((cur, raw))
        label = m.group(1) or ""
        cur = "multi" if "複選" in label else "single"
        last = m.end()
    if last < len(full_text):
        raw = full_text[last:]
        if raw.strip():
            chunks.append((cur, raw))
    if not chunks and full_text.strip():
        chunks.append(("single", full_text))
    return chunks


def build_single_question(S, slug, q_num, block, page_no=None, answer_index_override=None):
    """單題 single；答案優先使用題號後括號權威欄位。"""
    if answer_index_override is not None:
        answer_idx = answer_index_override
    else:
        answer_idx = S._extract_answer_from_block(block)
        if answer_idx is None:
            answer_idx = 0
    if answer_idx < 0 or answer_idx > 3:
        answer_idx = 0

    question_text = None
    ordered = None
    if "①" in block or "②" in block or "③" in block or "④" in block:
        question_text, ordered = S._split_options_circled(block)
    if ordered is None:
        question_text, ordered = S._split_options_abcd(block)
    if ordered is None:
        question_text, ordered = S._split_options_numbered(block)
    if ordered is None or len(ordered) != 4 or not all(ordered):
        question_text = (block[:2000].strip() or "（題幹略）")
        ordered = ["(選項未辨識)"] * 4
    else:
        ordered = [o or "(選項未辨識)" for o in ordered]

    question_text = question_text or "（題幹解析略）"
    question_text = re.sub(
        r"^\s*\d(?:\s*\d)*\s*[\.\．、]\s*[(（]\s*[\d\s]+\s*[)）]\s*",
        "",
        question_text,
        count=1,
    ).strip() or question_text

    q_trimmed, _ = S._trim_tail_at_next_question_or_header(question_text)
    question_text = q_trimmed or question_text
    for i, opt in enumerate(ordered):
        opt_trimmed, _ = S._trim_tail_at_next_question_or_header(opt)
        ordered[i] = opt_trimmed or opt

    explanation = S._extract_explanation(block)
    if page_no is not None:
        source = "{}#p{}#Q{}".format(slug, page_no, q_num)
        source_display = "{} 第{}頁 第{}題".format(S.slug_to_label(slug), page_no, q_num)
    else:
        source = "{}#Q{}".format(slug, q_num)
        source_display = "{} 第{}題".format(S.slug_to_label(slug), q_num)

    return {
        "id": q_num,
        "subject": "室內裝修工程管理",
        "year": int(q_num) if q_num.isdigit() and len(q_num) <= 4 else None,
        "chapter": "ALL",
        "type": "single",
        "question_text": question_text,
        "options": ordered,
        "answer_index": answer_idx,
        "explanation": explanation or "",
        "source": source,
        "source_display": source_display,
    }


def norm_answer_to_letters(norm_ans):
    """'13' -> ['A','C']；僅保留 1–4，順序去重。"""
    letters = []
    seen = set()
    for ch in norm_ans:
        if ch not in NUM_TO_LETTER:
            continue
        L = NUM_TO_LETTER[ch]
        if L not in seen:
            seen.add(L)
            letters.append(L)
    return letters


def build_multi_question(S, slug, q_num, block, correct_letters, page_no=None):
    """單題 multi；correct_letters 已由權威答案欄算出。"""
    question_text = None
    ordered = None
    if "①" in block or "②" in block or "③" in block or "④" in block:
        question_text, ordered = S._split_options_circled(block)
    if ordered is None:
        question_text, ordered = S._split_options_abcd(block)
    if ordered is None:
        question_text, ordered = S._split_options_numbered(block)
    if ordered is None or len(ordered) != 4 or not all(ordered):
        question_text = (block[:2000].strip() or "（題幹略）")
        ordered = ["(選項未辨識)"] * 4
    else:
        ordered = [o or "(選項未辨識)" for o in ordered]

    question_text = question_text or "（題幹解析略）"
    question_text = re.sub(
        r"^\s*\d(?:\s*\d)*\s*[\.\．、]\s*[(（]\s*[\d\s]+\s*[)）]\s*",
        "",
        question_text,
        count=1,
    ).strip() or question_text

    q_trimmed, _ = S._trim_tail_at_next_question_or_header(question_text)
    question_text = q_trimmed or question_text
    for i, opt in enumerate(ordered):
        opt_trimmed, _ = S._trim_tail_at_next_question_or_header(opt)
        ordered[i] = opt_trimmed or opt

    letters = list(correct_letters)
    multi_parse_flags = {"answer_parse_method": "authoritative_paren"}
    if not letters or len(letters) < 2:
        letters = ["A", "B"]
        multi_parse_flags["answer_placeholder"] = True

    explanation = S._extract_explanation(block)
    if page_no is not None:
        source = "{}#p{}#Q{}".format(slug, page_no, q_num)
        source_display = "{} 第{}頁 第{}題".format(S.slug_to_label(slug), page_no, q_num)
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
    return qobj


def process_mixed_pdf(S, pdf_path, page_no=None):
    raw_id = S.slug_from_filename(pdf_path.name)
    slug = S.to_ascii_slug(raw_id)
    pages_text = S.extract_text_from_pdf(pdf_path)
    if not pages_text:
        return slug, [], [], {
            "pdf": pdf_path.name,
            "dataset_id": slug,
            "single_count": 0,
            "multi_count": 0,
            "conflict_count": 0,
            "suspect_count": 0,
            "issues": [],
            "error": "無法擷取 PDF 文字",
        }

    # 先依分區標記切分全文（勿先整份 strip：會移除「單選題」等可作為分區的列）
    full_text = "\n".join(t for _, t in pages_text)

    single_questions = []
    multi_questions = []
    issues = []
    conflict_count = 0
    suspect_count = 0

    for section_kind, segment in split_text_by_sections(full_text):
        # 不可對整段做 _strip_header_footer：會誤刪「10.」～「60.」等題列
        seg_work = segment
        if not seg_work.strip():
            continue
        blocks = split_mixed_blocks(seg_work)
        for q_num, block in blocks:
            if not q_num.isdigit():
                continue
            if len(block) < 5:
                continue

            kind, reason = classify_mixed_block(section_kind, block)
            if kind == "skip":
                if section_kind == "single":
                    conflict_count += 1
                    issues.append(
                        {
                            "qno": q_num,
                            "kind": "conflict",
                            "section": section_kind,
                            "reason": reason,
                            "snippet": (block[:120] or "").replace("\n", " "),
                        }
                    )
                else:
                    suspect_count += 1
                    issues.append(
                        {
                            "qno": q_num,
                            "kind": "suspect",
                            "section": section_kind,
                            "reason": reason,
                            "snippet": (block[:120] or "").replace("\n", " "),
                        }
                    )
                continue
            if kind == "conflict":
                conflict_count += 1
                issues.append(
                    {
                        "qno": q_num,
                        "kind": "conflict",
                        "section": section_kind,
                        "reason": reason,
                        "snippet": (block[:120] or "").replace("\n", " "),
                    }
                )
                continue
            if kind == "suspect":
                suspect_count += 1
                issues.append(
                    {
                        "qno": q_num,
                        "kind": "suspect",
                        "section": section_kind,
                        "reason": reason or "",
                        "snippet": (block[:120] or "").replace("\n", " "),
                    }
                )
                continue

            _, an_norm = extract_authoritative_answer(block)
            if kind == "single":
                d = int(an_norm[0])
                answer_idx = d - 1 if 1 <= d <= 4 else 0
                q = build_single_question(
                    S, slug, q_num, block, page_no, answer_index_override=answer_idx
                )
                q["id"] = slug + "_" + q["id"]
                single_questions.append(q)
            elif kind == "multi":
                letters = norm_answer_to_letters(an_norm)
                q = build_multi_question(S, slug, q_num, block, letters, page_no)
                q["id"] = slug + "_" + q["id"]
                multi_questions.append(q)

    mixed_record = {
        "pdf": pdf_path.name,
        "dataset_id": slug,
        "single_count": len(single_questions),
        "multi_count": len(multi_questions),
        "conflict_count": conflict_count,
        "suspect_count": suspect_count,
        "issues": issues,
    }
    return slug, single_questions, multi_questions, mixed_record


def backup_dir(src, label):
    if not src.is_dir() or not any(src.iterdir()):
        return
    backup_root = ROOT / "scripts" / "backup"
    backup_root.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    dest = backup_root / ts / label
    try:
        shutil.copytree(src, dest)
        print("已備份 {} -> {}".format(src, dest), flush=True)
    except Exception as e:
        print("備份警告: {}".format(e), flush=True)


def write_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def read_json_if_exists(path):
    p = Path(path)
    if not p.is_file():
        return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def merge_dataset_index(existing_obj, new_entries, extra_fixed=None):
    """
    以 dataset id 為鍵：本批次覆寫同 id 的條目，其餘沿用舊 index（避免只匯入一份混合 PDF 就清空整庫）。
    """
    extra_fixed = extra_fixed or {}
    old_list = []
    if existing_obj and isinstance(existing_obj.get("datasets"), list):
        old_list = existing_obj["datasets"]
    batch_ids = {d["id"] for d in new_entries if d.get("id")}
    rest = [d for d in old_list if d.get("id") not in batch_ids]
    out = dict(extra_fixed)
    out["datasets"] = rest + new_entries
    if existing_obj and existing_obj.get("default_dataset"):
        out["default_dataset"] = existing_obj["default_dataset"]
    else:
        out["default_dataset"] = "ALL"
    return out


def merge_import_report_entries(report_path, new_entries, key="dataset_id"):
    old_list = read_json_if_exists(report_path)
    if not isinstance(old_list, list):
        old_list = []
    batch_ids = {e.get(key) for e in new_entries if e.get(key)}
    kept = [e for e in old_list if e.get(key) not in batch_ids]
    return kept + new_entries


def main():
    parser = argparse.ArgumentParser(description="MLH: 混合 PDF → single + multi 雙路匯入")
    parser.add_argument("--input-dir", default=DEFAULT_INPUT, help="含混合 PDF 的目錄")
    parser.add_argument("--pdf", default=None, help="僅處理指定檔名（須與目錄內名稱一致）")
    parser.add_argument("--root", default=None, help="專案根")
    args = parser.parse_args()
    global ROOT, OUT_SINGLE, OUT_MULTI
    if args.root:
        ROOT = Path(args.root).resolve()
        OUT_SINGLE = ROOT / "public" / "data"
        OUT_MULTI = ROOT / "public" / "data" / "multi"

    S = load_single_module()
    if S.PDF_ENGINE is None:
        print("請先安裝 pdfplumber：pip install pdfplumber", file=sys.stderr)
        return 1

    input_dir = ROOT / args.input_dir
    if not input_dir.is_dir():
        print("找不到目錄: {}".format(input_dir), file=sys.stderr)
        return 1

    pdf_files = sorted(input_dir.glob("*.pdf"))
    if args.pdf:
        pdf_files = [p for p in pdf_files if p.name == args.pdf]
        if not pdf_files:
            print("找不到 --pdf 指定檔名: {}".format(args.pdf), file=sys.stderr)
            return 1
    elif not pdf_files:
        print("目錄內無 .pdf: {}".format(input_dir), file=sys.stderr)
        return 1

    OUT_SINGLE.mkdir(parents=True, exist_ok=True)
    OUT_MULTI.mkdir(parents=True, exist_ok=True)
    backup_dir(OUT_SINGLE, "public_data")
    backup_dir(OUT_MULTI, "public_data_multi")

    single_report = []
    multi_report = []
    mixed_report = []
    single_datasets = []
    multi_datasets = []

    for idx, pdf_path in enumerate(pdf_files, 1):
        print("混合匯入 ({}/{}): {} ...".format(idx, len(pdf_files), pdf_path.name), flush=True)
        slug, s_qs, m_qs, mixed_rec = process_mixed_pdf(S, pdf_path)
        mixed_report.append(mixed_rec)

        s_path = OUT_SINGLE / ("questions_" + slug + ".json")
        with open(s_path, "w", encoding="utf-8") as f:
            json.dump(s_qs, f, ensure_ascii=False, indent=2)

        m_path = OUT_MULTI / ("questions_" + slug + ".json")
        with open(m_path, "w", encoding="utf-8") as f:
            json.dump(m_qs, f, ensure_ascii=False, indent=2)

        label = S.slug_to_label(slug)
        single_datasets.append({"id": slug, "label": label, "file": "questions_" + slug + ".json"})
        multi_datasets.append({"id": slug, "label": label, "file": "questions_" + slug + ".json"})

        single_report.append(
            {
                "file": pdf_path.name,
                "dataset_id": slug,
                "parsed": len(s_qs),
                "parse_failed_count": 0,
                "parse_failed": [],
                "cross_question_suspects_count": 0,
                "cross_question_suspects": [],
                "missing_explanation_count": sum(1 for q in s_qs if not (q.get("explanation") or "").strip()),
                "image_questions_count": 0,
                "missing_image_count": 0,
                "errors": [],
                "mismatch_images": [],
                "image_decisions": [],
                "import_mode": "mixed_single_branch",
            }
        )
        multi_report.append(
            {
                "file": pdf_path.name,
                "dataset_id": slug,
                "parsed": len(m_qs),
                "errors": [],
                "suspicious_count": sum(
                    1
                    for q in m_qs
                    if (q.get("multi_parse_flags") or {}).get("answer_placeholder")
                    or (q.get("multi_parse_flags") or {}).get("options_placeholder")
                ),
                "parse_failed_count": 0,
                "parse_failed": [],
                "cross_question_suspects_count": 0,
                "cross_question_suspects": [],
                "import_mode": "mixed_multi_branch",
            }
        )

        print(
            "  single={} multi={} conflict={} suspect={}".format(
                mixed_rec["single_count"],
                mixed_rec["multi_count"],
                mixed_rec["conflict_count"],
                mixed_rec["suspect_count"],
            ),
            flush=True,
        )

    existing_idx_s = read_json_if_exists(OUT_SINGLE / "index.json")
    idx_s = merge_dataset_index(existing_idx_s, single_datasets, {})
    write_text(OUT_SINGLE / "index.json", json.dumps(idx_s, ensure_ascii=False, indent=2))
    dv = datetime.now().strftime("%Y-%m-%d-%H%M")
    write_text(
        OUT_SINGLE / "meta.json",
        json.dumps({"data_version": dv, "generated_at": datetime.now().isoformat()}, ensure_ascii=False, indent=2),
    )

    existing_idx_m = read_json_if_exists(OUT_MULTI / "index.json")
    idx_m = merge_dataset_index(existing_idx_m, multi_datasets, {"bank_kind": "multi"})
    idx_m["bank_kind"] = "multi"
    write_text(OUT_MULTI / "index.json", json.dumps(idx_m, ensure_ascii=False, indent=2))
    write_text(
        OUT_MULTI / "meta.json",
        json.dumps(
            {
                "data_version": dv,
                "generated_at": datetime.now().isoformat(),
                "bank_kind": "multi",
            },
            ensure_ascii=False,
            indent=2,
        ),
    )

    write_text(
        ROOT / "scripts" / "import_report.json",
        json.dumps(merge_import_report_entries(ROOT / "scripts" / "import_report.json", single_report), ensure_ascii=False, indent=2),
    )
    write_text(
        ROOT / "scripts" / "import_report_multi.json",
        json.dumps(
            merge_import_report_entries(ROOT / "scripts" / "import_report_multi.json", multi_report),
            ensure_ascii=False,
            indent=2,
        ),
    )
    mixed_payload = {
        "generated_at": datetime.now().isoformat(),
        "single_count": sum(r.get("single_count", 0) for r in mixed_report),
        "multi_count": sum(r.get("multi_count", 0) for r in mixed_report),
        "conflict_count": sum(r.get("conflict_count", 0) for r in mixed_report),
        "suspect_count": sum(r.get("suspect_count", 0) for r in mixed_report),
        "files": mixed_report,
    }
    write_text(ROOT / "scripts" / "import_report_mixed.json", json.dumps(mixed_payload, ensure_ascii=False, indent=2))

    print("import_report_mixed.json 已寫入（含 single/multi/conflict/suspect 統計）", flush=True)
    print(
        "MIXED_RUN_TOTAL single={} multi={} conflict={} suspect={}".format(
            mixed_payload["single_count"],
            mixed_payload["multi_count"],
            mixed_payload["conflict_count"],
            mixed_payload["suspect_count"],
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)

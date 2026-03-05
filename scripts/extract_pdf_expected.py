#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
從 raw_pdfs 內每份 PDF 的前兩頁擷取「題數宣告」文字，輸出 JSON 陣列到 stdout。
供 pdf_expected_count.mjs 呼叫；若本機無 PDF 則由 Node 改讀 import_report.json。
"""
from __future__ import print_function, unicode_literals

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import pdfplumber
    PDF_ENGINE = "pdfplumber"
except ImportError:
    pdfplumber = None
    PDF_ENGINE = None

if PDF_ENGINE is None:
    try:
        import fitz
        PDF_ENGINE = "fitz"
    except ImportError:
        fitz = None
        PDF_ENGINE = None

ROOT = Path(__file__).resolve().parent.parent

# 題數宣告常見句型（依優先順序）
DECLARE_PATTERNS = [
    # 本試卷有選擇題 80 題【單選 60 題…複選 20 題】
    (re.compile(r"本試卷有選擇題\s*(\d+)\s*題"), lambda m: int(m.group(1))),
    # 共 100 題、共80題
    (re.compile(r"共\s*(\d+)\s*題"), lambda m: int(m.group(1))),
    # 單選 60 題；複選 20 題 → 80
    (re.compile(r"單選[^\d]*(\d+)\s*題[^]*?複選[^\d]*(\d+)\s*題"), lambda m: int(m.group(1)) + int(m.group(2))),
    # 選擇題 60 題，複選 20 題
    (re.compile(r"選擇題\s*(\d+)\s*題[^]*?複選[^\d]*(\d+)\s*題"), lambda m: int(m.group(1)) + int(m.group(2))),
    # 僅單選：單選 80 題
    (re.compile(r"單選[^0-9]*(\d+)\s*題"), lambda m: int(m.group(1))),
]


def extract_text_first_pages(pdf_path, max_pages=2):
    out = []
    path = Path(pdf_path)
    if PDF_ENGINE == "pdfplumber" and pdfplumber:
        try:
            with pdfplumber.open(path) as pdf:
                for i in range(min(max_pages, len(pdf.pages))):
                    t = pdf.pages[i].extract_text()
                    out.append(t if t else "")
        except Exception:
            return []
    elif PDF_ENGINE == "fitz" and fitz:
        try:
            doc = fitz.open(str(path))
            for i in range(min(max_pages, len(doc))):
                out.append(doc[i].get_text() or "")
            doc.close()
        except Exception:
            return []
    return out


def find_expected_and_evidence(text):
    """從合併文字找題數宣告，回傳 (expected, evidence) 或 (None, None)。"""
    if not text or not text.strip():
        return None, None
    for pat, get_count in DECLARE_PATTERNS:
        m = pat.search(text)
        if m:
            try:
                n = get_count(m)
                if n and n > 0:
                    evidence = m.group(0).strip()[:200]
                    return n, evidence
            except (ValueError, IndexError):
                continue
    return None, None


def main():
    parser = argparse.ArgumentParser(description="PDF 題數宣告 → JSON")
    parser.add_argument("--input-dir", default="raw_pdfs", help="PDF 目錄（相對專案根）")
    parser.add_argument("--root", default=None, help="專案根目錄")
    args = parser.parse_args()
    root = Path(args.root).resolve() if args.root else ROOT
    input_dir = root / args.input_dir

    if PDF_ENGINE is None:
        print(json.dumps({"error": "no PDF engine (pip install pdfplumber or pymupdf)"}), file=sys.stderr)
        sys.exit(1)

    if not input_dir.is_dir():
        print(json.dumps({"error": "input dir not found: " + str(input_dir)}), file=sys.stderr)
        sys.exit(1)

    pdf_files = sorted(input_dir.glob("*.pdf"))
    if not pdf_files:
        print(json.dumps({"error": "no PDF files in " + str(input_dir)}), file=sys.stderr)
        sys.exit(1)

    result = []
    for pdf_path in pdf_files:
        pages_text = extract_text_first_pages(pdf_path)
        combined = "\n".join(pages_text)
        expected, evidence = find_expected_and_evidence(combined)
        result.append({
            "file": pdf_path.name,
            "expected": expected,
            "evidence": evidence or None,
        })

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

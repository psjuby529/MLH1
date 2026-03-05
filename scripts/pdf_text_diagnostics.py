#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
對 raw_pdfs 內每份 PDF 做「可抽題信號」檢測：有文字頁數、題號模式，寫入 scripts/pdf_text_diagnostics.json。
用於判斷是否為掃描圖（無文字）或題號版式不符導致解析僅 239 題。
"""
from __future__ import print_function, unicode_literals

import json
import re
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print('{"error": "pip install pdfplumber"}', file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
RAW_PDFS = ROOT / "raw_pdfs"
RAW_PDFS_COLON = ROOT / "raw_pdfs:"
OUT_PATH = ROOT / "scripts" / "pdf_text_diagnostics.json"

def get_pdf_dir():
    if RAW_PDFS.is_dir():
        return RAW_PDFS
    if RAW_PDFS_COLON.is_dir():
        return RAW_PDFS_COLON
    return None

# 題號模式：行首數字. 或 （數字）
QUESTION_NUMBER_PATTERN = re.compile(r"(?:^\s*\d+\.\s*|\(\d+\))", re.MULTILINE)

def diagnose_one(pdf_path):
    out = {
        "file": pdf_path.name,
        "pages_total": 0,
        "pages_with_text": 0,
        "sample_text_snippet": "",
        "has_question_number_pattern": False,
    }
    try:
        with pdfplumber.open(pdf_path) as pdf:
            out["pages_total"] = len(pdf.pages)
            all_text = []
            for page in pdf.pages:
                t = page.extract_text()
                if t and t.strip():
                    out["pages_with_text"] += 1
                    all_text.append(t)
            combined = "\n".join(all_text)
            out["sample_text_snippet"] = (combined[:200] + "…") if len(combined) > 200 else combined
            out["has_question_number_pattern"] = bool(QUESTION_NUMBER_PATTERN.search(combined))
    except Exception as e:
        out["error"] = str(e)
    return out

def main():
    pdf_dir = get_pdf_dir()
    if not pdf_dir:
        print('{"error": "raw_pdfs dir not found"}', file=sys.stderr)
        sys.exit(1)
    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print('{"error": "no PDFs in raw_pdfs"}', file=sys.stderr)
        sys.exit(1)
    items = [diagnose_one(p) for p in pdf_files]
    result = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(),
        "count": len(items),
        "items": items,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote:", str(OUT_PATH))

if __name__ == "__main__":
    main()

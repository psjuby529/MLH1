#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
只針對 105-126002工程管理學科.pdf 抽取每頁文字，輸出所有「疑似題號」前後文到 105_markers.txt。
用於觀測題號實際長相，再升級題號檢測 regex。
"""
from __future__ import print_function, unicode_literals

import re
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("pip install pdfplumber", __import__("sys").stderr)
    __import__("sys").exit(1)

ROOT = Path(__file__).resolve().parent.parent
RAW_PDFS = ROOT / "raw_pdfs"
RAW_PDFS_COLON = ROOT / "raw_pdfs:"
OUT_DIR = ROOT / "scripts" / "parser_debug"
OUT_FILE = OUT_DIR / "105_markers.txt"
PDF_NAME = "105-126002工程管理學科.pdf"
CONTEXT = 20  # 前後各 20 字

def get_pdf_path():
    for d in (RAW_PDFS, RAW_PDFS_COLON):
        p = d / PDF_NAME
        if p.exists():
            return p
    return None

def main():
    pdf_path = get_pdf_path()
    if not pdf_path:
        print("找不到 105 PDF", file=__import__("sys").stderr)
        __import__("sys").exit(1)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = []
    lines.append("# 105 PDF 題號觀測樣本（每處 \\d{1,3} 前後各 " + str(CONTEXT) + " 字）")
    lines.append("")
    pattern_counts = {}  # 題號實際長相統計
    pat = re.compile(r"\d{1,3}")
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            lines.append("=== 第 {} 頁 (len={}) ===".format(page_idx + 1, len(text)))
            for m in pat.finditer(text):
                start, end = m.span()
                qno = m.group(0)
                before = text[max(0, start - CONTEXT):start]
                after = text[end:min(len(text), end + CONTEXT)]
                snippet = "|{}|{}|".format(before.replace("\n", " "), after.replace("\n", " "))
                lines.append("  qno={} -> {}".format(qno, snippet))
                key = repr(before[-3:] if len(before) >= 3 else before) + "|" + repr(after[:3] if len(after) >= 3 else after)
                pattern_counts[key] = pattern_counts.get(key, 0) + 1
            lines.append("")
    lines.append("--- top patterns（題號前 3 字 / 後 3 字 出現次數）---")
    for k, v in sorted(pattern_counts.items(), key=lambda x: -x[1])[:30]:
        lines.append("  {} : {}".format(k, v))
    OUT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print("Wrote:", OUT_FILE)

if __name__ == "__main__":
    main()

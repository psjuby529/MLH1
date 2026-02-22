#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MLH Quiz v1.2 — 將 raw_pdfs/ 內 PDF 轉成 public/data/questions_<id>.json，
並更新 public/data/index.json、產出 scripts/import_report.json。

依賴（擇一，建議 pdfplumber，Python 3.6 可用）：
  pip install pdfplumber
若使用 PyMuPDF（需 Python 3.7+ 且環境可編譯）：
  pip install pymupdf

執行：在專案根目錄執行
  python3 scripts/import_pdfs_to_datasets.py [--input-dir raw_pdfs] [--output-dir public/data]
若 PDF 資料夾名稱含冒號（如 raw_pdfs:）請用：
  python3 scripts/import_pdfs_to_datasets.py --input-dir "raw_pdfs:"
"""
from __future__ import print_function, unicode_literals

import argparse
import json
import re
import sys
from pathlib import Path

# Python 3.6 相容：Path.read_text 在 3.5+ 有，但 3.5 無 encoding，用 open
def read_text(path, encoding="utf-8"):
    with open(path, "r", encoding=encoding) as f:
        return f.read()

def write_text(path, text, encoding="utf-8"):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding=encoding) as f:
        f.write(text)

# 優先 pdfplumber（純 Python，Python 3.6 可用）
try:
    import pdfplumber
    PDF_ENGINE = "pdfplumber"
except ImportError:
    pdfplumber = None
    PDF_ENGINE = None

if PDF_ENGINE is None:
    try:
        import fitz  # PyMuPDF，需 Python 3.7+ 且可編譯
        PDF_ENGINE = "fitz"
    except ImportError:
        fitz = None
        PDF_ENGINE = None

# 專案根目錄 = 本腳本所在目錄的上一層（可用 --root 覆寫，供 Colab 用）
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = "raw_pdfs"
DEFAULT_OUTPUT = "public/data"


def slug_from_filename(name):
    """從檔名取得簡短 raw id（供 to_ascii_slug 轉成 slug）。"""
    base = Path(name).stem.strip()
    base = re.sub(r"\s+", "_", base)
    if re.match(r"^\d+", base):
        m = re.match(r"^(\d+)", base)
        if m:
            return m.group(1)
    return base[:30] if len(base) > 30 else base


# v1.2.2: 全部 ASCII slug，僅 [a-z0-9_]
def to_ascii_slug(raw_id):
    """將 raw dataset id 轉成 ASCII slug（id/file/資料夾一律用此）。"""
    s = (raw_id or "").strip()
    if not s:
        return "unknown"
    # 綜合A / 綜合B
    if "綜合" in s and ("A" in s or "a" in s):
        return "zonghe_a"
    if "綜合" in s and ("B" in s or "b" in s):
        return "zonghe_b"
    # 純數字 105, 106 -> y105, y106
    if re.match(r"^\d+$", s):
        return "y" + s
    # 9xxxx 共同科目 -> c90006
    if re.match(r"^9\d+$", s):
        return "c" + s
    # 其他：只保留 [a-z0-9_]
    out = re.sub(r"[^a-zA-Z0-9_]", "_", s)
    out = out.lower().strip("_")
    return out[:32] if out else "dataset"


def extract_text_from_pdf(path):
    """回傳 (page_1based, text) 列表。"""
    path = Path(path)
    out = []
    if PDF_ENGINE == "pdfplumber" and pdfplumber:
        try:
            with pdfplumber.open(path) as pdf:
                for i, page in enumerate(pdf.pages):
                    t = page.extract_text()
                    out.append((i + 1, t if t else ""))
        except Exception as e:
            print("  pdfplumber 讀取失敗: {}".format(e), file=sys.stderr)
            return []
    elif PDF_ENGINE == "fitz" and fitz:
        try:
            doc = fitz.open(str(path))
            for i in range(len(doc)):
                page = doc[i]
                out.append((i + 1, page.get_text() or ""))
            doc.close()
        except Exception as e:
            print("  PyMuPDF 讀取失敗: {}".format(e), file=sys.stderr)
            return []
    return out


# 實際 PDF 格式：題號.  (答案數字)  題幹 ①選項1②選項2③選項3④選項4 [解析：...]
# 【必修1】切分邊界只用 LINE_START_QUESTION；QUESTION_HEAD 僅用於「輔助抽答案/驗證」
QUESTION_HEAD = re.compile(r"(?:^|\n)\s*(\d+)\.\s+\(([1-4])\)\s*", re.MULTILINE)
LINE_START_QUESTION = re.compile(r"^\s*(\d{1,3})\.\s*(?:\(\d\))?", re.MULTILINE)
OPTION_MARK = re.compile(r"[①②③④]")
# 【必修2】A/B/C/D 選項版式：A. A、 A) 等（多行）
OPTION_ABCD = re.compile(r"(?m)^\s*[A-D][\.\、\)]\s*", re.MULTILINE)
# 解析段落：從「解析」到下一題號或結尾
EXPLANATION_START = re.compile(r"解析\s*[：:]\s*", re.IGNORECASE)
NEXT_QUESTION_MARK = re.compile(r"\n\s*\d+\.\s+\(", re.MULTILINE)

# 頁首/頁尾常見模式（移除後再解析，避免黏進題幹/選項）
HEADER_FOOTER_PATTERNS = [
    re.compile(r"^\s*\d+\s*建築物室內裝修工程管理\s*", re.MULTILINE),
    re.compile(r"^\s*\d{2,4}\s*[一二三四五六七八九十]?\s*", re.MULTILINE),  # 年度 12600、110 等
    re.compile(r"建築物室內裝修工程管理\s*[甲乙]?\s*\d+-\d+\s*\(\s*序\s*\d+\s*\)", re.MULTILINE),
    re.compile(r"准考證號碼\s*[:：]?\s*", re.MULTILINE),
    re.compile(r"姓名\s*[:：]?\s*", re.MULTILINE),
    re.compile(r"單選題\s*", re.MULTILINE),
    re.compile(r"^\s*\d{3,}\s*$", re.MULTILINE),  # 僅數字的行（如 126002）
]

# 疑似圖題關鍵字（高召回，含「圖樣圖示」「左圖符號」等）
IMAGE_QUESTION_KEYWORDS = (
    "圖", "如圖", "下圖", "左圖", "右圖", "符號", "圖例", "CNS", "代表", "標示",
    "圖樣圖示", "圖樣圖式", "左圖符號", "此符號", "下圖符號",
)

# 強制產圖關鍵詞：題幹命中則即使 _rect_has_graphic 為 False 也產圖（CNS/向量符號易被誤判為無圖元）
FORCE_IMAGE_KEYWORDS = (
    "CNS", "符號", "設備符號", "圖例", "左圖", "下圖", "如圖", "代表", "圖形",
    "設備圖例", "設備圖例標準", "圖樣圖示", "給排水", "衛生設備符號", "DWR",
)


def should_force_image(question_text):
    """題幹命中符號/圖例關鍵詞時強制產圖，避免 CNS 向量符號被判為無圖元而跳過。"""
    if not question_text or not isinstance(question_text, str):
        return False
    return any(kw in question_text for kw in FORCE_IMAGE_KEYWORDS)

# A) 跨題文字：題幹/選項尾端若出現「下一題題號」或頁首科目詞，於此截斷
RE_NEXT_QUESTION_IN_TAIL = re.compile(r"\s+\d{1,3}\.\s*(?:\(\d\))?", re.MULTILINE)
CROSS_QUESTION_HEADER_KEYWORDS = (
    "電燈總配電盤", "共同科目", "職業安全衛生", "建築物室內裝修工程管理",
    "工程管理學科", "配電盤", "職業安全",
)


def _strip_header_footer(page_text):
    """移除頁首/頁尾常見模式，回傳清理後文字（行為單位過濾）。"""
    if not page_text or not page_text.strip():
        return page_text
    lines = page_text.split("\n")
    out = []
    for line in lines:
        s = line.strip()
        if not s:
            out.append(line)
            continue
        skip = False
        for pat in HEADER_FOOTER_PATTERNS:
            if pat.search(line) or pat.search(s):
                skip = True
                break
        if skip:
            continue
        # 整行像「105 建築物室內裝修工程管理 乙 4-2(序 002 )」
        if re.match(r"^\d{2,4}\s+建築物", s) or re.search(r"序\s*\d+\s*\)?\s*$", s):
            continue
        out.append(line)
    return "\n".join(out)


def slug_to_label(slug):
    """由 slug 產生可讀 label（避免檔名亂碼污染 index）。"""
    if not slug:
        return "題庫"
    if slug == "v1":
        return "v1 測試題庫"
    if slug == "zonghe_a":
        return "綜合A"
    if slug == "zonghe_b":
        return "綜合B"
    if slug.startswith("y") and slug[1:].isdigit():
        return slug[1:] + " 工程管理學科"
    if slug.startswith("c") and slug[1:].isdigit():
        return slug[1:] + " 共同科目"
    return slug


def _extract_explanation(block):
    """從題目區塊抽出「解析」段落，無則回傳空字串。"""
    if not block or "解析" not in block:
        return ""
    m = EXPLANATION_START.search(block)
    if not m:
        return ""
    start = m.end()
    rest = block[start:]
    end_m = NEXT_QUESTION_MARK.search(rest)
    end = end_m.start() if end_m else len(rest)
    text = rest[:end].strip()
    text = re.sub(r"\n\s+", "\n", text)
    text = re.sub(r" +", " ", text).strip()
    return text[:3000] if text else ""


def _is_suspected_image_question(question_text, options):
    """題幹或選項含圖/符號等關鍵字則視為疑似圖題。"""
    combined = question_text + " " + " ".join(o or "" for o in options)
    return any(kw in combined for kw in IMAGE_QUESTION_KEYWORDS)


def _trim_tail_at_next_question_or_header(text):
    """若題幹/選項尾端出現「下一題題號」或頁首科目詞，於首次出現處截斷。回傳 (trimmed_text, snippet_or_None)。"""
    if not text or not text.strip():
        return text, None
    snippet = None
    out = text
    m = RE_NEXT_QUESTION_IN_TAIL.search(out)
    if m:
        pos = m.start()
        if pos > 10:
            snippet = out[pos : pos + 30].strip()
            out = out[:pos].strip()
    for kw in CROSS_QUESTION_HEADER_KEYWORDS:
        idx = out.find(kw)
        if idx >= 0 and idx > 5:
            if snippet is None:
                snippet = out[idx : idx + 20]
            out = out[:idx].strip()
            break
    return out, snippet


def _split_blocks_by_line_start_question(full_text):
    """【必修1】只用 LINE_START_QUESTION 建立題目硬邊界，回傳 [(qno_str, block_text), ...]。"""
    blocks = []
    for m in LINE_START_QUESTION.finditer(full_text):
        qno = (m.group(1) or "").strip()
        if not qno or not qno.isdigit():
            continue
        start = m.start()
        blocks.append((qno, start))
    out = []
    for i, (qno, start) in enumerate(blocks):
        end = blocks[i + 1][1] if i + 1 < len(blocks) else len(full_text)
        block_text = full_text[start:end].strip()
        if len(block_text) < 5:
            continue
        out.append((qno, block_text))
    return out


def _extract_answer_from_block(block):
    """【必修1】僅用 QUESTION_HEAD 輔助抽答案，回傳 0~3 或 None。"""
    m = QUESTION_HEAD.search(block)
    if not m:
        return None
    ans_char = (m.group(2) or "").strip()
    if ans_char in ("1", "2", "3", "4"):
        return int(ans_char) - 1
    return None


def _split_options_circled(block):
    """用 ①②③④ 切出四選項，回傳 (stem, [opt1,opt2,opt3,opt4]) 或 (None, None)。"""
    parts = OPTION_MARK.split(block)
    if len(parts) < 5:
        return None, None
    stem = (parts[0] or "").strip()[:2000]
    ordered = []
    for j in range(1, 5):
        ordered.append((parts[j] or "").strip()[:500] or "")
    if not all(ordered):
        return None, None
    return stem, ordered


def _split_options_abcd(block):
    """用 A. / A、/ A) 等切出四選項，回傳 (stem, [opt1,opt2,opt3,opt4]) 或 (None, None)。"""
    ms = list(OPTION_ABCD.finditer(block))
    if len(ms) < 4:
        return None, None
    stem = (block[: ms[0].start()] or "").strip()[:2000]
    ordered = []
    for i in range(4):
        a = ms[i].end()
        b = ms[i + 1].start() if i + 1 < len(ms) else len(block)
        ordered.append((block[a:b] or "").strip()[:500] or "")
    if len(ordered) != 4 or not all(ordered):
        return None, None
    return stem, ordered


def parse_questions_from_text(full_text, slug, page_no=None):
    """【必修1】切分只用 LINE_START_QUESTION；QUESTION_HEAD 僅輔助抽答案。【必修2】選項支援 ①②③④ 與 A/B/C/D。【A】跨題尾巴截斷。"""
    questions = []
    parse_failed = []
    cross_question_suspects = []
    blocks = _split_blocks_by_line_start_question(full_text)
    for q_num, block in blocks:
        if not q_num.isdigit() or len(block) < 5:
            continue
        answer_idx = _extract_answer_from_block(block)
        if answer_idx is None:
            answer_idx = 0
        if answer_idx < 0 or answer_idx > 3:
            answer_idx = 0

        question_text = None
        ordered = None
        if "①" in block or "②" in block or "③" in block or "④" in block:
            question_text, ordered = _split_options_circled(block)
        if ordered is None:
            question_text, ordered = _split_options_abcd(block)
        if ordered is None or len(ordered) != 4 or not all(ordered):
            src = "{}#p{}#Q{}".format(slug, page_no, q_num) if page_no is not None else "{}#Q{}".format(slug, q_num)
            parse_failed.append({"dataset_id": slug, "qno": q_num, "reason": "parse_failed", "source": src})
            continue

        question_text = question_text or "（題幹解析略）"
        # 題幹顯示時移除行首「題號.(答案)」，避免答案黏在題目開頭
        question_text = re.sub(r"^\s*\d+\.\s*\([1-4]\)\s*", "", question_text).strip() or question_text

        # A) 跨題尾巴截斷：題幹與選項尾端若出現下一題題號或頁首科目詞則截斷
        cross_suspects_here = []
        q_trimmed, snip = _trim_tail_at_next_question_or_header(question_text)
        if snip:
            cross_suspects_here.append({"slug": slug, "qno": q_num, "reason": "next_question_or_header_in_stem", "snippet": snip[:80]})
        question_text = q_trimmed or question_text
        for i, opt in enumerate(ordered):
            opt_trimmed, snip = _trim_tail_at_next_question_or_header(opt)
            if snip:
                cross_suspects_here.append({"slug": slug, "qno": q_num, "reason": "next_question_or_header_in_option", "snippet": snip[:80]})
            ordered[i] = opt_trimmed or opt

        explanation = _extract_explanation(block)
        if page_no is not None:
            source = "{}#p{}#Q{}".format(slug, page_no, q_num)
            source_display = "{} 第{}頁 第{}題".format(slug_to_label(slug), page_no, q_num)
        else:
            source = "{}#Q{}".format(slug, q_num)
            source_display = "{} 第{}題".format(slug_to_label(slug), q_num)

        questions.append({
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
        })
        for s in cross_suspects_here:
            cross_question_suspects.append({"dataset_id": slug, "qno": q_num, "reason": s["reason"], "snippet": s["snippet"]})
    return questions, parse_failed, cross_question_suspects


# v1.2.2: 題號索引（【必修1】不依答案定位，用「題號. 」建立邊界）
def build_question_index(pdf_path, max_qno=600):
    """掃描 PDF 每頁，用「題號. 」建立 (page_0based, qno) -> (y0, y1, rect_qno)。"""
    try:
        import fitz
    except ImportError:
        return {}
    path = Path(pdf_path)
    index = {}
    try:
        doc = fitz.open(str(path))
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            entries = []
            for qno in range(1, max_qno + 1):
                needle = str(qno) + ". "
                rl = page.search_for(needle)
                if not rl:
                    continue
                rect = rl[0]
                entries.append((qno, rect))
            entries.sort(key=lambda x: (x[1].y0, x[1].x0))
            for i, (qno, rect) in enumerate(entries):
                y_end = entries[i + 1][1].y0 if i + 1 < len(entries) else page.rect.height
                index[(page_idx, qno)] = (rect.y0, y_end, rect)
        doc.close()
    except Exception:
        pass
    return index


def _x0_after_answer(page, rect_qno, page_width, default_ratio=0.14):
    """裁切左緣：同一行找 (1)(2)(3)(4) 任一 bbox，x0=其右側；找不到則 x0=page_width*default_ratio。"""
    try:
        import fitz
    except ImportError:
        return page_width * default_ratio
    x1_candidates = []
    for ans in ["(1)", "(2)", "(3)", "(4)"]:
        rl = page.search_for(ans)
        for r in rl:
            if abs(r.y0 - rect_qno.y0) < 25:
                x1_candidates.append(r.x1)
    if x1_candidates:
        return min(page_width, max(x1_candidates) + 4)
    return page_width * default_ratio


def _rect_has_graphic(page, clip_rect):
    """題區間 rect 內是否含圖元（images 或 drawings），有才需產圖。"""
    try:
        import fitz
    except ImportError:
        return False
    # 與 clip 相交的 image bbox
    try:
        for info in page.get_image_info():
            bbox = info.get("bbox")
            if bbox and len(bbox) >= 4:
                r = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
                if r.intersects(clip_rect):
                    return True
    except Exception:
        pass
    try:
        for path in page.get_drawings():
            r = path.get("rect")
            if r is None:
                continue
            if hasattr(r, "intersects"):
                if r.intersects(clip_rect):
                    return True
            elif isinstance(r, (list, tuple)) and len(r) >= 4:
                rect = fitz.Rect(r[0], r[1], r[2], r[3])
                if rect.intersects(clip_rect):
                    return True
    except Exception:
        pass
    return False


def _render_crop_question_image_v122(pdf_path, q_num, slug, assets_root, question_index, mismatch_list, question_text=None, force_image=False):
    """v1.2.2: 題區間有圖元或 force_image（CNS/符號關鍵詞）時產圖；強制產圖時 x0 用 0.08 保留左側符號。"""
    path = Path(pdf_path)
    assets_dir = Path(assets_root) / "q" / slug
    assets_dir.mkdir(parents=True, exist_ok=True)
    qno_int = int(q_num) if str(q_num).isdigit() else 0
    num_str = str(q_num).zfill(3) if len(str(q_num)) <= 3 else str(q_num)
    out_name = "Q" + num_str + ".png"
    out_path = assets_dir / out_name
    rel_path = "/assets/q/" + slug + "/" + out_name

    try:
        import fitz
    except ImportError:
        mismatch_list.append({"dataset_id": slug, "qno": q_num, "reason": "no_fitz", "source": "", "image_path": rel_path, "image_decision": "failed"})
        return (None, False, "failed")

    try:
        doc = fitz.open(str(path))
        n_pages = len(doc)
        info = None
        page_idx = -1
        for p in range(n_pages):
            key = (p, qno_int)
            if key in question_index:
                info = question_index[key]
                page_idx = p
                break
        if not info or page_idx < 0:
            doc.close()
            mismatch_list.append({"dataset_id": slug, "qno": q_num, "reason": "index_missing", "source": "", "image_path": rel_path, "image_decision": "failed"})
            return (None, False, "failed")

        y0, y1, rect_qno = info
        page = doc[page_idx]
        w = page.rect.width
        h = page.rect.height
        # 強制產圖時用較保守 x0=0.08 保留左側符號區，仍與答案 bbox 取 max 防露答案
        default_ratio = 0.08 if force_image else 0.14
        x0 = _x0_after_answer(page, rect_qno, w, default_ratio=default_ratio)
        y0_safe = max(0, y0 - 10)
        y1_safe = min(h, y1 + 80)
        if y1_safe <= y0_safe:
            y1_safe = min(h, y0_safe + 150)
        clip = fitz.Rect(x0, y0_safe, w, y1_safe)
        if clip.x1 <= clip.x0:
            clip = fitz.Rect(w * default_ratio, 0, w, h)

        has_graphic = _rect_has_graphic(page, clip)
        if not has_graphic and not force_image:
            doc.close()
            return (None, True, "skipped_no_graphic")

        zoom = 2.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
        pix.save(str(out_path))

        # 【必修3】校準驗證：用題幹 snippet（8~15 字）在 clip 回讀文字中檢查；不命中則 mismatch，報表含 expected_snippet
        if question_text:
            try:
                region_text = page.get_text("text", clip=clip) or ""
                region_text = re.sub(r"\s+", "", region_text)
                stem_raw = (question_text.strip()[:30] or "").strip()
                stem_clean = re.sub(r"\s+", "", stem_raw)
                snippet = stem_clean[:15] if len(stem_clean) >= 8 else stem_clean[:8]
                if snippet and len(snippet) >= 4:
                    if snippet not in region_text:
                        stem_short = stem_clean[:8]
                        if stem_short not in region_text:
                            mismatch_list.append({
                                "dataset_id": slug, "qno": q_num, "reason": "calibration_fail",
                                "source": "stem_not_in_region", "image_path": rel_path,
                                "expected_snippet": snippet[:20],
                            })
            except Exception:
                pass

        decision = "forced_by_keywords" if (force_image and not has_graphic) else "rendered"
        doc.close()
        return (rel_path, False, decision)
    except Exception as e:
        # 索引有但裁切失敗時，用防露答案底線（x0=0.14*w）再試一頁
        try:
            import fitz
            doc = fitz.open(str(path))
            for page_idx in range(len(doc)):
                key = (page_idx, qno_int)
                if key not in question_index:
                    continue
                page = doc[page_idx]
                w, h = page.rect.width, page.rect.height
                clip = fitz.Rect(w * 0.14, 0, w, h)
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
                pix.save(str(out_path))
                doc.close()
                return (rel_path, False, "rendered")
            doc.close()
        except Exception:
            pass
        try:
            mismatch_list.append({"dataset_id": slug, "qno": q_num, "reason": "render_error", "source": str(e)[:200], "image_path": rel_path, "image_decision": "failed"})
        except Exception:
            pass
        return (None, False, "failed")
    return (None, False, "failed")


def process_pdf(input_dir, output_dir, pdf_path, report, assets_root=None):
    """處理單一 PDF，回傳 (slug, questions)。v1.2.2 使用 slug、question_index、mismatch_images。"""
    raw_id = slug_from_filename(pdf_path.name)
    slug = to_ascii_slug(raw_id)
    print("    解析文字...", end=" ", flush=True)
    pages_text = extract_text_from_pdf(pdf_path)
    if not pages_text:
        print("(無文字)", flush=True)
        report.append({
            "file": pdf_path.name,
            "dataset_id": slug,
            "parsed": 0,
            "parse_failed_count": 0,
            "parse_failed": [],
            "cross_question_suspects_count": 0,
            "cross_question_suspects": [],
            "missing_explanation_count": 0,
            "image_questions_count": 0,
            "missing_image_count": 0,
            "errors": [],
            "mismatch_images": [],
            "error": "PDF 引擎未安裝或無法擷取文字（請 pip install pdfplumber）",
        })
        return slug, []

    # 【必修1】每頁先做 Header/Footer 清理，再只用 LINE_START_QUESTION 為邊界解析；【A】跨題尾巴截斷
    full_text = "\n".join(t for _, t in pages_text)
    all_questions = []
    all_parse_failed = []
    all_cross_suspects = []
    for page_no, text in pages_text:
        text_cleaned = _strip_header_footer(text)
        qs, failed, cross = parse_questions_from_text(text_cleaned, slug, page_no)
        all_parse_failed.extend(failed)
        all_cross_suspects.extend(cross)
        for q in qs:
            q["id"] = slug + "_" + q["id"]
            q["_page_no"] = page_no
            all_questions.append(q)

    if len(all_questions) < 3 and len(pages_text) > 0:
        full_cleaned = _strip_header_footer(full_text)
        qs, failed, cross = parse_questions_from_text(full_cleaned, slug, None)
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
            q["_page_no"] = 1
            all_questions.append(q)

    missing_explanation = 0
    image_questions_count = 0
    missing_image_count = 0
    mismatch_images = []
    image_decisions = []

    question_index = {}
    if assets_root:
        try:
            import fitz
            print("建題號索引...", end=" ", flush=True)
            question_index = build_question_index(pdf_path)
            print("產圖中...", end=" ", flush=True)
        except Exception:
            pass

    for q in all_questions:
        if not (q.get("explanation") or "").strip():
            missing_explanation += 1
        q.pop("_page_no", 1)
        q_num_short = q["id"].split("_")[-1]
        if _is_suspected_image_question(q.get("question_text", ""), q.get("options") or []):
            image_questions_count += 1
            if assets_root and question_index:
                stem = (q.get("question_text") or "").strip()
                stem_for_cal = stem[:30]
                force_image = should_force_image(q.get("question_text") or "")
                rel, skipped_no_graphic, decision = _render_crop_question_image_v122(
                    pdf_path, q_num_short, slug, assets_root, question_index, mismatch_images,
                    question_text=stem_for_cal,
                    force_image=force_image,
                )
                image_decisions.append({"dataset_id": slug, "qno": q_num_short, "image_decision": decision, "image_path": rel or ""})
                if rel:
                    q["assets"] = [{"type": "image", "src": rel, "alt": "題目圖"}]
                elif not skipped_no_graphic:
                    missing_image_count += 1

    report.append({
        "file": pdf_path.name,
        "dataset_id": slug,
        "parsed": len(all_questions),
        "parse_failed_count": len(all_parse_failed),
        "parse_failed": all_parse_failed,
        "cross_question_suspects_count": len(all_cross_suspects),
        "cross_question_suspects": all_cross_suspects,
        "missing_explanation_count": missing_explanation,
        "image_questions_count": image_questions_count,
        "missing_image_count": missing_image_count,
        "errors": [{"qno": m["qno"], "reason": m["reason"], "image_path": m.get("image_path", ""), "image_decision": m.get("image_decision", "")} for m in mismatch_images],
        "mismatch_images": mismatch_images,
        "image_decisions": image_decisions,
    })
    print("", flush=True)  # 換行，讓 main 的輸出另起一行
    return slug, all_questions


def main():
    global ROOT
    parser = argparse.ArgumentParser(description="MLH Quiz: PDF → JSON 題庫")
    parser.add_argument("--input-dir", default=DEFAULT_INPUT, help="PDF 所在資料夾（相對專案根）")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT, help="輸出目錄（相對專案根）")
    parser.add_argument("--root", default=None, help="專案根目錄（供 Colab 指定，如 /content/mlh）")
    parser.add_argument("--debug", action="store_true", help="僅輸出第一份 PDF 前兩頁文字到 scripts/debug_pdf_sample.txt，不寫入題庫")
    args = parser.parse_args()

    if args.root:
        ROOT = Path(args.root).resolve()
    input_dir = ROOT / args.input_dir
    output_dir = ROOT / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if PDF_ENGINE is None:
        print("請先安裝 PDF 套件（擇一）：")
        print("  pip install pdfplumber   # 建議，Python 3.6 可用")
        print("  pip install pymupdf       # 需 Python 3.7+ 且可編譯")
        return 1

    if not input_dir.is_dir():
        print("找不到輸入目錄: {}".format(input_dir))
        return 1

    pdf_files = sorted(input_dir.glob("*.pdf"))
    if not pdf_files:
        print("在 {} 下沒有找到 .pdf 檔案".format(input_dir))
        return 1

    if args.debug:
        sample_path = pdf_files[0]
        pages_text = extract_text_from_pdf(sample_path)
        out_path = ROOT / "scripts" / "debug_pdf_sample.txt"
        lines = ["=== {} (共 {} 頁) ===\n".format(sample_path.name, len(pages_text))]
        for page_no, text in pages_text[:2]:
            lines.append("--- 第 {} 頁 ---\n".format(page_no))
            lines.append(text or "(無文字)\n")
            lines.append("\n")
        write_text(out_path, "".join(lines))
        print("已寫入 {}，請檢查題目格式（題號、答案、選項 ①②③④ 或 (1)(2)(3)(4)）".format(out_path))
        return 0

    report = []
    datasets = []
    # 不自動加入 v1：index 僅含實際產出的題庫，避免 verify 因缺 questions_v1.json 失敗

    assets_root = ROOT / "public" / "assets"
    assets_root.mkdir(parents=True, exist_ok=True)
    try:
        import fitz
        print("（已偵測到 PyMuPDF，將為圖題產出 PNG）", flush=True)
    except ImportError:
        print("（未安裝 PyMuPDF，圖題將無法產圖；請在 Colab 或 Python 3.7+ 環境執行以產圖）", flush=True)

    n_total = len(pdf_files)
    print("共 {} 份 PDF，預估需 10～20 分鐘，請勿中斷。".format(n_total), flush=True)
    for idx, pdf_path in enumerate(pdf_files, 1):
        print("處理中 ({}/{}): {} ...".format(idx, n_total, pdf_path.name), flush=True)
        slug, questions = process_pdf(
            input_dir, output_dir, pdf_path, report, assets_root=str(assets_root)
        )
        out_file = output_dir / ("questions_" + slug + ".json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        label = slug_to_label(slug)
        datasets.append({"id": slug, "label": label, "file": "questions_" + slug + ".json"})
        print("  {} -> {} ({} 題)".format(pdf_path.name, out_file.name, len(questions)), flush=True)

    index = {"datasets": datasets, "default_dataset": "ALL"}
    write_text(output_dir / "index.json", json.dumps(index, ensure_ascii=False, indent=2))

    # 原子版本號：前端用 data_version 對所有 /data/* 與 /assets/* 請求加 ?v= 避免 PWA 吃到舊快取
    from datetime import datetime
    data_version = datetime.now().strftime("%Y-%m-%d-%H%M")
    generated_at = datetime.now().isoformat()
    meta = {"data_version": data_version, "generated_at": generated_at}
    write_text(output_dir / "meta.json", json.dumps(meta, ensure_ascii=False, indent=2))
    print("meta.json (data_version={}) 已寫入 {}".format(data_version, output_dir))

    report_path = ROOT / "scripts" / "import_report.json"
    write_text(report_path, json.dumps(report, ensure_ascii=False, indent=2))
    print("index.json、各 questions_*.json 已寫入 {}".format(output_dir))
    print("import_report.json 已寫入 {}".format(report_path))

    total_missing = sum(r.get("missing_image_count", 0) for r in report)
    if total_missing > 0:
        print("")
        print("【圖題】有 {} 題未產出圖檔。請安裝 PyPDF2（Python 3.6 可用）後重新執行：".format(total_missing))
        print("  pip install PyPDF2")
        print("  python3 scripts/import_pdfs_to_datasets.py --input-dir \"raw_pdfs:\"")
        print("（若 PDF 符號為向量非點陣圖，需本機安裝 poppler 或改用 Python 3.7+ 裝 pymupdf）")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)

# 複選題（multi）管線說明 — Phase 1 / 2A / 2B

與 **單選（single）** 完全分離：獨立目錄、獨立腳本、獨立 KPI／簽核包，不影響 `public/data/` 根目錄既有題庫與 `verify:data` / `prebuild`。

---

## Phase 2A vs 2B（範圍聲明）

| 狀態 | 內容 |
|------|------|
| **Phase 2A（已完成）** | multi **匯入管線**：`import_pdfs_to_multi.py`、`import_report_multi.json`、`import_last_run_multi.log`、與 `summary → verify → kpi → approval:bundle:multi` 串接；**CI / 本機 smoke** 可全綠。 |
| **Phase 2B（未完成）** | **真實 multi PDF 題庫**：`raw_pdfs_multi` 內須有實際 `.pdf`、關閉 demo fallback、題量與簽核包須反映**真實匯入**（見下方「正式驗收」）。 |

**Demo fallback（僅 smoke）**：當 `raw_pdfs_multi` 內**沒有任何 PDF** 時，`import:multi`（未加 `--no-demo-fallback`）會自動寫入 **2 題 Demo**，僅用於**管線連通性測試**，**不代表**正式複選考古題庫已匯入完成。

---

## 資料路徑

| 項目 | 路徑 |
|------|------|
| 複選題庫根目錄 | `public/data/multi/` |
| 版本資訊 | `public/data/multi/meta.json`（`data_version`） |
| 題庫清單 | `public/data/multi/index.json`（`bank_kind`、`datasets[]`） |
| 題目檔 | `public/data/multi/questions_<dataset_id>.json`（根為陣列） |
| 複選 PDF 來源（不入庫 PDF 本體） | `raw_pdfs_multi/*.pdf`（可僅 `.gitkeep`） |
| verify 產物（建置產出，不提交） | `public/data/multi/verify_result_multi.json` |
| 匯入 log（不提交） | `scripts/import_last_run_multi.log` |
| 混合匯入 log（不提交） | `scripts/import_last_run_mixed.log` |
| Parser debug（不提交） | `scripts/parser_debug_multi/` |

---

## 題目 JSON（multi）欄位

每題為物件，**至少**：`id`、`question_type: "multi"`、`question_text`、`options`（長度 4）、`correct_answers`（長度 ≥2、僅 A–D、至少兩個不同字母）。

**可選**：`assets`、`explanation`、`source`、`source_display`、`multi_parse_flags`（如 `answer_placeholder`、`options_placeholder`、`answer_parse_method`）等。

---

## npm 指令

```bash
npm run summary:multi
npm run verify:multi
npm run kpi:multi
npm run approval:bundle:multi

# Phase 2A smoke（無 PDF 時可走 demo fallback，totalWrittenQuestionsMulti=2）
npm run import:multi
npm run import:multi:then:approval

# Phase 2B 正式匯入（無 PDF 直接失敗，不走 demo）
npm run import:multi:real
npm run import:multi:real:then:approval

# 混合 PDF：匯入後接 verify:data + verify:multi + approval:bundle:multi
npm run import:mixed:then:approval
```

### 混合 PDF（同檔 single + multi）

- **目錄**：`raw_pdfs_mixed/*.pdf`（與 `import:allpdf` / `import:multi` 分開，避免誤覆寫）。
- **指令**：`npm run import:mixed`（`scripts/import_pdfs_mixed.py`）。
- **行為**：全文依分區標記（`單選題` / `單選選擇題` / `複選題` / `複選選擇題`）切 segment，再於各 segment 內用與 single 相同的題號切塊；依「分區 + 答案數量」分流至 `public/data/` 與 `public/data/multi/`，**conflict / suspect** 題不寫入兩邊題庫，僅列入 `scripts/import_report_mixed.json`。
- **index / import_report**：與既有題庫 **合併**（同 `dataset_id` 覆寫、其餘保留），避免只匯入一份混合卷就清空整庫。
- **產物**：`import_report_mixed.json`（含 `files[]` 每檔統計與頂層加總）、`import_report.json` / `import_report_multi.json` 合併更新；`import_report_mixed.json` 已列入 `.gitignore`。
- **一鍵驗收**：`npm run import:mixed:then:approval`（等同手動執行 `python3 scripts/import_pdfs_mixed.py --input-dir raw_pdfs_mixed`，再跑 `verify:data`、`verify:multi`、`approval:bundle:multi`；stdout/stderr 寫入 `import_last_run_mixed.log`）。

#### 混合卷正式驗收（建議流程）

1. 將**真實混合 PDF** 放入 `raw_pdfs_mixed/`（可一次多檔；正式驗收可先只放 1 份）。
2. 執行：`python3 scripts/import_pdfs_mixed.py --input-dir raw_pdfs_mixed`（或 `npm run import:mixed` / `npm run import:mixed:then:approval`）。
3. 讀取 **`scripts/import_report_mixed.json`**（若被 gitignore 忽略，請在本機開檔查看）：頂層 `single_count` / `multi_count` / `conflict_count` / `suspect_count`，以及 `files[].issues`（conflict / suspect 題號與原因）。
4. **門檻建議**：若 `conflict_count` 或 `suspect_count` 相對題量異常偏高，應先檢視 PDF 分區字樣、答案列格式或 parser，**勿**手動把問題題硬塞進題庫。
5. 匯入後執行：`npm run verify:data`、`npm run verify:multi`（須 `error_count: 0`）、`npm run approval:bundle:multi`。
6. **覆寫範圍**：本次 PDF 對應的 `dataset_id`（檔名 slug）會更新 `public/data/questions_<id>.json` 與 `public/data/multi/questions_<id>.json`，並在 `index.json` 合併條目；**其他 dataset 的題檔不會被刪除**，但若與本批 slug 相同則整檔覆寫。

---

## Phase 2A：匯入命令與輸出

- **Smoke**：`python3 scripts/import_pdfs_to_multi.py --input-dir raw_pdfs_multi`（npm：`import:multi`）  
  - 目錄內**無 PDF** 時 → **Demo fallback**（stderr `WARNING`），寫入 2 題，**僅驗管線**。
- **正式匯入入口**：加 **`--no-demo-fallback`**（npm：`import:multi:real`）  
  - **無 PDF → exit 1**，絕不寫 Demo。  
  - 有 PDF 時需已安裝 **pdfplumber**（或 single 同款 PDF 引擎），否則失敗。
- **`--demo`**：僅寫入 Demo、不讀目錄 PDF。
- **輸出**：`public/data/multi/index.json`、`meta.json`、`questions_<slug>.json`、`scripts/import_report_multi.json`。
- **5 行診斷**（寫入 `import_last_run_multi.log`）：  
  `IMPORT_OUTPUT_JSON_MULTI=`、`wroteIndexMulti=`、`wroteQuestionsFilesCountMulti=`、`wroteQuestionsFilesSampleMulti=`、`totalWrittenQuestionsMulti=`
- **回滾**：匯入前若 `public/data/multi` 非空，備份至 `scripts/backup/<timestamp>/public_data_multi/`。

---

## Phase 2B：正式驗收條件（題庫層）

以下**全部**滿足才可宣稱「真實 multi 題庫匯入」驗收完成（非僅 Phase 2A）：

1. **`raw_pdfs_multi/` 內存在真實 `.pdf`**（非僅 `.gitkeep`）。
2. 使用 **`npm run import:multi:real`** 或 **`import:multi:real:then:approval`**（或手動執行 Python 時帶 **`--no-demo-fallback`**），**禁止**依賴 demo fallback。
3. 簽核包內 **`totalWrittenQuestionsMulti` > 2**（Demo 固定為 2；真實題庫應高於此門檻）。
4. **`scripts/approval_bundle_multi.txt`** 與 **`scripts/import_last_run_multi.log`** 的 5 行須與**本次真實 PDF 匯入**一致（非 Demo 產物敘述）。
5. **`verify:multi`**：`error_count == 0`；**KPI**：`ImportedThisRunMulti == BankTotalThisRunDatasetsMulti`、`BankTotalAllMulti >= ImportedThisRunMulti`。

---

## 答案解析（匯入 v1）

自題塊前段擷取複選答案，支援：`(1)(3)`、`(A)(C)`、`①③`、`答案：1、3`、`A,C`、`AC` 等；無法解析時使用 **`correct_answers: ["A","B"]`** 並標記 `answer_placeholder`；選項失敗時四格 `(選項未辨識)` 並標記 `options_placeholder`。

---

## import_report_multi.json

陣列；每筆含 `dataset_id`、`file`、`parsed`、`errors`、`suspicious_count` 等。無檔或無匯入回合時，`ImportedThisRunMulti = 0`，題數計入 **LegacyBankMulti**。

---

## 驗收方式（Phase 1）

`npm run approval:bundle:multi`；簽核包內 `verify:multi` 為 **`error_count: 0`**。**不得**修改 `prebuild` 內 single `verify:data`。

---

## Phase 2A 驗收（管線 smoke）

`npm run import:multi:then:approval` 可全綠；此時若無 PDF，**預期** `totalWrittenQuestionsMulti=2`（Demo），**不**代表 Phase 2B 完成。

---

## 合併前 PR Comment（Phase 1.5）

見 `scripts/pr_comment_template_multi.md`；`pr_comment_merge_check_multi.md` 已 gitignore。

---

## Phase 3（預告）

UI：`/multi` 路由、獨立 state、錯題本與進度獨立。

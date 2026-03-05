# AUTOPILOT_TASKS.md（給 Cursor 的工作規格）

## 目標

把 PDF 題庫匯入後，**題庫總題數（Bank Total）** 提升到至少 **1000+**。

## 必須輸出的三個結果檔

| 檔案 | 說明 |
|------|------|
| `scripts/pdf_expected_count.json` | 每份 PDF 估算題數（題數宣告或匯入報告 parsed） |
| `scripts/import_report.json` | 既有匯入報告，需由匯入流程更新 |
| `scripts/question_bank_summary.json` | 既有題庫盤點，需由 summary 腳本更新 |

## 必須提供的一鍵命令

| 命令 | 說明 |
|------|------|
| `npm run import:allpdf` | 跑完整匯入（含產圖，若有 PyMuPDF） |
| `npm run verify:data` | 資料完整性檢查（缺檔/缺圖/JSON 壞掉則 exit 1） |
| `npm run kpi:report` | 輸出 Expected / Imported / BankTotal 三數字與差異 |

## 合格條件（保守）

- **Imported** ≥ 0.9 × **Expected**
- **Bank Total** ≥ **Imported**（或等於 Imported + 舊題庫）
- `npm run verify:data` 零 error

## 改動規範

- 排除 `node_modules`
- 先在本機跑通，再提交
- PR 描述包含 **KPI 三數字與差異**（Expected、Imported、BankTotal）

## KPI 三數字定義

| 名稱 | 來源 |
|------|------|
| **Expected** | `scripts/pdf_expected_count.json` 的 `totalExpected`（PDF 題數宣告或匯入報告 parsed 加總） |
| **Imported** | `scripts/import_report.json` 每份 `parsed` 加總 |
| **Bank Total** | `npm run summary:questions` 的 TOTAL（題庫 JSON 總題數） |

## 匯入前備份與 PDF 需求

- **備份**：匯入腳本在寫入前會自動將現有 `public/data` 備份至 `scripts/backup/<YYYY-MM-DDTHH-MM-SS>/public_data/`，可回滾。
- **PDF 位置**：本 repo 預設使用 `raw_pdfs:`（15 份 PDF）。`npm run import:allpdf` 已帶入 `--input-dir "raw_pdfs:"`。
- **若出現「請先安裝 PDF 套件」**：執行 `pip install pdfplumber`（或 `pip install pymupdf`）後再執行 `npm run import:allpdf`。
- **匯入結束後**：一律執行 `npm run approval:bundle`，產出 `scripts/approval_bundle.txt`；PR 描述貼該檔內容。簽核標準見 **docs/APPROVAL_CHECKLIST.md**（小LIN 簽核清單 v1）。

## 匯入腳本寫入確認

跑完 `npm run import:allpdf` 後，腳本最後會輸出一行 **IMPORT_OUTPUT_JSON**，內含：

- `wroteQuestionsFiles`：各 `questions_*.json` 的**絕對路徑**
- `wroteIndex`：`index.json` 的**絕對路徑**
- `totalWrittenQuestions`：寫入題數（應等於 Imported）

請確認上述路徑均在 `public/data/` 下，且 `totalWrittenQuestions` 與 `npm run kpi:report` 的 Imported 一致。

## KPI 與 CI 失敗條件

- **Diff = Imported - BankTotal**：若 **Diff > 0**，`npm run kpi:report` 會 **exit(1)**（題庫未與匯入同步）。
- 可選：`KPI_FAIL_IF_BANK_UNDER=1000 npm run kpi:report`，則 Bank Total < 1000 時也會 exit(1)。
- 建議在 Vercel Build 或 prebuild 中執行 `npm run kpi:report`，以在 PR 上自動驗收。

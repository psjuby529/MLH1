# 小LIN 簽核清單 v2（正式版）

簽核流程：**Cursor 做事 → 產出簽核包 → 貼三段輸出 → 小LIN 簽核/退回。**

---

## 產出簽核包（自動）

匯入前建議先跑 **PDF 集合一致性**，再跑匯入與簽核包：

```bash
npm run verify:pdfset
npm run import:then:approval
npm run approval:bundle
```

會產生 **scripts/approval_bundle.txt**。PR 描述貼：該檔全文 + **import_last_run.log 的 5 行** + **verify:pdfset 的 missing/extra 結果**（兩行即可）。

---

## 三段結果（簽核只看這三個）

1. **npm run kpi:report** — v2 四個數字：**ImportedThisRun**、**BankTotalThisRunDatasets**、**LegacyBank**、**BankTotalAll**
2. **npm run summary:questions** — **TOTAL**（應與 BankTotalAll 一致）
3. **ls -lt public/data | head -n 5** — 檔案與**時間**

---

## 通過標準（v2）

- **ImportedThisRun == BankTotalThisRunDatasets**（本輪匯入完整性）
- **BankTotalAll ≥ 2037**（全站總題量）
- **public/data 的檔案時間為本次匯入後**（代表已寫回本機）

---

## 硬退回（僅此三種）

| 狀況 | 判定 |
|------|------|
| **ImportedThisRun ≠ BankTotalThisRunDatasets** | 硬退回 |
| **BankTotalAll < 2037** | 硬退回 |
| **public/data 檔案時間不是本次匯入後** | 硬退回（代表沒寫回本機 public/data） |

其餘（如 npm warn、next security、npm minor update）**不影響本次簽核**。

---

## 簽核時請貼三樣（避免口徑混亂）

1. **scripts/approval_bundle.txt** 全文  
2. **import_last_run.log** 的 5 行診斷  
3. **verify:pdfset** 的 missing/extra 結果（兩行即可）

**一句話簽核**：貼這一行即可  
`ImportedThisRun = ? , BankTotalThisRunDatasets = ? , LegacyBank = ? , BankTotalAll = ?`  
若 `ImportedThisRun = BankTotalThisRunDatasets`、`BankTotalAll ≥ 2037`，即通過。

**根因定位（Expected vs Parsed 不一致時）**：執行 `npm run rootcause:pdf` 產出 `scripts/pdf_rootcause_report.md`。PR 描述頂部可貼：報告前 30 行（或摘要段）+ 任 3 份 PDF 診斷行（sha256 前 16 字、pages_with_text/total、has_question_number_pattern）。

## 未達標時 PR 描述請貼（方便一次鎖定卡點）

匯入 log 頂部 5 行（匯入成功時會出現在 log 中）：

- `IMPORT_OUTPUT_JSON=<輸出根目錄絕對路徑>`
- `wroteIndex=<index.json 絕對路徑>`
- `wroteQuestionsFilesCount=<n>`
- `wroteQuestionsFilesSample=<前 3 個 questions_*.json 絕對路徑>`
- `totalWrittenQuestions=<n>`

若使用 `npm run import:then:approval`，上述 5 行會寫入 `scripts/import_last_run.log`，可貼至 PR 描述頂部。

## 風險控制（Cursor 必須遵守）

- 匯入前自動備份至 `scripts/backup/<timestamp>/public_data/`，可回滾。
- 不使用 `npm audit fix --force`，避免破壞匯入流程。

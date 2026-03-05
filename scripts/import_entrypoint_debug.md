# 匯入入口除錯說明（第三階段）

## 實際執行的命令

**先建立環境（僅首次或新 clone 後）：**

```bash
npm run py:setup
```

**匯入：**

```bash
npm run import:allpdf
```

對應（使用專案 .venv）：

```bash
.venv/bin/python3 scripts/import_pdfs_to_datasets.py --input-dir "raw_pdfs:"
```

（等價於手動執行上述 python 指令，需在專案根目錄；須先 `npm run py:setup`。）

## PDF 輸入目錄（input dir）

- **npm 預設**：`raw_pdfs:`（本機 15 份 PDF 所在目錄，相對專案根）
- **絕對路徑**：`<專案根>/raw_pdfs:`（例如 `/Users/.../近十年考古AI/raw_pdfs:`）
- **腳本預設參數**：`--input-dir` 預設為 `raw_pdfs`；若目錄名含冒號則須傳 `"raw_pdfs:"`

## 輸出目錄（output dir）

- **預設**：`public/data`（相對專案根）
- **絕對路徑**：`<專案根>/public/data`
- **寫入檔案**：
  - `questions_<slug>.json`（每份 PDF 一個）
  - `index.json`（datasets 清單，前端讀此檔）
  - `meta.json`（data_version）

## 匯入前備份

- 若 `public/data` 已有內容，腳本會先備份至：
  - `scripts/backup/<YYYY-MM-DDTHH-MM-SS>/public_data/`

## 匯入完成後必跑

```bash
npm run approval:bundle
```

產出 `scripts/approval_bundle.txt`，PR 描述貼該檔內容供簽核。

## 一鍵：匯入 + 簽核包（可選）

```bash
npm run import:then:approval
```

會依序執行 `import:allpdf`、`approval:bundle`；匯入的 stdout/stderr 會寫入 **scripts/import_last_run.log**。若匯入成功，log 內會出現 5 行診斷（IMPORT_OUTPUT_JSON / wroteIndex / wroteQuestionsFilesCount / wroteQuestionsFilesSample / totalWrittenQuestions），可貼至 PR 頂部供小LIN 一次鎖定寫入結果。

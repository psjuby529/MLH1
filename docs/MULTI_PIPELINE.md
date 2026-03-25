# 複選題（multi）管線說明 — Phase 1

與 **單選（single）** 完全分離：獨立目錄、獨立腳本、獨立 KPI／簽核包，不影響 `public/data/` 根目錄既有題庫與 `verify:data` / `prebuild`。

---

## 資料路徑

| 項目 | 路徑 |
|------|------|
| 複選題庫根目錄 | `public/data/multi/` |
| 版本資訊 | `public/data/multi/meta.json`（`data_version`） |
| 題庫清單 | `public/data/multi/index.json`（`datasets[]`，每筆含 `id`、`label`、`file`） |
| 題目檔 | `public/data/multi/questions_<dataset_id>.json`（根為陣列） |
| verify 產物（建置產出，不提交） | `public/data/multi/verify_result_multi.json` |

---

## 題目 JSON（multi）欄位

每題為物件，**至少**：

| 欄位 | 說明 |
|------|------|
| `id` | 字串或數字，唯一識別 |
| `question_type` | 固定 `"multi"` |
| `question_text` | 題幹（非空字串） |
| `options` | 長度 **4** 的陣列（四個選項文字） |
| `correct_answers` | 長度 **≥2** 的陣列，元素僅能為 `"A"`、`"B"`、`"C"`、`"D"`，且至少兩個不同字母 |

**可選**：`assets`、`explanation`、`source`、`source_display` 等（與 single 慣例對齊即可）。

---

## npm 指令

```bash
npm run summary:multi      # 產出 scripts/question_bank_summary_multi.json
npm run verify:multi       # 檢查 multi 資料；error_count 必須為 0
npm run kpi:multi          # KPI v2 口徑（multi）
npm run approval:bundle:multi   # 一鍵產出 scripts/approval_bundle_multi.txt
```

---

## 本輪匯入報告（Phase 2 啟用）

- 預期檔案：`scripts/import_report_multi.json`（陣列，每筆含 `dataset_id`、`parsed` 等，與 single 的 `import_report.json` 對齊）。
- Phase 1：可無此檔；此時 `ImportedThisRunMulti = 0`，且無「本輪檔名集合」，所有 `questions_*.json` 題數計入 **LegacyBankMulti**（與 single 在無匯入報告時行為一致）。

---

## 驗收方式（Phase 1）

1. 執行 `npm run approval:bundle:multi`。
2. 開啟 `scripts/approval_bundle_multi.txt`，確認：
   - KPI 四數字 + `bankTotalSource`
   - `summary:multi` 的 TOTAL
   - `ls public/data/multi` 前 5 行
   - `verify:multi` 顯示 **`error_count: 0`** 且 **exit 0**

**不得**修改 `prebuild` 中的 single `verify:data`（避免影響現有 Vercel 部署）。

---

## Phase 2（本文件預告，尚未實作）

- Python 匯入器輸出至 `public/data/multi/`，並寫入 `import_report_multi.json`。
- UI：`/multi` 路由、獨立 state key（`multi_` 前綴）、錯題本與進度獨立。

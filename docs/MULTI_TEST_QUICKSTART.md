# Multi 內測頁快速說明（`/multi-test`）

## 用途

在手機或桌機上**快速驗證複選題庫**（multi），非正式產品路由。

## 怎麼開

1. 本機：`npm run dev`，瀏覽器開 `http://localhost:3000/multi-test`  
2. 手機：電腦與手機同一區網時，用 `http://<電腦區網IP>:3000/multi-test`（需防火牆允許 3000）。

## 題庫範圍

- 僅 **13 份** allowlist：`y105`～`y113`、`y90006`～`y90009`（見 `app/lib/multiTestAllowlist.ts` 與 `docs/MIXED_UAT_ALLOWLIST.md`）。  
- **不含** 綜合 A／綜合 B。

## 操作

1. 上方下拉選題庫。  
2. 勾選一個或多個選項（A–D）。  
3. 按 **確認答案**：與後端 `correct_answers` **集合完全相同**才算對（順序不拘）。  
4. **上一題／下一題** 會清空選取與作答結果。

## 注意

- 需已匯入 multi 題檔至 `public/data/multi/`，且 `verify:multi` 可通過。  
- 本頁不寫入錯題本、不統計進度。

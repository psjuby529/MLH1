# 合併前 Comment 範本（Reviewer 快速驗收）

> **用途**：PR 合併前補一則 comment，讓 Reviewer 一眼確認 Preview、commit 一致、multi 驗收 OK。  
> **填寫**：手動替換括號內文字；或執行 `npm run approval:bundle:multi` 後使用產出檔 `scripts/pr_comment_merge_check_multi.md`（已帶 commit、`error_count`、`TOTAL`；**Vercel Preview URL 仍須手動貼上**）。

---

複製以下區塊到 GitHub PR comment：

```md
### 合併前補充（Vercel + multi 簽核精簡）

- **Vercel Preview URL**：`（貼上；若無則填：無／僅 Production）`
- **驗證 commit**：`（填本 PR 最新 commit SHA）`

- **`npm run approval:bundle:multi`（精簡結果）**
  - `verify:multi` → **`error_count: （必須為 0）`**
  - `summary:multi` → **`TOTAL (multi): （填數字）`**

以上於本機／CI 在 **與本 PR 相同 commit** 上執行；**Build OK** 與完整簽核包仍以 PR 描述為準。  
Reviewer 一眼可確認：有 Preview 可點、數字與 Phase 1 預期一致、error_count=0 → 可安心 Merge。

> 可選：若希望後續更自動化，可在 Vercel Preview 的 Build 後加跑 `npm run approval:bundle:multi`，再把 error_count / TOTAL 從 Build Log 複製貼到此 comment。
```

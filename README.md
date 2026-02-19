# MLH Quiz — 室內裝修工程管理刷題 PWA

MLH（松本霖）內部使用的證照刷題 PWA，支援每日刷題、即時對錯、計分、錯題本，並可安裝到手機桌面（Android 小米優先）與離線刷題。

## 上架到 GitHub + Vercel + 小米手機

**完整步驟（建立倉庫 → 推程式 → 部署 → 手機安裝）請看 [DEPLOY.md](./DEPLOY.md)**，照做即可在小米上順暢使用。

## 本機啟動

```bash
npm install
npm run dev
```

瀏覽器打開 [http://localhost:3000](http://localhost:3000)，確認可刷題、計分、錯題本正常。

## 推到 GitHub（私有倉庫）

```bash
git init
git add .
git commit -m "init mlh quiz pwa"
git branch -M main
git remote add origin https://github.com/<你的帳號>/mlh-quiz.git
git push -u origin main
```

請先在 GitHub 建立 **Private** 倉庫 `mlh-quiz`，再執行上述指令（將 `<你的帳號>` 換成你的 GitHub 帳號）。

## 在 Vercel 部署

1. 登入 [Vercel](https://vercel.com)，點 **Add New Project**。
2. 選擇 **Import** 從 GitHub 選取 `mlh-quiz` 倉庫。
3. 維持預設（Framework Preset: Next.js），點 **Deploy**。
4. 完成後會得到一個 HTTPS 網址，例如：`https://mlh-quiz.vercel.app`。

之後每次推送到 `main`，Vercel 會自動重新建置與部署。

## 小米 Android 安裝成桌面 App

### 方式 A：Chrome（建議）

1. 用 **Chrome** 打開你的 Vercel 網址。
2. 右上角 **⋮**（三點選單）。
3. 選 **安裝應用程式** 或 **加入主畫面**。
4. 確認後，桌面會出現「MLH Quiz」圖示，點開即全螢幕像 App 使用。

### 方式 B：小米瀏覽器

1. 用小米瀏覽器打開網址。
2. 選單 → **加入桌面**（依版本字樣可能略有不同）。

若某款機型無法安裝，建議以 Chrome 為主。

## 離線測試

1. 先用 Chrome 或已安裝的 PWA 打開網站，讓題庫與畫面至少載入一次。
2. 開啟 **飛航模式** 或關閉 Wi‑Fi。
3. 從桌面點「MLH Quiz」圖示進入。
4. 應仍可進入首頁並開始刷題（題庫已由 Service Worker 快取）。

## 驗收檢查清單

- [ ] 本機 `npm run dev` 可刷題、計分、錯題本可用。
- [ ] 部署到 Vercel 後，`/manifest.webmanifest` 能正常打開。
- [ ] Chrome DevTools → **Application** → **Service Workers** 顯示已註冊。
- [ ] **Application** → **Cache Storage** 可看到 `questions_v1.json` 等快取。
- [ ] 小米 Android 用 Chrome 可「安裝到桌面」。
- [ ] 飛航模式後仍能開啟 App 並刷題。

## 題庫（v1.2 多題庫）

- 題庫索引：`public/data/index.json`（列出所有 datasets）。
- 預設載入「全部題庫」（ALL），也可在首頁「題庫範圍」選單選單一題庫。
- 既有 `questions_v1.json` 保留不刪（回溯用）。

### 從 PDF 匯入題庫（本機執行）

1. 將 PDF 放到專案根目錄下的 `raw_pdfs` 資料夾（若資料夾名為 `raw_pdfs:` 請用下方參數）。
2. 安裝依賴：`pip install pymupdf`
3. 在專案根目錄執行：
   ```bash
   python3 scripts/import_pdfs_to_datasets.py
   ```
   若 PDF 在 `raw_pdfs:`（含冒號）：
   ```bash
   python3 scripts/import_pdfs_to_datasets.py --input-dir "raw_pdfs:"
   ```
4. 產物：
   - `public/data/questions_<id>.json`（每份 PDF 一個）
   - `public/data/index.json`（自動更新 datasets 列表）
   - `scripts/import_report.json`（每份：解析題數、失敗題數、疑似圖題）
5. 之後 `npm run dev` 或部署後即可刷到新題庫；選「全部題庫」即合併所有題目。

## 技術

- Next.js 14（App Router）+ TypeScript + Tailwind CSS
- PWA：手寫 Service Worker（`public/sw.js`）、`manifest.webmanifest`，不依賴 next-pwa
- 錯題本與每日進度：localStorage（`mlh_wrong_ids`、`mlh_wrong_count_map`、`mlh_daily_progress`）

# MLH Quiz — 上架到 GitHub、Vercel 與小米手機

照下面順序做，即可從本機一路到在小米手機上順暢使用。

---

## 第一步：在 GitHub 建立倉庫（只做一次）

1. 打開 [https://github.com/new](https://github.com/new)
2. **Repository name** 填：`mlh-quiz`
3. 選擇 **Private**
4. **不要**勾選 "Add a README"（專案已有）
5. 點 **Create repository**
6. 記下你的 **倉庫網址**，格式為：
   ```text
   https://github.com/你的帳號/mlh-quiz.git
   ```
   例如：`https://github.com/jubylin/mlh-quiz.git`

---

## 第二步：把程式推上 GitHub（複製整段到終端機）

**請先把下面 `你的帳號` 改成你的 GitHub 帳號**，再整段複製貼到終端機執行：

```bash
cd "/Users/jubylin/Desktop/室內裝修管理/學科考古題/近十年考古AI"
git branch -M main
git remote add origin https://github.com/你的帳號/mlh-quiz.git
git push -u origin main
```

- 若出現 **Authentication**：用瀏覽器登入 GitHub，或使用 Personal Access Token 當密碼。
- 若已設好 SSH：可改成 `git remote add origin git@github.com:你的帳號/mlh-quiz.git` 再 push。

推成功後，在 GitHub 網頁應能看到所有程式碼。

---

## 第三步：在 Vercel 部署（點選即可）

1. 打開 [https://vercel.com](https://vercel.com)，用 GitHub 登入
2. 點 **Add New…** → **Project**
3. 在 **Import Git Repository** 選 **mlh-quiz**
4. **Framework Preset** 保持 **Next.js**，其餘用預設
5. 點 **Deploy**
6. 等約 1～2 分鐘，完成後會給一個網址，例如：
   ```text
   https://mlh-quiz-xxxx.vercel.app
   ```
   之後每次 push 到 `main`，Vercel 會自動重新部署。

---

## 第四步：在小米手機上安裝成 App（Chrome 最穩）

1. 用小米手機的 **Chrome** 打開你的 Vercel 網址（必須是 HTTPS）
2. 點右上角 **⋮**（三點選單）
3. 選 **「安裝應用程式」** 或 **「加入主畫面」**
4. 確認後，桌面會出現 **MLH Quiz** 圖示
5. 之後像一般 App 點開即可全螢幕刷題

**若沒有出現「安裝應用程式」：**

- 確認網址是 **https**（Vercel 預設就是）
- 用 **Chrome** 開，不要用小米內建瀏覽器
- 先隨便答幾題、重新整理一次，再試一次選單

---

## 第五步：離線測試（驗證 PWA）

1. 用手機先開一次 MLH Quiz（Chrome 或已安裝的 App），讓題庫載入
2. 開啟 **飛航模式** 或關閉 Wi‑Fi
3. 從桌面點 **MLH Quiz** 圖示進入
4. 應仍可進入並刷題（題庫已由 Service Worker 快取）

---

## 之後更新程式怎麼做？

改完程式後，在專案資料夾執行：

```bash
cd "/Users/jubylin/Desktop/室內裝修管理/學科考古題/近十年考古AI"
git add -A
git commit -m "更新說明"
git push
```

Vercel 會自動重新部署，幾分鐘後手機重新打開或重新整理即可看到新版本。

---

## 快速檢查清單

- [ ] GitHub 已建立 `mlh-quiz` 倉庫（Private）
- [ ] 終端機已執行 `git remote add` 與 `git push`，程式已推上 GitHub
- [ ] Vercel 已 Import `mlh-quiz` 並 Deploy 成功
- [ ] 小米手機用 Chrome 打開 Vercel 網址，已「安裝應用程式」或「加入主畫面」
- [ ] 飛航模式後仍可開啟並刷題

全部勾選即代表從 GitHub 到小米手機的流程都已完成。

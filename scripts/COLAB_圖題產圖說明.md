# 在 Google Colab 產出圖題 PNG（不需本機 poppler / PyMuPDF）

若本機 Python 3.6、brew/poppler 無法使用，可在 **Google Colab** 用 Python 3.7+ 與 PyMuPDF 一次產出所有圖題 PNG，再下載放回專案。

## 步驟

1. **上傳題庫 PDF 到 Google 雲端硬碟**  
   把 `raw_pdfs:` 資料夾內所有 PDF 上傳到雲端硬碟某資料夾，例如 `MyDrive/raw_pdfs/`。

2. **開新 Colab**  
   前往 [colab.research.google.com](https://colab.research.google.com)，新增筆記本。

3. **掛載雲端硬碟並安裝 PyMuPDF**
   ```python
   from google.colab import drive
   drive.mount('/content/drive')

   !pip install pymupdf pdfplumber
   ```

4. **複製匯入腳本到 Colab**  
   把本機的 `scripts/import_pdfs_to_datasets.py` 複製到 Colab 一個 cell，並把腳本開頭的 `ROOT` 改成 Colab 上的路徑（例如雲端硬碟裡的專案資料夾，或你放 PDF + 腳本的目錄）。

5. **在 Colab 執行匯入**  
   在 Colab 終端或 notebook 裡執行：
   ```python
   import sys
   sys.argv = ['', '--input-dir', '/content/drive/MyDrive/raw_pdfs', '--output-dir', '/content/drive/MyDrive/mlh-quiz/public/data']
   # 若你的專案在雲端硬碟，assets 會寫入 /content/drive/MyDrive/mlh-quiz/public/assets
   exec(open('import_pdfs_to_datasets.py').read())
   ```
   或直接在 Colab 用 `%cd` 切到有腳本與 PDF 的目錄後執行：
   ```bash
   !python3 import_pdfs_to_datasets.py --input-dir "/content/drive/MyDrive/raw_pdfs" --output-dir "/content/drive/MyDrive/mlh-quiz/public/data"
   ```
   （路徑請依你的雲端硬碟結構調整。）

6. **下載產出的圖檔**  
   匯入完成後，`public/assets/q/` 下會有各題庫的 PNG。在 Colab 打包下載：
   ```python
   !cd /content/drive/MyDrive/mlh-quiz && zip -r assets_q.zip public/assets/q
   ```
   然後從 Colab 左側「檔案」下載 `assets_q.zip`，在本機解壓到專案根目錄，覆蓋 `public/assets/q/`。

7. **本機更新題庫 JSON（若 Colab 有重跑完整匯入）**  
   若在 Colab 是跑「完整匯入」（含 `--output-dir` 指向雲端硬碟的 `public/data`），則 `questions_*.json` 也會更新，請把雲端硬碟上的 `public/data/*.json` 一併複製回本機專案。若 Colab 只產圖、沒改 JSON，則本機需再跑一次本機匯入（只為寫入 `assets` 到既有 JSON）或手動合併。

## 若只差「圖」、本機已有題庫 JSON

若本機已有正確的 `questions_*.json`，只缺圖檔：

- 在 Colab 用相同 `--input-dir`、`--output-dir` 跑一次完整匯入（會覆寫 JSON 並產圖），再把雲端的 `public/data/*.json` 與 `public/assets/q/` 都下載回本機；或  
- 在 Colab 只產圖（需自訂小腳本：讀本機匯出的題目列表 + 只做 render crop 寫入 `public/assets/q/`），再只下載 `public/assets/q/` 回本機。

以上任一種方式產出 PNG 後，前端會依題目 `assets` 顯示圖題。

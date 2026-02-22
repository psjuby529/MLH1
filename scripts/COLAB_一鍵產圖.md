# Colab 一鍵產圖（圖題 PNG）

本機無法產圖時，用 **Google Colab** 一次產出圖題 PNG。**只需上傳一個 zip。**

---

## 腳本在哪裡取得？

腳本在專案裡：

- **路徑**：`scripts/import_pdfs_to_datasets.py`  
- **本機完整路徑**（依你的專案位置）：  
  `室內裝修管理/學科考古題/近十年考古AI/scripts/import_pdfs_to_datasets.py`

用檔案總管或 Finder 打開專案資料夾 → 進入 **scripts** → 就會看到 **import_pdfs_to_datasets.py**。

---

## 事前準備（本機做一次）：做「一個」zip

Colab 一次只能選一個檔案，所以把 **所有 PDF** 和 **腳本** 包成**一個 zip** 再上傳。

**用 Mac 最簡單的方式做即可：**

1. 打開放 PDF 的資料夾（例如 `raw_pdfs`），**選取裡面的所有 PDF**（可全選）。
2. 把專案裡的 **`scripts/import_pdfs_to_datasets.py`** 也**複製**到同一個資料夾（和 PDF 放在一起）。
3. 在該資料夾裡 **選取「所有 PDF + import_pdfs_to_datasets.py」**（例如 15 個 PDF + 1 個 .py，共 16 個項目）。
4. 右鍵 → **「壓縮 16 個項目」**（或「壓縮『xxx』等 16 個項目」）→ 會得到 **「封存.zip」**（或「Archive.zip」）。

**Mac 壓縮後會多一層「封存」資料夾，沒關係。**  
解壓後結構會像這樣（這樣就對了）：

```
zip 解壓後
└── 封存/          ← Mac 自動產生的上層資料夾（英文可能是 Archive）
    ├── 105-xxx.pdf
    ├── 106-xxx.pdf
    ├── ...
    ├── 綜合A.pdf
    ├── 綜合B.pdf
    └── import_pdfs_to_datasets.py
```

Colab 第二段會**自動找到**「封存」裡面的 PDF 與腳本，不用改任何東西。

---

## Colab：只貼兩次、只上傳一個檔案

**1. 打開** https://colab.research.google.com → **新增筆記本**。

**2. 第一次複製**：貼到第一個 cell → 執行（▶）→ 跳出選檔時**只選你剛做的那一個 zip**（例如 `colab_upload.zip`）→ 等跑完。

```python
# === 第一次複製：安裝 + 上傳「一個 zip」（zip 裡要有 raw_pdfs/ 和 import_pdfs_to_datasets.py）===
!pip install -q pymupdf pdfplumber
!mkdir -p /content/public/data /content/public/assets
from google.colab import files
uploaded = files.upload()
```

**3. 第二次複製**：貼到第二個 cell → 執行（▶）→ **約需 10～20 分鐘，請勿中斷** → 跑完會自動下載 **`mlh_assets_and_data.zip`**。

> **重要**：第二段會即時印出「處理中 (1/15): xxx.pdf」等進度；15 份 PDF 解析＋建索引＋產圖約需 **10～20 分鐘**，請耐心等待、不要按中斷。

```python
# === 第二次複製：解壓 → 自動找 PDF 目錄與腳本 → 匯入產圖 → 打包下載 ===
import zipfile, os
from io import BytesIO
for name in uploaded:
  with zipfile.ZipFile(BytesIO(uploaded[name]), 'r') as z:
    z.extractall('/content')
  print('已解壓:', name)
  break
SKIP_DIRS = ('public', 'sample_data', 'drive', '__MACOSX')
def count_pdf(d):
  try: return sum(1 for f in os.listdir(d) if f.lower().endswith('.pdf'))
  except: return 0
pdf_dir = None
if count_pdf('/content') > 0:
  pdf_dir = '/content'
if not pdf_dir:
  for preferred in ['封存', 'Archive', 'archive', 'raw_pdfs']:
    p = os.path.join('/content', preferred)
    if os.path.isdir(p) and count_pdf(p) > 0:
      pdf_dir = p
      break
if not pdf_dir:
  best_count = 0
  for item in sorted(os.listdir('/content')):
    if item in SKIP_DIRS: continue
    p = os.path.join('/content', item)
    if not os.path.isdir(p): continue
    n = count_pdf(p)
    if n > best_count: best_count = n; pdf_dir = p
    for sub in os.listdir(p):
      if sub in SKIP_DIRS: continue
      sp = os.path.join(p, sub)
      if os.path.isdir(sp):
        n = count_pdf(sp)
        if n > best_count: best_count = n; pdf_dir = sp
if not pdf_dir:
  print('找不到有 PDF 的資料夾。/content 內容:', os.listdir('/content'))
  raise SystemExit('請確認 zip 裡有 PDF 或「封存」資料夾')
script_path = '/content/import_pdfs_to_datasets.py'
if not os.path.isfile(script_path):
  for root, dirs, files in os.walk('/content'):
    if 'public' in root or 'drive' in root or '__MACOSX' in root: continue
    for f in files:
      if f == 'import_pdfs_to_datasets.py':
        script_path = os.path.join(root, f)
        break
    else: continue
    break
if not os.path.isfile(script_path):
  raise SystemExit('找不到 import_pdfs_to_datasets.py，請確認 zip 裡有該腳本')
print('PDF 目錄:', pdf_dir)
print('腳本:', script_path)
print('--- 以下為匯入腳本即時輸出，約需 10～20 分鐘，請勿中斷 ---')
import subprocess
# 不 capture 輸出 + 強制不緩衝，才能即時看到「處理中 (1/15): xxx.pdf」等進度
env = {**os.environ, 'PYTHONUNBUFFERED': '1'}
r = subprocess.run(['python3', '-u', script_path, '--root', '/content', '--input-dir', pdf_dir, '--output-dir', '/content/public/data'], env=env)
if r.returncode != 0:
  raise SystemExit('匯入腳本執行失敗，請看上方錯誤訊息')
print('--- 匯入完成，正在打包 ---')
!cd /content && zip -r mlh_assets_and_data.zip public/
files.download('/content/mlh_assets_and_data.zip')
print('下載後解壓 mlh_assets_and_data.zip，把 public 覆蓋到專案根目錄。')
```

---

**若曾卡在「只印出 PDF 目錄/腳本」後沒動靜**，可改用下方 **「第二次複製（乾淨版）」**：解壓到 `/content/inbox`，只在 inbox 內找 PDF，避免 /content 混雜、且輸出即時顯示。

```python
# === 第二次複製（乾淨版）：解壓到 /content/inbox → 只在 inbox 內找 PDF → 即時輸出 → 打包下載 ===
import zipfile, os, shutil, subprocess
from io import BytesIO

INBOX = "/content/inbox"
if os.path.isdir(INBOX):
  shutil.rmtree(INBOX)
os.makedirs(INBOX, exist_ok=True)

for name in uploaded:
  with zipfile.ZipFile(BytesIO(uploaded[name]), 'r') as z:
    z.extractall(INBOX)
  print('已解壓到 inbox:', name)
  break

SKIP_DIRS = ('public', 'sample_data', 'drive', '__MACOSX')
def count_pdf(d):
  try: return sum(1 for f in os.listdir(d) if f.lower().endswith('.pdf'))
  except: return 0

pdf_dir = None
if count_pdf(INBOX) > 0:
  pdf_dir = INBOX
if not pdf_dir:
  for preferred in ['封存', 'Archive', 'archive', 'raw_pdfs']:
    p = os.path.join(INBOX, preferred)
    if os.path.isdir(p) and count_pdf(p) > 0:
      pdf_dir = p
      break
if not pdf_dir:
  best_count = 0
  for root, dirs, files_ in os.walk(INBOX):
    if '__MACOSX' in root: continue
    n = sum(1 for f in files_ if f.lower().endswith('.pdf'))
    if n > best_count: best_count = n; pdf_dir = root

if not pdf_dir:
  print('inbox 內容：', os.listdir(INBOX))
  raise SystemExit('找不到 PDF，請確認 zip 內含 PDF（或封存/raw_pdfs 資料夾）')

script_path = os.path.join(INBOX, 'import_pdfs_to_datasets.py')
if not os.path.isfile(script_path):
  for root, dirs, files_ in os.walk(INBOX):
    if '__MACOSX' in root: continue
    if 'import_pdfs_to_datasets.py' in files_:
      script_path = os.path.join(root, 'import_pdfs_to_datasets.py')
      break
if not os.path.isfile(script_path):
  raise SystemExit('找不到 import_pdfs_to_datasets.py（請確認 zip 含該腳本）')

print('PDF 目錄:', pdf_dir)
print('腳本:', script_path)
print('--- 以下為匯入腳本即時輸出，約需 10～20 分鐘，請勿中斷 ---')
env = {**os.environ, 'PYTHONUNBUFFERED': '1'}
r = subprocess.run(['python3', '-u', script_path, '--root', '/content', '--input-dir', pdf_dir, '--output-dir', '/content/public/data'], env=env)
if r.returncode != 0:
  raise SystemExit('匯入腳本執行失敗，請看上方錯誤訊息')
print('--- 匯入完成，正在打包 ---')
!cd /content && zip -r mlh_assets_and_data.zip public/
files.download('/content/mlh_assets_and_data.zip')
print('下載後解壓 mlh_assets_and_data.zip，把 public 覆蓋到專案根目錄。')
```

**4. 本機**：解壓下載的 zip，把裡面的 **`public`** 覆蓋到專案根目錄 → `npm run dev` 確認圖題有圖。

---

## 檢查是否正確

**Colab 下載的 zip**：解壓後要有 `public/data/index.json`、多個 `questions_*.json`，以及 `public/assets/q/` 下的題庫資料夾與 PNG。

**本機**：專案裡 `public/data/`、`public/assets/q/` 有檔案且有圖，即為正確。

---

## 審核：GPT 關於「卡在 PDF 目錄/腳本」的判斷

| GPT 說法 | 審核結果 | 說明 |
|----------|----------|------|
| 「腳本在做全目錄掃描/嘗試開啟每個檔→黑洞」 | **沒有** | 本腳本只做 `input_dir.glob("*.pdf")`，只列並只開 **.pdf**，不會掃 zip 或開「每個檔」。 |
| 「用 /content 當 input-dir 很危險」 | **部分成立** | /content 可能混雜 Colab 或前次產物；若根目錄也有 .pdf，會一併被處理、時間變長。改用 **只在本 zip 解壓處（如 inbox）找 PDF** 較乾淨。 |
| 「腳本幾乎沒 print」 | **已不成立** | 腳本已有「共 N 份 PDF…」「處理中 (1/N): xxx.pdf」「解析文字…」「建題號索引…」「產圖中…」等輸出；看不到多半是 Colab 用了 `capture_output=True`。 |
| 「可能卡在某份 PDF 的解析/圖偵測」 | **有可能** | PyMuPDF 在少數 PDF 上可能較慢；第一份若很大，開檔＋建索引會多花時間。 |

**結論**：不必當成「全目錄黑洞」；建議採用 **解壓到 /content/inbox、只在 inbox 內找 PDF** 的乾淨版第二段，並確保 **不 capture 輸出**、用 **python3 -u**。

---

## 常見問題

**Q：第二段執行後好像卡住、完全跑不動？**  
不會卡住，是**需要時間**。15 份 PDF 要逐份解析、建題號索引、對疑似圖題產 PNG，約需 **10～20 分鐘**。請勿按中斷。  
若使用更新後的第二段（不 capture 輸出），會即時看到「處理中 (1/15): xxx.pdf」「解析文字... 建題號索引... 產圖中...」等字樣，代表正在跑。若舊版第二段用 `capture_output=True`，則要等全部跑完才會一次顯示輸出，容易誤以為卡住。  
若曾卡在「只印出 PDF 目錄/腳本」沒後續，可改用下方 **「第二次複製（乾淨版）」**：解壓到 `/content/inbox`，只在 inbox 內找 PDF，避免 /content 混雜。

**Q：怎麼確認腳本到底有沒有在跑？**  
新開一個 Colab cell，貼上執行：
```bash
!ps aux | grep -E "import_pdfs_to_datasets|python3" | grep -v grep
!top -b -n 1 | head -n 20
```
若有看到 `python3 ... import_pdfs_to_datasets.py` 且 CPU 有在吃 → 代表在跑但輸出沒顯示（多半是第二段用了 `capture_output=True`，請改用「不 capture」或「乾淨版」）。若沒有該行程 → 代表沒跑起來或已結束/當掉。

**Q：zip 檔名變成「raw_pdfs (2).zip」「raw_pdfs (3).zip」會失敗嗎？**  
不會。第二段會**自動找**解壓後裡面「有 PDF 的目錄」，不管資料夾叫什麼都會用。

**Q：Mac 壓縮後 zip 裡只有一層「封存」或「Archive」資料夾，可以嗎？**  
可以。第二段會自動找「PDF 數量最多的資料夾」當輸入目錄，所以會用「封存」而不是 Mac 產生的 __MACOSX。

**Q：為什麼之前出現「PDF 目錄: /content/__MACOSX」或檔名亂碼？**  
Mac 壓縮時會多一個 __MACOSX 資料夾。第二段已改為跳過 __MACOSX，並改為選「PDF 最多的資料夾」，就不會再誤用 __MACOSX。

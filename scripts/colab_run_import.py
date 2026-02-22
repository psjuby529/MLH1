#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
在 Google Colab 執行此腳本，可產出圖題 PNG（需先上傳 PDF 與 import_pdfs_to_datasets.py）。
使用方式：見下方「Colab 一鍵產圖」區塊，整段複製到 Colab 一個 cell 執行。
"""

# ========== Colab 一鍵產圖（整段複製到 Colab 一個 cell）==========
"""
# 1) 安裝依賴
!pip install -q pymupdf pdfplumber

# 2) 建立目錄
!mkdir -p /content/raw_pdfs /content/public/data /content/public/assets

# 3) 上傳檔案（執行後會跳出「選擇檔案」）
#    請上傳：(1) raw_pdfs.zip（把 raw_pdfs: 資料夾內所有 PDF 壓成 zip）
#           (2) import_pdfs_to_datasets.py（專案裡的 scripts/import_pdfs_to_datasets.py）
from google.colab import files
uploaded = files.upload()

# 4) 解壓 PDF 到 /content/raw_pdfs
import zipfile
import os
for name in uploaded:
  if name.endswith('.zip'):
    with zipfile.ZipFile(name, 'r') as z:
      for m in z.namelist():
        if m.endswith('.pdf'):
          z.extract(m, '/content/raw_pdfs')
          # 若 zip 內是 raw_pdfs:/xxx.pdf，解壓後在 /content/raw_pdfs/raw_pdfs:/
          # 把 PDF 移到 /content/raw_pdfs/
          base = '/content/raw_pdfs'
          full = os.path.join(base, m)
          if os.path.isfile(full):
            target = os.path.join(base, os.path.basename(m))
            if full != target:
              os.rename(full, target)
    break

# 若 zip 解壓後 PDF 在子資料夾（如 raw_pdfs: ），移到 raw_pdfs 根
for root, dirs, files in os.walk('/content/raw_pdfs'):
  for f in files:
    if f.endswith('.pdf'):
      src = os.path.join(root, f)
      dst = os.path.join('/content/raw_pdfs', f)
      if src != dst and not os.path.exists(dst):
        os.rename(src, dst)

# 5) 執行匯入（產出題庫 JSON + 圖題 PNG）
!python3 import_pdfs_to_datasets.py --root /content --input-dir /content/raw_pdfs --output-dir /content/public/data

# 6) 打包下載（public/data 與 public/assets）
!cd /content && zip -r mlh_assets_and_data.zip public/
files.download('/content/mlh_assets_and_data.zip')
print('下載完成後，在本機解壓 mlh_assets_and_data.zip，將 public 資料夾覆蓋到專案根目錄。')
"""

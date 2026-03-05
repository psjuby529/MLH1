#!/usr/bin/env bash
# 在專案根目錄建立 .venv 並安裝 requirements.txt，供 import:allpdf 使用。
set -e
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
echo "OK: .venv ready. Run npm run import:allpdf or npm run import:then:approval"

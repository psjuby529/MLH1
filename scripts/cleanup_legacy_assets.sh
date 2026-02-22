#!/usr/bin/env bash
# v1.2.2: 清除 public/data 與 public/assets/q 下非 slug 規格的舊檔（中文/亂碼）
# 僅保留：index.json、questions_<slug>.json（slug 僅含 [a-z0-9_]）、assets/q/<slug>/
# 用法：在專案根目錄執行 bash scripts/cleanup_legacy_assets.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/public/data"
ASSETS="$ROOT/public/assets/q"

echo "專案根目錄: $ROOT"

# 刪除 public/data 下非 slug 的 questions_*.json（slug = 僅 [a-z0-9_]）
if [ -d "$DATA" ]; then
  for f in "$DATA"/questions_*.json; do
    [ -f "$f" ] || continue
    base=$(basename "$f" .json)
    # questions_ 後若含非 ASCII 或非 [a-z0-9_] 則視為殘留
    rest=${base#questions_}
    # 僅保留 [a-z0-9_] 組成的檔名（v1, y105, zonghe_a 等）
    if [ -z "$rest" ] || echo "$rest" | grep -qE '[^a-z0-9_]'; then
      echo "刪除 data 殘留: $f"
      rm -f "$f"
    fi
  done
fi

# 刪除 public/assets/q 下非 slug 的資料夾（資料夾名僅能 [a-z0-9_]）
if [ -d "$ASSETS" ]; then
  for d in "$ASSETS"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    if echo "$name" | grep -q '[^a-z0-9_]'; then
      echo "刪除 assets 殘留: $d"
      rm -rf "$d"
    fi
  done
fi

echo "清理完成。"

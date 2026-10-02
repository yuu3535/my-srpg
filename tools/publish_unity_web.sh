#!/usr/bin/env bash
# Unity版（WebGL）の書き出しを、公開専用のリポジトリ yuu3535/my-srpg-unity へ送る（総合担当 2026-10-03）。
#   本体のリポジトリ（my-srpg）に毎回 75MB ほどの書き出しが履歴として積もっていたため、置き場所を分けた。
#   公開専用のリポジトリは履歴を残さない: 毎回「書き出し1つだけのコミット」で上書きする（force push）。
#
# 使い方（リポジトリのルートで。先に Unity を閉じて WebGLBuilder.Build で書き出しておく）:
#   bash tools/publish_unity_web.sh
# 公開先: https://yuu3535.github.io/my-srpg-unity/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/unity-prototype/Builds/WebGL"
REPO="https://github.com/yuu3535/my-srpg-unity.git"
[ -f "$SRC/index.html" ] || { echo "書き出しがない: $SRC"; exit 1; }
WORK="$(mktemp -d)"
cp -r "$SRC"/. "$WORK"/
touch "$WORK/.nojekyll"   # GitHub Pages に手を加えさせない
cd "$WORK"
git init -q -b main
git add -A
git -c user.name="yuu3535" -c user.email="by58m5nzd5@privaterelay.appleid.com" commit -q -m "Unity WebGL build $(date +%Y-%m-%d_%H:%M)"
git -c http.postBuffer=524288000 push -q -f "$REPO" main
echo "送った: $REPO（$(du -sh . | cut -f1)）"
rm -rf "$WORK"

"""兵種の衣装を試作ページへ取り込む（原作者 2026-10-06: 今後追加していく衣装も試せるように）。

立ち絵透過下処理/兵種衣装/<兵種>_<体型>_<案>/class_body_<兵種>_<体型>_static_<案><番号>.png を探し、
assets/outfits/ へ写して outfit-registry.js（ページとテストが読む一覧）を書き出す。元の絵は変えない。
戦列下級 A1〜A3 は前から assets/ に登録済み（首のマスク・配色つき）なので取り込まない。

使い方（リポジトリのルートで）:
    py -3.12 prototypes/sd-battle-motion/shared-body/import_outfits.py
新しい兵種のフォルダ名（英語の頭の部分）が下の CLASS_IDS にないときは、足してから実行する。
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
SOURCE = PROJECT / "立ち絵透過下処理" / "兵種衣装"
DEST = ROOT / "assets" / "outfits"
REGISTRY = ROOT / "outfit-registry.js"

# フォルダ名の兵種の部分 → 本編の兵種 ID（abilityData.js の classLines）
CLASS_IDS = {
    "line_low": "戦列下級",
    "braver": "戦列攻撃上級",
    "guardian": "戦列防御上級",
    "mage_low": "術下級", "magic_low": "術下級",
    "tactician": "術軍師上級",
    "archmage": "術魔法上級", "calamity": "術魔法上級",
    "knight": "騎兵下級", "cavalry_low": "騎兵下級",
    "paladin": "騎馬上級",
    "skyknight": "飛行上級", "dragonrider": "飛行上級", "flier": "飛行上級",
    "scout_low": "隠密下級", "covert_low": "隠密下級", "thief": "隠密下級",
    "assassin": "隠密暗殺上級",
    "shooter": "隠密遊撃上級",
}
BODY_TYPES = {"child": "子供", "adult": "大人"}
ALREADY = {("line_low", "child", "a1"), ("line_low", "child", "a2"), ("line_low", "child", "a3")}   # assets/ に登録済み
FILE = re.compile(r"^class_body_(?P<cls>.+)_(?P<body>child|adult)_static_(?P<variant>[a-z]\d+)\.png$")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def camel(slug):
    parts = slug.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if not SOURCE.exists():
        sys.exit(f"フォルダがない: {SOURCE}")
    DEST.mkdir(parents=True, exist_ok=True)
    outfits, skipped = [], []
    for path in sorted(SOURCE.rglob("class_body_*_static_*.png")):
        m = FILE.match(path.name)
        if not m:   # 縮小の見本（_body70.png）など
            continue
        cls, body, variant = m["cls"], m["body"], m["variant"]
        if (cls, body, variant) in ALREADY:
            continue
        class_id = CLASS_IDS.get(cls)
        if not class_id:
            skipped.append(f"{path.relative_to(PROJECT)}（兵種「{cls}」が CLASS_IDS にない）")
            continue
        with Image.open(path) as image:
            image = image.convert("RGBA")
            bounds = image.getchannel("A").point(lambda a: 255 if a >= 24 else 0).getbbox()
            size = list(image.size)
        if not bounds:
            skipped.append(f"{path.relative_to(PROJECT)}（透明で中身がない）")
            continue
        name = f"{cls}_{body}_{variant}.png"
        dest = DEST / name
        if not dest.exists() or sha256(dest) != sha256(path):
            shutil.copy2(path, dest)
        outfits.append({
            "key": camel(f"{cls}_{body}_{variant}"),
            "classId": class_id,
            "bodyType": body,
            "variant": variant.upper(),
            "label": f"{class_id}・{BODY_TYPES[body]} {variant.upper()}",
            "file": f"outfits/{name}",
            "size": size,
            "bounds": list(bounds),
            "source": str(path.relative_to(PROJECT)).replace("\\", "/"),
            "sha256": sha256(path),
        })
    body = json.dumps(outfits, ensure_ascii=False, indent=1)
    REGISTRY.write_text(
        "/* 自動で作る一覧（import_outfits.py）。手で直さない。立ち絵透過下処理/兵種衣装/ から取り込んだ兵種の衣装 */\n"
        "(function (root) {\n  'use strict';\n"
        f"  const outfits = {body};\n"
        "  if (typeof module !== 'undefined') module.exports = outfits;\n"
        "  else root.SharedBodyOutfits = outfits;\n"
        "})(typeof globalThis !== 'undefined' ? globalThis : this);\n",
        encoding="utf-8", newline="\n")
    print(f"取り込んだ衣装: {len(outfits)}")
    for o in outfits:
        print(f"  {o['label']}  ← {o['source']}")
    for s in skipped:
        print(f"  取り込まなかった: {s}")


if __name__ == "__main__":
    main()

"""スキル・戦技のアイコン素材を、ゲームで使う形に書き出す。

使い方:
    py -3.12 tools/build_skill_icons.py

入力: アイコン素材/採用版/
    - 「番号_能力名.png」（例: 01_祈り.png）… 能力名でスキル・戦技と結びつける
    - skill_frame_active.png / skill_frame_passive.png / skill_frame_personal.png … 枠
出力:
    - assets/icons/skills/能力名.png … 透明の余白を足した正方形（256×256）
    - assets/icons/skills/frame_*.png … 枠（256×256）
    - skillIconData.js … 能力名 → 画像の対応（ゲームと Node テストから読む）

元の画像は変更しない。アイコンを増やしたら、入力フォルダに同じ名前の付け方で置いて再実行する。
"""

import json
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "アイコン素材" / "採用版"
OUT_DIR = ROOT / "assets" / "icons" / "skills"
OUT_JS = ROOT / "skillIconData.js"

SIZE = 256
MARGIN = 0.10          # 周りの余白（1辺の割合）
INVERT = {"破壊"}       # 色を反転する（暗い背景で沈むため。原作者指示 2026-09-25）
FRAMES = {
    "personal": "skill_frame_personal.png",
    "passive": "skill_frame_passive.png",
    "active": "skill_frame_active.png",
}


def to_square(image: Image.Image) -> Image.Image:
    """絵のある範囲を切り出し、余白をつけて正方形の中央に置く"""
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox() or (0, 0, image.width, image.height)
    art = image.crop(bbox)
    inner = int(SIZE * (1 - MARGIN * 2))
    scale = min(inner / art.width, inner / art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
    return canvas


def invert_colors(image: Image.Image) -> Image.Image:
    r, g, b, a = image.split()
    rgb = ImageOps.invert(Image.merge("RGB", (r, g, b)))
    return Image.merge("RGBA", (*rgb.split(), a))


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icons = {}
    for path in sorted(SRC.glob("*.png")):
        m = re.fullmatch(r"\d+_(.+)\.png", path.name)
        if not m:
            continue
        name = m.group(1)
        image = to_square(Image.open(path))
        if name in INVERT:
            image = invert_colors(image)
        out = OUT_DIR / f"{name}.png"
        image.save(out, optimize=True)
        icons[name] = out.relative_to(ROOT).as_posix()

    frames = {}
    for kind, filename in FRAMES.items():
        source = SRC / filename
        if not source.exists():
            continue
        frame = Image.open(source).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
        out = OUT_DIR / f"frame_{kind}.png"
        frame.save(out, optimize=True)
        frames[kind] = out.relative_to(ROOT).as_posix()

    data = {"icons": icons, "frames": frames}
    body = json.dumps(data, ensure_ascii=False, indent=2)
    OUT_JS.write_text(
        "// =====================================================================\n"
        "//  skillIconData.js ― スキル・戦技のアイコンと枠の対応（自動生成・純粋データ）\n"
        "//\n"
        "//  tools/build_skill_icons.py が アイコン素材/採用版/ から作る。手で直さないこと。\n"
        "//  icons: 能力名 → 画像 / frames: personal（個人スキル）・passive（スキル）・active（戦技）\n"
        "// =====================================================================\n\n"
        f"const SKILL_ICON_DATA = Object.freeze({body});\n\n"
        "if (typeof module !== \"undefined\") {\n"
        "    module.exports = { SKILL_ICON_DATA };\n"
        "}\n",
        encoding="utf-8",
    )
    print(f"icons: {len(icons)} / frames: {len(frames)} -> {OUT_DIR.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()

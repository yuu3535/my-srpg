"""斜め見下ろし（アイソメトリック）のマップ用の画像を作る。

使い方:
    py -3.12 tools/make_iso_map.py            # テスト戦闘（12×8）
    py -3.12 tools/make_iso_map.py 10 10 名前  # 列数・行数・出力名を指定

出力（assets/maps/）:
    - 名前_guide.png  … マス目の下絵（ChatGPTに「この線の上に描いて」と渡す。マスの番号つき）
    - 名前.png        … 仮のマップ絵（石畳と段差。清書が届くまでの確認用）
    - 画面上の位置合わせの値（tileW・originX・originY・width・height）を表示する。battleDefinitions.js の isoView に書く

マスの形: 横 TILE_W、縦 TILE_W/2 の菱形（2:1）。マス(0,0)は画像の上端の菱形。
x（列）が増えると右下へ、y（行）が増えると左下へ並ぶ。
"""

import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "maps"

TILE_W = 128
TILE_H = TILE_W // 2
PAD = 96          # 画像の周りの余白（背景を描く場所）
DEPTH = 48        # 盤面の厚み（手前に見える崖の高さ）


def geometry(cols, rows):
    width = (cols + rows) * TILE_W // 2 + PAD * 2
    height = (cols + rows) * TILE_H // 2 + PAD * 2 + DEPTH
    origin_x = PAD + rows * TILE_W // 2
    origin_y = PAD
    return width, height, origin_x, origin_y


def diamond(col, row, ox, oy):
    """マス(col,row)の菱形の4点（上・右・下・左）"""
    top_x = ox + (col - row) * TILE_W / 2
    top_y = oy + (col + row) * TILE_H / 2
    return [
        (top_x, top_y),
        (top_x + TILE_W / 2, top_y + TILE_H / 2),
        (top_x, top_y + TILE_H),
        (top_x - TILE_W / 2, top_y + TILE_H / 2),
    ]


def font(size):
    for name in ("meiryo.ttc", "YuGothM.ttc", "msgothic.ttc", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_guide(cols, rows, path):
    width, height, ox, oy = geometry(cols, rows)
    image = Image.new("RGBA", (width, height), (245, 245, 245, 255))
    draw = ImageDraw.Draw(image)
    label = font(16)
    for row in range(rows):
        for col in range(cols):
            pts = diamond(col, row, ox, oy)
            draw.polygon(pts, fill=(222, 222, 222, 255) if (col + row) % 2 else (236, 236, 236, 255), outline=(60, 60, 60, 255))
            cx = pts[0][0]
            cy = pts[0][1] + TILE_H / 2
            draw.text((cx, cy), f"{col},{row}", fill=(120, 120, 120, 255), font=label, anchor="mm")
    # 盤面の外周（ここより外は背景）
    outer = [diamond(0, 0, ox, oy)[0], diamond(cols - 1, 0, ox, oy)[1], diamond(cols - 1, rows - 1, ox, oy)[2], diamond(0, rows - 1, ox, oy)[3]]
    draw.polygon(outer, outline=(200, 40, 40, 255), width=3)
    image.save(path)


def make_placeholder(cols, rows, path, seed=7):
    """仮のマップ絵: 暗い森の中の石畳の台地（段差の厚みつき）"""
    rng = random.Random(seed)
    width, height, ox, oy = geometry(cols, rows)
    image = Image.new("RGBA", (width, height), (18, 22, 20, 255))
    draw = ImageDraw.Draw(image)
    # 背景: 暗い緑の霞
    for i in range(160):
        x = rng.randint(0, width)
        y = rng.randint(0, height)
        r = rng.randint(30, 90)
        shade = rng.randint(24, 40)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(shade - 6, shade + 6, shade - 4, 255))
    # 台地の厚み（手前の2辺）
    left = diamond(0, rows - 1, ox, oy)[3]
    bottom = diamond(cols - 1, rows - 1, ox, oy)[2]
    right = diamond(cols - 1, 0, ox, oy)[1]
    draw.polygon([left, bottom, (bottom[0], bottom[1] + DEPTH), (left[0], left[1] + DEPTH)], fill=(58, 52, 46, 255))
    draw.polygon([bottom, right, (right[0], right[1] + DEPTH), (bottom[0], bottom[1] + DEPTH)], fill=(40, 36, 32, 255))
    # 石畳
    for row in range(rows):
        for col in range(cols):
            base = rng.randint(92, 116)
            tint = (base, base - 4 + rng.randint(-4, 4), base - 12 + rng.randint(-6, 6), 255)
            pts = diamond(col, row, ox, oy)
            draw.polygon(pts, fill=tint, outline=(62, 58, 52, 255))
            # 苔
            if rng.random() < 0.28:
                cx, cy = pts[0][0], pts[0][1] + TILE_H / 2
                rx, ry = rng.randint(10, 26), rng.randint(5, 12)
                draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(70, 96, 58, 255))
    image.save(path)


def main():
    cols = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    name = sys.argv[3] if len(sys.argv) > 3 else f"iso_trial_{cols}x{rows}"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_guide(cols, rows, OUT_DIR / f"{name}_guide.png")
    make_placeholder(cols, rows, OUT_DIR / f"{name}.png")
    width, height, ox, oy = geometry(cols, rows)
    print(f'isoView: {{ image: "assets/maps/{name}.png", tileW: {TILE_W}, originX: {ox}, originY: {oy}, width: {width}, height: {height} }}')


if __name__ == "__main__":
    main()

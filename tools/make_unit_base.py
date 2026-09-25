"""駒の台座（原作者の素材）から、味方用（白）と敵用（黒）の台座を作る。

使い方:
    py -3.12 tools/make_unit_base.py

入力: アイコン素材/台座/台座_元.png（背景と天面が透明な、薄紫の台座）
出力:
    assets/units/base_ally.png   … 味方（白）
    assets/units/base_enemy.png  … 敵（黒）
    unity-prototype/Assets/Art/UI/base_ally.png・base_enemy.png（同じもの）
天面（縁の内側の透明な部分）には草地を描き込む。足を置く位置は天面の中心（出力時に表示）。
色の決定: 原作者 2026-09-26「白は味方、敵は黒」。元の画像は変更しない。
"""

import random
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "アイコン素材" / "台座" / "台座_元.png"
OUTPUTS = [ROOT / "assets" / "units", ROOT / "unity-prototype" / "Assets" / "Art" / "UI"]
WIDTH = 320   # 出力の横幅(px)


def hole_mask(image):
    """縁の内側の透明な部分（外とつながっていない透明な部分）"""
    w, h = image.size
    alpha = image.getchannel("A").load()
    outside = [[False] * w for _ in range(h)]
    queue = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or outside[y][x] or alpha[x, y] > 40:
            continue
        outside[y][x] = True
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return [[alpha[x, y] <= 40 and not outside[y][x] for x in range(w)] for y in range(h)]


def recolor(image, team):
    """明るさを保ったまま色を変える。味方＝白（銀）、敵＝黒"""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 299 + g * 587 + b * 114) / 1000 / 255
            if team == "ally":
                v = int(min(255, 30 + lum * 235))
                px[x, y] = (v, v, min(255, v + 6), a)
            else:
                v = int(14 + (lum ** 1.6) * 120)
                px[x, y] = (v, v, v + 4, a)
    return out


def paint_grass(image, mask, seed=3):
    """天面に草地を描く（上が明るく、下が暗い。細かいむらをつける）"""
    rng = random.Random(seed)
    px = image.load()
    ys = [y for y, row in enumerate(mask) if any(row)]
    top, bottom = min(ys), max(ys)
    for y, row in enumerate(mask):
        for x, inside in enumerate(row):
            if not inside:
                continue
            t = (y - top) / max(1, bottom - top)
            n = rng.random() * 0.12
            r = int((0.26 - 0.08 * t + n * 0.4) * 255)
            g = int((0.50 - 0.14 * t + n) * 255)
            b = int((0.22 - 0.06 * t + n * 0.3) * 255)
            px[x, y] = (r, g, b, 255)
    return image


def main():
    source = Image.open(SOURCE).convert("RGBA")
    source = source.crop(source.getchannel("A").getbbox())
    scale = WIDTH / source.width
    source = source.resize((WIDTH, round(source.height * scale)), Image.LANCZOS)
    mask = hole_mask(source)
    ys = [y for y, row in enumerate(mask) if any(row)]
    xs = [x for row in mask for x, inside in enumerate(row) if inside]
    center_y = (min(ys) + max(ys)) / 2
    for team in ("ally", "enemy"):
        image = paint_grass(recolor(source, team), mask)
        for folder in OUTPUTS:
            folder.mkdir(parents=True, exist_ok=True)
            image.save(folder / f"base_{team}.png", optimize=True)
    print(f"{source.width}×{source.height}  天面の中心: 横 {(min(xs) + max(xs)) / 2:.0f}px・上から {center_y:.0f}px（下から {1 - center_y / source.height:.3f}）")


if __name__ == "__main__":
    main()

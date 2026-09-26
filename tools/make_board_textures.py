"""3Dの盤面の試作（T5）で貼る、仮の模様をドット絵の粗さで描く。

使い方:
    py -3.12 tools/make_board_textures.py

出力: unity-prototype/Assets/Art/Board3D/Textures/*.png（各32×32。1マスに1枚を点のまま拡大して貼る）
- 天面: top_stone（旧石畳・白石と黒石の補修跡）/ top_dirt（土道・轍）/ top_moss（苔と下草）/ top_bridge（補修橋の板）
        / top_water（水堀）/ top_rubble（瓦礫）/ top_dark（砦壁の基礎・密な下草）/ top_wall（石の壁の上面）
- 側面: side_earth（マスの厚み・土と石の層）/ side_stone（石の壁・水堀の岸の石積み）
- 色は少ない色（PALETTE）から選ぶ。原作TRPGの背景素材の彩度・色に寄せる（MAP_COLOR_MOOD_DIRECTION_2026-09-27.md）。
- ChatGPTの清書が届いたら、同じ名前・同じ大きさで置き換える（依頼: 真上から見た正方形の模様・つなぎ目が合うもの）。
"""

import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "unity-prototype" / "Assets" / "Art" / "Board3D" / "Textures"
N = 32

# 少ない色。原作TRPGの背景素材の色に寄せる（docs/10-design/map/MAP_COLOR_MOOD_DIRECTION_2026-09-27.md）:
# 明るさは中くらい（暗さは光と霧で作る）、石は暖かい灰色〜赤茶、苔は青みのある深い緑、水は深い藍〜青緑
PALETTE = {
    "void": (14, 11, 26),
    "night1": (35, 22, 27), "night2": (55, 44, 45),
    "stone0": (70, 64, 60), "stone1": (95, 88, 79), "stone2": (124, 112, 98), "stone3": (150, 134, 114),
    "white1": (186, 170, 146), "white2": (214, 202, 172),
    "black1": (48, 42, 46), "black2": (66, 58, 60),
    "dirt0": (72, 46, 36), "dirt1": (104, 72, 54), "dirt2": (140, 95, 75), "dirt3": (171, 141, 112),
    "moss0": (32, 56, 52), "moss1": (46, 78, 66), "moss2": (62, 100, 78), "moss3": (94, 134, 110),
    "water0": (16, 37, 51), "water1": (28, 56, 70), "water2": (53, 91, 96), "water3": (94, 134, 134),
    "wood0": (70, 40, 32), "wood1": (95, 60, 44), "wood2": (130, 88, 62),
    "iron": (60, 58, 64),
}
P = PALETTE


def canvas(color):
    return Image.new("RGB", (N, N), P[color])


def put(img, x, y, color):
    img.putpixel((x % N, y % N), P[color] if isinstance(color, str) else color)


def speckle(img, rng, colors, amount):
    for _ in range(amount):
        put(img, rng.randrange(N), rng.randrange(N), rng.choice(colors))


def stones(img, rng, fills, mortar, rows=(7, 9, 8, 8), mix=None):
    """段ごとにずらした石を敷く（つなぎ目が合うよう、端は折り返す）"""
    y = 0
    row_index = 0
    heights = list(rows)
    while y < N:
        h = heights[row_index % len(heights)]
        x = rng.randrange(8)
        while x < N + 8:
            w = rng.choice((7, 8, 9, 10))
            fill = rng.choice(fills)
            if mix and rng.random() < mix[0]:
                fill = rng.choice(mix[1])
            for yy in range(y, y + h):
                for xx in range(x, x + w):
                    edge_x = xx == x + w - 1
                    edge_y = yy == y + h - 1
                    if edge_x or edge_y:
                        put(img, xx, yy, mortar)
                    elif xx == x or yy == y:
                        put(img, xx, yy, lighter(fill))
                    else:
                        put(img, xx, yy, fill)
            x += w
        y += h
        row_index += 1


def lighter(name):
    order = ["stone0", "stone1", "stone2", "stone3", "white1", "white2"]
    if name in order and order.index(name) + 1 < len(order):
        return order[order.index(name) + 1]
    if name == "black1":
        return "black2"
    return name


def top_stone(rng):
    img = canvas("stone0")
    stones(img, rng, ["stone1", "stone2", "stone2", "stone3"], "stone0",
           mix=(0.22, ["white1", "white2", "black1", "black2"]))   # 白石と黒石の補修跡
    speckle(img, rng, ["moss1", "moss2"], 10)                    # 目地の苔
    speckle(img, rng, ["stone0"], 14)                            # ひび
    return img


def top_dirt(rng):
    img = canvas("dirt1")
    speckle(img, rng, ["dirt0", "dirt2", "dirt2", "dirt3"], 260)
    for rut_x in (9, 22):                                        # 荷車の轍
        for y in range(N):
            put(img, rut_x, y, "dirt0")
            put(img, rut_x + 1, y, "dirt0" if rng.random() < 0.7 else "dirt1")
    speckle(img, rng, ["stone2", "stone3"], 8)                   # 小石
    return img


def top_moss(rng):
    img = canvas("moss1")
    speckle(img, rng, ["moss0", "moss2", "moss2"], 300)
    for _ in range(7):                                           # 下草の塊
        cx, cy = rng.randrange(N), rng.randrange(N)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx * dx + dy * dy <= 4:
                    put(img, cx + dx, cy + dy, "moss3" if dy < 0 else "moss2")
    speckle(img, rng, ["dirt1"], 12)
    return img


def top_bridge(rng):
    img = canvas("wood1")
    for plank in range(4):                                       # 継ぎ足した板
        y0 = plank * 8
        fill = rng.choice(["wood1", "wood2", "wood1"])
        for y in range(y0, y0 + 8):
            for x in range(N):
                put(img, x, y, "wood0" if y == y0 + 7 else fill)
        for _ in range(6):                                       # 木目
            gx, gy = rng.randrange(N), y0 + rng.randrange(1, 6)
            for k in range(rng.randrange(3, 7)):
                put(img, gx + k, gy, "wood0")
        for nx in (3, N - 4):                                    # 釘
            put(img, nx, y0 + 3, "iron")
    return img


def top_water(rng):
    img = canvas("water1")
    speckle(img, rng, ["water0", "water0", "water2"], 220)
    for _ in range(9):                                           # さざ波
        x, y = rng.randrange(N), rng.randrange(N)
        for k in range(rng.randrange(3, 6)):
            put(img, x + k, y, "water2")
        put(img, x + 1, y, "water3")
    return img


def top_rubble(rng):
    img = top_dirt(rng)
    for _ in range(9):                                           # 崩れた石積み
        cx, cy = rng.randrange(N), rng.randrange(N)
        r = rng.choice((2, 3, 3, 4))
        fill = rng.choice(["stone1", "stone2", "stone3", "white1"])
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if abs(dx) + abs(dy) <= r:
                    put(img, cx + dx, cy + dy, lighter(fill) if dy < 0 else fill)
        put(img, cx + r, cy + 1, "stone0")
    return img


def top_dark(rng):
    img = canvas("night2")
    speckle(img, rng, ["moss0", "moss0", "night1", "black2"], 320)
    for _ in range(4):                                           # 根
        x, y = rng.randrange(N), rng.randrange(N)
        for k in range(rng.randrange(5, 10)):
            put(img, x + k, y + (k // 3), "dirt0")
    return img


def top_wall(rng):
    img = canvas("stone0")
    stones(img, rng, ["stone2", "stone3"], "stone0", rows=(10, 11, 11))
    speckle(img, rng, ["moss1"], 8)
    return img


def side_earth(rng):
    img = canvas("dirt0")
    for y in range(N):
        band = "moss1" if y < 3 else ("dirt1" if y < 12 else ("stone1" if y < 20 else "dirt0"))
        for x in range(N):
            put(img, x, y, band)
    speckle(img, rng, ["dirt0", "dirt2", "stone0", "black2"], 180)
    return img


def side_stone(rng):
    img = canvas("stone0")
    stones(img, rng, ["stone1", "stone2", "stone2"], "stone0", rows=(8, 8, 8, 8))
    speckle(img, rng, ["moss1", "moss0"], 16)
    return img


MAKERS = {
    "top_stone": top_stone, "top_dirt": top_dirt, "top_moss": top_moss, "top_bridge": top_bridge,
    "top_water": top_water, "top_rubble": top_rubble, "top_dark": top_dark, "top_wall": top_wall,
    "side_earth": side_earth, "side_stone": side_stone,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, make) in enumerate(MAKERS.items()):
        img = make(random.Random(1000 + i))
        img.save(OUT / f"{name}.png")
        print(f"{name}.png")


if __name__ == "__main__":
    main()

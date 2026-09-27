"""
マップチップ（原作者・ChatGPT が描いた地形の絵）を、Unity の3Dの盤面の模様として取り込む。

使い方:
    py -3.12 tools/import_map_chips.py
    py -3.12 tools/import_map_chips.py --try top_moss=別の絵.png   （試しに1つだけ別の絵にする。元の絵は変えない）
    py -3.12 tools/import_map_chips.py --set grassland             （草原と地面のひとそろい grassland_corner_tiles_transparent を試す）

入力: マップチップ/road_dirt_bright/（基本床 BASE と、境界 EDGE。`マップチップ/SRPG_MAP_ASSET_BASIC_DESIGN_POLICY_2026-09-27.md`）
出力: unity-prototype/Assets/Art/Board3D/Textures/<名前>.png（1マス1枚。仮の模様 tools/make_board_textures.py の同じ名前を置き換える）

- 基本床は、上下左右に並べたときの継ぎ目を目立たなくする（端の近くを、反対側の端と少しずつ混ぜる）。
- 境界（草の縁）は背景が透明のまま縮める。ゲーム側で90°ずつ回して使う。
- 元の絵は書き換えない。make_board_textures.py を実行し直したら、このツールもあとで実行し直す。
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "マップチップ" / "road_dirt_bright"
OUT = ROOT / "unity-prototype" / "Assets" / "Art" / "Board3D" / "Textures"
SIZE = 256   # 1マスの絵の大きさ（寄りの画面で1マスは画面の縦の約1/9。2倍の画面でも足りる）

# 草原と地面のひとそろい（マップチップ/grassland_corner_tiles_transparent/。1枚の絵から切り出したもの）。
# 透明な所に下の地面が見える。切り出しの端に1pxの透明が残っているので、まわりを2px切ってから使う
GRASSLAND = ROOT / "マップチップ" / "grassland_corner_tiles_transparent"
GRASSLAND_CHIPS = [
    ("01_grass_full.png", "top_moss", True),
    ("04_ground_full.png", "top_dirt", True),
    ("02_edge_transparent_bottom.png", "edge_grass_straight", False),        # 上が草（下は透明）
    ("07_corner_transparent_bottom_right.png", "edge_grass_inner", False),   # 上と左が草（右下は透明）
]
# このひとそろいには「角でだけ草に接する」絵がないので、その角の絵は置かない
GRASSLAND_REMOVE = ["edge_grass_outer"]

# (元の絵, 書き出す名前, 基本床か)
CHIPS = [
    ("road_dirt_bright.png", "top_dirt", True),        # 土の道（地形 d）
    ("grass_field_bright.png", "top_moss", True),      # 草原（地形 g・景色の下草）
    ("grass_edge_straight.png", "edge_grass_straight", False),   # 草の縁（上が草）
    ("grass_edge_outer_corner.png", "edge_grass_outer", False),  # 草の角（左上が草）
]


def seamless(image: Image.Image, band: float = 0.08) -> Image.Image:
    """端から band の幅を、反対側の端と混ぜる（左右・上下）。並べたときの継ぎ目の段差をなくす"""
    img = image.convert("RGB")
    w, h = img.size
    bw, bh = max(1, int(w * band)), max(1, int(h * band))
    px = img.load()
    src = img.copy().load()
    for x in range(bw):
        t = 0.5 * (1 - x / bw)   # 端で半分ずつ、内側へ行くほど自分の色
        for y in range(h):
            a, b = src[x, y], src[w - 1 - x, y]
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
            px[w - 1 - x, y] = tuple(round(b[i] * (1 - t) + a[i] * t) for i in range(3))
    src = img.copy().load()
    for y in range(bh):
        t = 0.5 * (1 - y / bh)
        for x in range(w):
            a, b = src[x, y], src[x, h - 1 - y]
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
            px[x, h - 1 - y] = tuple(round(b[i] * (1 - t) + a[i] * t) for i in range(3))
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # --try 名前=絵: 試しに差し替える（マップチップ/road_dirt_bright/ の中のファイル名か、パス）
    trials = {}
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a == "--try" and i + 1 < len(args) and "=" in args[i + 1]:
            name, file = args[i + 1].split("=", 1)
            trials[name] = file
    chips = [(SRC / source, name, base) for source, name, base in CHIPS]
    if "--set" in args and args[args.index("--set") + 1:args.index("--set") + 2] == ["grassland"]:
        chips = [(GRASSLAND / source, name, base) for source, name, base in GRASSLAND_CHIPS]
        for name in GRASSLAND_REMOVE:
            for ext in ("png", "png.meta"):
                (OUT / f"{name}.{ext}").unlink(missing_ok=True)
    else:
        (OUT / "edge_grass_inner.png").unlink(missing_ok=True)
        (OUT / "edge_grass_inner.png.meta").unlink(missing_ok=True)
    for path, name, base in chips:
        source = path.name
        if name in trials:
            path = Path(trials[name]) if Path(trials[name]).is_absolute() else SRC / trials[name]
            source = path.name
        if not path.exists():
            print(f"見つからない（とばす）: {path}")
            continue
        image = Image.open(path)
        if path.parent == GRASSLAND:
            image = image.crop((2, 2, image.width - 2, image.height - 2))
        if base:
            image = seamless(image.resize((SIZE * 2, SIZE * 2), Image.LANCZOS)).resize((SIZE, SIZE), Image.LANCZOS)
        else:
            image = image.convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
        image.save(OUT / f"{name}.png", optimize=True)
        print(f"{source} -> {(OUT / (name + '.png')).relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()

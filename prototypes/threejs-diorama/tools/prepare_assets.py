"""
素材の下ごしらえ（玉座の間の試作用）。

- 背景/orcus_throne_room_assets/ の透過PNGを public/assets/props/ へ写す（元の絵は変えない）。
  まとめ画像から切り分けた素材のふちに、となりの素材の切れ端が残っているので、
  「画像のふちに触れている小さなかたまり」を消してから、絵の所だけに切り詰める。
- 斜めから描かれた絨毯・床（台形）を、真上から見た長方形に引き伸ばして public/assets/maps/ へ。
- SDキャラ（unity-prototype/Assets/Art/SD/）を public/assets/characters/ へ写す。

使い方（このフォルダで）:  py -3.12 tools/prepare_assets.py
"""
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parent.parent
SRC = REPO / "背景" / "orcus_throne_room_assets"
SD = REPO / "unity-prototype" / "Assets" / "Art" / "SD"
PROPS = HERE / "public" / "assets" / "props"
MAPS = HERE / "public" / "assets" / "maps"
CHARS = HERE / "public" / "assets" / "characters"

# まとめ画像（切り分け前）は使わない
SKIP = {"05_torches_and_magic_lamps_all.png", "06_cloth_banners_and_drapes.png"}
# 台形 → 長方形（出力の横・縦px）。絨毯は細長く、床は正方形のタイルが並ぶ比率に
UNWARP = {"06e_carpet.png": (360, 1000), "07_floor.png": (1024, 640)}
CHARACTERS = ["young_arshe", "young_karima", "gunter", "albas", "ringholm"]


def main_mask(alpha):
    """ふちに触れる小さなかたまり（となりの素材の切れ端）を除いた、絵の所の印"""
    solid = alpha > 16
    labels, n = ndimage.label(solid, structure=np.ones((3, 3)))
    if n == 0:
        return solid
    areas = ndimage.sum(solid, labels, range(1, n + 1))
    largest = areas.max()
    h, w = alpha.shape
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        touches = sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == h or sl[1].stop == w
        if areas[i - 1] >= largest * 0.3 or not touches:
            keep[i] = True
    return keep[labels]


def clean(img):
    a = np.array(img)
    mask = main_mask(a[:, :, 3])
    a[:, :, 3] = np.where(mask, a[:, :, 3], 0)
    out = Image.fromarray(a)
    box = out.getchannel("A").getbbox()
    return out.crop(box) if box else out


def perspective_coeffs(dst, src):
    """PIL の PERSPECTIVE 用の係数（出力の4点 dst → 元の絵の4点 src）"""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = np.array(src, float).reshape(8)
    return np.linalg.solve(np.array(m, float), b).tolist()


def unwarp(img, size):
    """一番大きなかたまりの上の辺・下の辺の両端を4すみとして、真上から見た長方形にする"""
    a = np.array(img)
    solid = a[:, :, 3] > 128
    labels, n = ndimage.label(solid)
    areas = ndimage.sum(solid, labels, range(1, n + 1))
    body = labels == (int(np.argmax(areas)) + 1)
    rows = np.where(body.any(axis=1))[0]
    inset = max(2, int(len(rows) * 0.02))
    top, bottom = rows[0] + inset, rows[-1] - inset
    # 下の辺は、幅がいちばん広い行（床の手前の厚みより上）
    widths = body.sum(axis=1)
    bottom = min(bottom, int(rows[0] + np.argmax(widths[rows[0]:rows[-1] + 1])))

    def ends(y):
        xs = np.where(body[y])[0]
        return xs[0] + inset, xs[-1] - inset

    tl, tr = ends(top)
    bl, br = ends(bottom)
    w, h = size
    coeffs = perspective_coeffs([(0, 0), (w, 0), (w, h), (0, h)], [(tl, top), (tr, top), (br, bottom), (bl, bottom)])
    return img.transform(size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)


# 炎だけを切り出す（B版: 台は立体で作り、炎はいつもカメラを向く板にする）。元の絵・炎の下の端の行
FLAMES = {"05a_torch_orange_large.png": ("flame_orange.png", 100), "05d_magic_lamp_purple_large.png": ("flame_purple.png", 86)}


def cut_flame(img, bottom):
    """上から bottom 行までの、明るい所（炎）だけを残す。下の端はぼかして消す"""
    a = np.array(img.crop((0, 0, img.width, bottom))).astype(float)
    bright = a[:, :, :3].max(axis=2)
    keep = np.clip((bright - 70) / 60, 0, 1)
    fade = np.clip((bottom - np.arange(bottom)) / 18, 0, 1)[:, None]
    a[:, :, 3] *= keep * fade
    out = Image.fromarray(a.astype(np.uint8))
    box = out.getchannel("A").getbbox()
    return out.crop(box) if box else out


def run():
    for d in (PROPS, MAPS, CHARS):
        d.mkdir(parents=True, exist_ok=True)
    for f in sorted(SRC.glob("*.png")):
        if f.name in SKIP:
            continue
        img = Image.open(f).convert("RGBA")
        if f.name in UNWARP:
            out = unwarp(img, UNWARP[f.name])
            out.save(MAPS / f.name.replace(".png", "_top.png"))
            print("unwarp", f.name, out.size)
        else:
            out = clean(img)
            out.save(PROPS / f.name)
            print("prop  ", f.name, img.size, "->", out.size)
            if f.name in FLAMES:
                name, bottom = FLAMES[f.name]
                flame = cut_flame(out, bottom)
                flame.save(PROPS / name)
                print("flame ", name, flame.size)
    for name in CHARACTERS:
        src = SD / f"{name}.png"
        if src.exists():
            shutil.copyfile(src, CHARS / f"{name}.png")
            print("chara ", name)


if __name__ == "__main__":
    run()

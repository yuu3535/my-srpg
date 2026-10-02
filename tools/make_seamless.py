"""左右（と上下）にくり返してもつながる画像を作る（2D回廊の遠景・庭・床の素材用。総合担当 2026-10-03）。

使い方:
    py -3.12 tools/make_seamless.py 入力.png 出力.png [--fade 300] [--vertical]

右の端の --fade px を、左の端に重ねて少しずつ混ぜる（クロスフェード）。出来た画像は幅が --fade だけ短くなり、
そのまま横に並べると継ぎ目が見えない。--vertical を付けると上下にも同じことをする（真上から見た床の素材）。
元の画像は上書きしない（出力は別の名前で）。
"""
import argparse
import numpy as np
from PIL import Image


def seam_x(a, fade):
    h, w, c = a.shape
    fade = min(fade, w // 2)
    out = a[:, : w - fade].copy()
    t = np.linspace(0.0, 1.0, fade, dtype=np.float32)[None, :, None]
    # 左の端 0..fade に、右の端 w-fade..w を、右の端の方から少しずつ混ぜる（左端では右の絵、fade の位置で元の絵）
    # 透明の部分の色が混ざって白い線にならないよう、色に濃さを掛けてから混ぜる（premultiplied）
    def pre(x):
        x = x.astype(np.float32)
        x[..., :3] *= x[..., 3:4] / 255.0
        return x
    m = pre(a[:, w - fade:]) * (1.0 - t) + pre(a[:, :fade]) * t
    alpha = m[..., 3:4]
    m[..., :3] = np.where(alpha > 0, m[..., :3] * 255.0 / np.maximum(alpha, 1e-6), 0)
    out[:, :fade] = m.round().clip(0, 255).astype(np.uint8)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--fade", type=int, default=300)
    p.add_argument("--vertical", action="store_true")
    p.add_argument("--crop-left", type=int, default=0, help="左の端をこの幅だけ切り落としてから（端で切れている物を外す）")
    a = p.parse_args()
    im = np.array(Image.open(a.src).convert("RGBA"))
    if a.crop_left:
        im = im[:, a.crop_left:]
    im = seam_x(im, a.fade)
    if a.vertical:
        im = seam_x(im.transpose(1, 0, 2), a.fade).transpose(1, 0, 2)
    Image.fromarray(im).save(a.dst)
    print(f"wrote {a.dst} {im.shape[1]}x{im.shape[0]}")


if __name__ == "__main__":
    main()

"""
立ち絵の顔だけを ChatGPT に直してもらい、直した所だけを元の全身の絵に貼り合わせる。

ChatGPT は全身の絵のまま顔を直させると、小さな所（目）が変わりにくい。
顔を切り出して拡大して頼むと直るが、切り出した絵の全体を少しずつ描き直すので、
直した所（目・眉など）だけを、境目をぼかして元の絵に貼る（2026-09-28 アルバスで確立）。

使い方:
    # 1. 顔を切り出す（x, y, 一辺 は元の絵の画素。4倍に拡大して保存。名前に位置が入る）
    py -3.12 tools/tachie_face_patch.py crop <全身の絵> <x> <y> <一辺> <出力フォルダ>

    # 2. ChatGPT が直した顔の絵の、直した所（切り出しの中の長方形。切り出し前の画素で指定）だけを貼る
    py -3.12 tools/tachie_face_patch.py paste <全身の絵> <直した顔の絵> <x> <y> <一辺> <左> <上> <右> <下> <出力>

- 直した顔の絵は、どんな大きさで届いても、一辺の大きさに縮めてから貼る（ChatGPT は切り出しと同じ構図で返す）。
- 左・上・右・下は、切り出しの中の位置（0〜一辺）。例: アルバスの目と眉 = 130 98 232 136（一辺260）。
- 元の絵は書き換えない。出力は別の名前にする。
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SCALE = 4


def crop(src, x, y, side, out_dir):
    image = Image.open(src).convert("RGB")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{Path(src).stem}_顔_切り出し_x{x}_y{y}_{side}.png"
    image.crop((x, y, x + side, y + side)).resize((side * SCALE, side * SCALE), Image.LANCZOS).save(out)
    print(out)


def paste(src, fixed, x, y, side, left, top, right, bottom, out):
    image = Image.open(src).convert("RGB")
    face = Image.open(fixed).convert("RGB").resize((side, side), Image.LANCZOS)
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).rounded_rectangle((left, top, right, bottom), radius=max(4, (bottom - top) // 3), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, side // 65)))   # 境目をぼかす
    region = image.crop((x, y, x + side, y + side))
    region.paste(face, (0, 0), mask)
    image.paste(region, (x, y))
    image.save(out)
    print(out)


def main():
    args = sys.argv[1:]
    if len(args) == 5 and args[0] == "crop":
        crop(args[1], int(args[2]), int(args[3]), int(args[4]), args[5] if len(args) > 5 else ".")
    elif len(args) == 6 and args[0] == "crop":
        crop(args[1], int(args[2]), int(args[3]), int(args[4]), args[5])
    elif len(args) == 11 and args[0] == "paste":
        paste(args[1], args[2], *map(int, args[3:10]), args[10])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

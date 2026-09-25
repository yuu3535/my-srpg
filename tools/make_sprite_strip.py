"""コマ画像（f_00.png, f_01.png …）を横一列につないだ画像にする（ブラウザ版のCSSアニメ用）。

使い方:
    py -3.12 tools/make_sprite_strip.py <コマのフォルダ> <出力PNG> [--height 128]

- 入力のコマは tools/make_flipbook.py が作ったもの（背景が透明）。
- 出力は「コマの数 × 1コマの幅」の横長の画像。CSS の steps(コマの数) で左から順に見せる。
- 元のコマは変更しない。
"""

import argparse
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("dest")
    parser.add_argument("--height", type=int, default=128, help="1コマの高さ(px)")
    args = parser.parse_args()

    frames = sorted(Path(args.source).glob("f_*.png"))
    if not frames:
        raise SystemExit(f"コマがない: {args.source}")
    first = Image.open(frames[0])
    scale = args.height / first.height
    size = (max(1, round(first.width * scale)), args.height)
    strip = Image.new("RGBA", (size[0] * len(frames), size[1]), (0, 0, 0, 0))
    for index, path in enumerate(frames):
        strip.paste(Image.open(path).convert("RGBA").resize(size, Image.LANCZOS), (index * size[0], 0))
    Path(args.dest).parent.mkdir(parents=True, exist_ok=True)
    strip.save(args.dest, optimize=True)
    print(f"{len(frames)} コマ × {size[0]}×{size[1]} → {args.dest}")


if __name__ == "__main__":
    main()

"""動画から書き出したコマ（黒い背景）を、ゲームで使うコマ画像（背景が透明）に変換する。

使い方:
    py -3.12 tools/make_flipbook.py <コマのフォルダ> <出力フォルダ> [--every 3] [--width 160]

- 入力: frame_000.png, frame_001.png …（Unity の VideoFrameExtractor が動画から書き出したもの）
- 出力: f_00.png, f_01.png …（背景を透明にし、全コマに共通の範囲で切り抜いて縮小）
- 黒い背景の発光素材を前提に、明るさを不透明度にする（加算合成と同じ見え方を、ふつうの重ね方で出す）
- 元の動画・コマは変更しない
"""

import argparse
from pathlib import Path

from PIL import Image


def to_transparent(image: Image.Image) -> Image.Image:
    """黒を透明に: 不透明度＝いちばん明るい色の値、色＝その不透明度で割り戻した色"""
    rgb = image.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    src = rgb.load()
    dst = out.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = src[x, y]
            a = max(r, g, b)
            if a < 6:
                dst[x, y] = (0, 0, 0, 0)
                continue
            dst[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), a)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("dest")
    parser.add_argument("--every", type=int, default=3, help="何コマおきに使うか（60fps の動画なら 3 で 20fps）")
    parser.add_argument("--width", type=int, default=160, help="出力の横幅(px)")
    args = parser.parse_args()

    frames = sorted(Path(args.source).glob("frame_*.png"))[:: args.every]
    if not frames:
        raise SystemExit(f"コマがない: {args.source}")
    # 全コマに共通の、光のある範囲
    box = None
    for path in frames:
        b = Image.open(path).convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        raise SystemExit("光のあるコマがない")
    dest = Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("f_*.png"):
        old.unlink()
    scale = args.width / (box[2] - box[0])
    size = (args.width, max(1, round((box[3] - box[1]) * scale)))
    for index, path in enumerate(frames):
        image = Image.open(path).crop(box).resize(size, Image.LANCZOS)
        to_transparent(image).save(dest / f"f_{index:02d}.png")
    print(f"{len(frames)} コマ → {dest}（{size[0]}×{size[1]}）")


if __name__ == "__main__":
    main()

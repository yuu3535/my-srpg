"""
地面の1枚絵（ChatGPT に正方形の下絵で頼んだもの）を、Unity の3Dの盤面に貼る形にする。

使い方:
    py -3.12 tools/import_ground_image.py マップチップ/ground_order/<届いた絵>.png

- 下絵（docs/10-design/map/graybox/watchroad_topdown_guide_square.png）は 32×32 マスで、上下の2マスずつが余白。
  その余白を切り落として 32×28 マスにし、1マス64pxの大きさ（2048×1792）にする。
- 出力: unity-prototype/Assets/Art/Board3D/Ground/watchroad_ground.png（元の絵は書き換えない）
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "unity-prototype" / "Assets" / "Art" / "Board3D" / "Ground" / "watchroad_ground.png"
SQUARE_CELLS, MARGIN_CELLS, COLUMNS, ROWS, CELL = 32, 2, 32, 28, 64


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    image = Image.open(sys.argv[1]).convert("RGB")
    w, h = image.size
    top = round(h * MARGIN_CELLS / SQUARE_CELLS)
    image = image.crop((0, top, w, h - top)).resize((COLUMNS * CELL, ROWS * CELL), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, optimize=True)
    print(f"{sys.argv[1]} -> {OUT.relative_to(ROOT).as_posix()} {image.size}")


if __name__ == "__main__":
    main()

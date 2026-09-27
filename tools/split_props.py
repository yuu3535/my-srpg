"""
1枚に複数の物（木など）が並んで描かれた絵を、1つずつの絵に分ける（背景が透明の絵）。

使い方:
    py -3.12 tools/split_props.py <絵> <出力先フォルダ> <名前1> <名前2> ...

- 不透明な所をつながりごとに分け、大きい塊を左から順に名前を付ける。小さなかけら（葉の粒など）は、いちばん近い塊に入れる。
- 1つずつ、形のまわりで切り、足元（いちばん下の不透明な所）が絵の下の端に来るようにする。元の絵は書き換えない。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return
    src, out_dir, names = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
    out_dir.mkdir(parents=True, exist_ok=True)
    rgba = np.array(Image.open(src).convert("RGBA"))
    alpha = rgba[:, :, 3]
    labels, count = ndimage.label(alpha > 24)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    big = [i + 1 for i in np.argsort(sizes)[::-1][:len(names)]]
    centers = {i: ndimage.center_of_mass(alpha > 24, labels, i)[1] for i in big}
    big.sort(key=lambda i: centers[i])
    # それぞれの画素を、いちばん近い大きな塊へ（半透明の縁や葉の粒も含める）
    dist = []
    for i in big:
        d = ndimage.distance_transform_edt(labels != i)
        dist.append(d)
    owner = np.argmin(np.stack(dist), axis=0)
    for k, (i, name) in enumerate(zip(big, names)):
        part = rgba.copy()
        part[:, :, 3] = np.where((owner == k) & (alpha > 0), alpha, 0)
        ys, xs = np.nonzero(part[:, :, 3] > 24)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        img = Image.fromarray(part[y0:y1, x0:x1])
        img.save(out_dir / f"{name}.png", optimize=True)
        print(f"{name}: {img.size}")


if __name__ == "__main__":
    main()

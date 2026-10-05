"""共通身体・頭アトラスの透過仕上げと機械的な矩形切り出し。原本は変更しない。"""
from pathlib import Path
import argparse
import json
import shutil
import sys
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
sys.path.insert(0, str(PROJECT / "tools"))
from tachie_studio import process


def clean(source, dest):
    img = Image.open(source).convert("RGBA")
    white = Image.new("RGBA", img.size, "white")
    white.alpha_composite(img)
    result = process(white.convert("RGB"), smooth=0.7, outline=0,
                     edge_cover=0, inner=0, keep_detached=True)
    result.save(dest)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("child", type=Path)
    parser.add_argument("standard", type=Path)
    parser.add_argument("heads", type=Path)
    args = parser.parse_args()
    dest = ROOT / "assets"
    dest.mkdir(parents=True, exist_ok=True)
    report = {}
    for name in ("child", "standard", "heads"):
        source = getattr(args, name)
        shutil.copy2(source, dest / f"{name}_source.png")
        cleared = clean(source, dest / f"{name}_clear.png")
        parts = [(name + "_body", (0, 0, cleared.width, cleared.height))]
        if name == "heads":
            # 生成画像は指定グリッドからずれるため、透過済み輪郭の実際の矩形を読む。
            # alphaは既存Studioの結果をそのまま保持し、ここでは変更しない。
            labels, _ = ndimage.label(np.asarray(cleared.getchannel("A")) > 0)
            regions = []
            for i, bounds in enumerate(ndimage.find_objects(labels)):
                if bounds:
                    area = int((labels[bounds] == i + 1).sum())
                    regions.append((area, (bounds[1].start, bounds[0].start,
                                           bounds[1].stop, bounds[0].stop)))
            regions = sorted(sorted(regions, reverse=True)[:3], key=lambda item: item[1][0])
            if len(regions) != 3:
                raise ValueError("独立した頭が3つ必要です")
            parts = [(part, region[1]) for part, region in zip(
                ("arshe_head", "karima_head", "gunter_head"), regions)]
        for part, region in parts:
            tile = cleared.crop(region)
            box = tile.getchannel("A").getbbox()
            if not box:
                raise ValueError(f"空の素材: {part}")
            tile = tile.crop(box)
            tile.save(dest / f"{part}.png")
            report[part] = {"size": list(tile.size), "atlasRegion": list(region),
                            "trimBox": list(box)}
    for part, original in (("arshe", "young_arshe"), ("karima", "young_karima"), ("gunter", "gunter")):
        shutil.copy2(PROJECT / "unity-prototype" / "Assets" / "Art" / "SD" / f"{original}.png",
                     dest / f"{part}_original.png")
    shutil.copy2(ROOT.parent / "assets" / "weapon" / "orcus_sword.png", dest / "orcus_sword.png")
    (dest / "asset_bounds.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

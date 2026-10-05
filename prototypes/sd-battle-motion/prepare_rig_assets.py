"""画像生成したアトラスを既存透過工程で仕上げ、矩形でパーツを切り出す。"""
from pathlib import Path
import argparse
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent.parent / "tools"))
from tachie_studio import process


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("atlas", type=Path)
    args = parser.parse_args()
    dest = ROOT / "assets" / "rig"
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.atlas, dest / "generated_atlas_source.png")
    source = Image.open(args.atlas).convert("RGBA")
    # 新規画像の透過仕上げはプロジェクト共通の処理を利用する。
    white = Image.new("RGBA", source.size, "white")
    white.alpha_composite(source)
    clean = process(white.convert("RGB"), smooth=0.7, outline=0, edge_cover=0, inner=0,
                    keep_detached=True)
    clean.save(dest / "generated_atlas_clear.png")
    crops = {
        "body": (180, 0, 760, 1000),
        "upper_arm": (1010, 190, 1170, 470),
        "forearm": (1030, 485, 1150, 722),
        "hand": (1025, 724, 1170, 880),
    }
    for name, rect in crops.items():
        part = clean.crop(rect)
        if part.getchannel("A").getbbox() is None:
            raise ValueError(f"空のパーツ: {name}")
        part.save(dest / f"{name}.png")
        print(name, part.size, part.getchannel("A").getbbox())
    # 提供素材は元ファイルを変えず、PoC 内へ複製して使う。
    sword = ROOT.parent.parent / "立ち絵透過下処理" / "武器" / "オルクス剣SD.png"
    sword_copy = ROOT / "assets" / "weapon" / "orcus_sword.png"
    if sword.exists():
        shutil.copy2(sword, sword_copy)
    elif not sword_copy.exists():
        raise FileNotFoundError("提供剣の原本、またはPoC内の共有コピーが必要です")
    # Git管理外の入力がない別環境では、共有済みの変更なしコピーを使う。


if __name__ == "__main__":
    main()

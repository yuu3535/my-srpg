"""UI素材（パネル・ボタン・ゲージ・選択枠・範囲マスなど）を、ゲームで使う形に書き出す。

使い方:
    py -3.12 tools/build_ui_assets.py

入力: アイコン素材/SRPG_UI_21_assets/（「番号_名前.png」）
出力: assets/ui/英語名.png

- パネル・ボタン・タブ・ゲージは、外側の淡い影を切り落とし、枠の線までの大きさにする
  （CSSの border-image で四隅を保ったまま伸ばすため。影はCSSで付ける）。
- 選択枠・範囲マス・区切り線は、光も絵のうちなので切り落とさない。
- 元の画像は変更しない。素材を差し替えたら、同じ名前で置いて再実行する。
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "アイコン素材" / "SRPG_UI_21_assets"
OUT_DIR = ROOT / "assets" / "ui"

# 番号 → (書き出す名前, 外側の影を切り落とす透明度のしきい値。None なら切り落とさない)
ASSETS = {
    "01": ("panel_large", 128),
    "02": ("panel_mid", 128),
    "03": ("panel_small", 128),
    "04": ("list_cell", 128),
    "05": ("overlay_panel", 128),
    "06": ("title_plate", 128),
    "07": ("tab_off", 128),
    "08": ("tab_on", 128),
    "09": ("button", 128),
    "10": ("button_primary", 128),
    "11": ("button_danger", 128),
    "12": ("gauge_base", 128),
    "13": ("gauge_green", 128),
    "14": ("gauge_blue", 128),
    "15": ("gauge_red", 128),
    "16": ("separator_h", None),
    "17": ("separator_v", None),
    "18": ("select_ally", None),
    "19": ("select_enemy", None),
    "20": ("tile_move", None),
    "21": ("tile_attack", None),
}


def trim(image: Image.Image, threshold: int) -> Image.Image:
    alpha = image.getchannel("A").point(lambda a: 255 if a >= threshold else 0)
    bbox = alpha.getbbox()
    return image.crop(bbox) if bbox else image


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(SRC.glob("*.png")):
        key = path.name[:2]
        if key not in ASSETS:
            continue
        name, threshold = ASSETS[key]
        image = Image.open(path).convert("RGBA")
        if threshold is not None:
            image = trim(image, threshold)
        out = OUT_DIR / f"{name}.png"
        image.save(out, optimize=True)
        print(f"{path.name} -> {out.relative_to(ROOT).as_posix()} {image.size}")


if __name__ == "__main__":
    main()

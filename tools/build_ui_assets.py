"""UI素材（パネル・ボタン・ゲージ・選択枠・範囲マスなど）を、ゲームで使う形に書き出す。

使い方:
    py -3.12 tools/build_ui_assets.py

入力: アイコン素材/SRPG_UI_21_assets/（「番号_名前.png」）と、発注書で作った素材（ORDERED_ASSETS）
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


# 発注書（docs/30-planning/UI_ASSET_ORDER_2026-09-25.md）で作った素材。
# (元のファイル, 書き出す名前, 切り落としのしきい値, 縮める先 ("width"|"height"|"square", px) または None)
ORDERED_ASSETS = [
    # ChatGPT（アイコン素材/発注UI/）: 光沢なし・細い金の線の枠
    ("アイコン素材/発注UI/A1.png", "panel_a1", 128, ("width", 512)),     # 基本パネル（上辺だけ太い金の線）
    ("アイコン素材/発注UI/A2.png", "panel_a2", 128, ("width", 512)),     # 基本パネル（敵: 上辺が赤）
    ("アイコン素材/発注UI/A3.png", "heading_bar", 64, ("height", 256)),  # 見出しの飾り（縦の金の線）
    ("アイコン素材/発注UI/A4.png", "separator_a4", 64, ("width", 1024)), # 区切り線（中央に菱形）
    # Codex（アイコン素材/SRPG_UI_v2/）: 盤面の選択枠（線はマスの縁に合わせて使う）
    ("アイコン素材/SRPG_UI_v2/D4_選択枠_味方.png", "select_ally_v2", None, None),
    # ChatGPT 第2版（docs/30-planning/UI_ASSET_ORDER_2026-09-26_v2.md）
    # ボタン: 縦を保ったまま横に伸ばす（飾りは左右の端だけ）
    ("アイコン素材/発注UI/B1-1.png", "button_b1_normal", 128, ("width", 880)),    # 主ボタン（実行）: 赤銅の帯
    ("アイコン素材/発注UI/B1-2.png", "button_b1_pressed", 128, ("width", 880)),
    ("アイコン素材/発注UI/B1-3.png", "button_b1_disabled", 128, ("width", 880)),
    ("アイコン素材/発注UI/B2-1.png", "button_b2_normal", 128, ("width", 880)),    # 副ボタン（戻る）: 黒紫の地に金の線
    ("アイコン素材/発注UI/B2-2.png", "button_b2_pressed", 128, ("width", 880)),
    ("アイコン素材/発注UI/B2-3_v2.png", "button_b2_disabled", 128, ("width", 880)),  # 作り直し版（縁が灰色）
    # 盤面の印: 線までで切り抜き、マスの縁に線が来るようにする（外の光は切れる）
    ("アイコン素材/発注UI/D1.png", "range_move", 128, ("square", 256)),       # 移動範囲（今は使わない。移動範囲は従来の青）
    ("アイコン素材/発注UI/D2.png", "range_attack", 128, ("square", 256)),     # 攻撃範囲
    ("アイコン素材/発注UI/D3.png", "range_support", 128, ("square", 256)),    # 補助範囲（転移など）
    ("アイコン素材/発注UI/D4.png", "select_ally_d4", 128, ("square", 256)),   # 選択中の味方
    ("アイコン素材/発注UI/D5.png", "select_enemy_d5", 128, ("square", 256)),  # 攻撃の相手
    ("アイコン素材/発注UI/D6.png", "move_dest", 128, ("square", 256)),        # 移動先の印
    # ChatGPT 第3版（docs/30-planning/MAP_UI_ASSET_ORDER_2026-09-26_v3.md）。画面の2倍の大きさで書き出す
    ("アイコン素材/発注UI_v3/F2-1.png", "fc_emblem_sword", 64, ("height", 264)),  # 帯の真ん中の紋章（交差した剣）。魔法でも同じ（F2-2 の本は使わない）
    ("アイコン素材/発注UI_v3/F3-1.png", "button_f3_normal", 128, ("height", 50)),  # 「攻撃する」（紫の帯）
    ("アイコン素材/発注UI_v3/F3-2.png", "button_f3_pressed", 128, ("height", 50)),
    ("アイコン素材/発注UI_v3/F3-3.png", "button_f3_red", 128, ("height", 50)),     # 届いたのは赤の帯（灰色の「使えない時」ではない）
    ("アイコン素材/発注UI_v3/F5.png", "heading_flourish", 64, ("width", 400)),     # 見出しの下の飾り
    ("アイコン素材/発注UI_v3/R1.png", "roster_frame", 128, ("width", 92)),         # 味方一覧の枠（上下に伸ばす）
    ("アイコン素材/発注UI_v3/A5-1.png", "face_frame", 128, ("width", 96)),         # 顔枠: 通常
    ("アイコン素材/発注UI_v3/A5-2.png", "face_frame_selected", 128, ("width", 96)),  # 選択中
    ("アイコン素材/発注UI_v3/A5-3.png", "face_frame_done", 128, ("width", 96)),    # 行動済み
    # 盤面の印: 光も絵のうち（ごく薄い光だけ切る）
    ("アイコン素材/発注UI_v3/P1.png", "mark_target", 8, ("square", 96)),     # 狙う相手の頭上
    ("アイコン素材/発注UI_v3/P2.png", "mark_selected", 8, ("width", 72)),    # 選んだ味方の頭上
    ("アイコン素材/発注UI_v3/P3.png", "mark_intent", 8, ("square", 48)),     # 行動予告のある敵
]

# 武器の種類のアイコン（F4）: 形のまわりで切り、正方形の真ん中に置く。
# 「魔導書」は「魔法」（燃える生命核）に変わった（ChatGPT CLAUDE_CODE_HANDOFF_F4_MAGIC_2026-09-27）
WEAPON_ICONS = [
    ("アイコン素材/発注UI_v3/F4-剣.png", "weapon_sword"),
    ("アイコン素材/発注UI_v3/F4-槍.png", "weapon_lance"),
    ("アイコン素材/発注UI_v3/F4-斧.png", "weapon_axe"),
    ("アイコン素材/発注UI_v3/F4-弓.png", "weapon_bow"),
    ("アイコン素材/発注UI_v3/F4-杖.png", "weapon_staff"),
    ("アイコン素材/発注UI_v3/F4-魔法.png", "weapon_magic"),
]

# 戦闘予測の帯の枠（F1）。ゲームでは 681×132px。枠の線と飾りは細く保ち、間の無地だけを伸ばす
BAND_FRAME = ("アイコン素材/発注UI_v3/F1.png", "fc_band", (1362, 264), 0.36)
# 切り抜いた F1（2037×399）の、縮めるだけの所（四隅・辺の真ん中の菱形）と、伸ばす所
BAND_X = [(0, 200, False), (200, 870, True), (870, 1167, False), (1167, 1837, True), (1837, 2037, False)]
BAND_Y = [(0, 138, False), (138, 166, True), (166, 233, False), (233, 261, True), (261, 399, False)]


def even_frame(image: Image.Image, rows: int = 28) -> Image.Image:
    """上辺だけ太いA1の枠を、上下同じ太さにする（下辺を上下反転して上辺に貼る。原作者 2026-09-26）"""
    out = image.copy()
    bottom = image.crop((0, image.height - rows, image.width, image.height)).transpose(Image.FLIP_TOP_BOTTOM)
    out.paste(bottom, (0, 0))
    return out


def reddish(image: Image.Image) -> Image.Image:
    """金の線だけを落ち着いた赤（#c95a4a 付近）にする。暗い地はそのまま"""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if r > 60 and r > b * 1.3:
                px[x, y] = (round(r * 0.92), round(g * 0.45), round(b * 0.75), a)
    return out


def violet_fill(image: Image.Image) -> Image.Image:
    """B2（黒紫の地に金の線）の地だけを紫の帯にする。「攻撃する」ボタン用（原作者の見本 2026-09-26）"""
    out = image.copy()
    px = out.load()
    h = out.height
    for y in range(h):
        t = y / max(1, h - 1)
        top, bottom = (104, 52, 150), (54, 24, 88)
        fill = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a > 0 and r < 90 and r - b < 30:   # 金の線ではない暗い地
                px[x, y] = (*fill, a)
    return out


def slice_resize(image: Image.Image, size, scale: float, xs, ys) -> Image.Image:
    """
    枠の絵を、線と飾りの太さを保ったまま大きさを変える（9分割を細かくしたもの）。
    xs・ys は (始まり, 終わり, 伸ばすか)。伸ばさない所は scale 倍、伸ばす所で残りを埋める
    """
    def plan(segs, total):
        fixed = sum(round((e - s) * scale) for s, e, stretch in segs if not stretch)
        stretch_src = sum(e - s for s, e, stretch in segs if stretch)
        out, pos = [], 0
        for i, (s, e, stretch) in enumerate(segs):
            if i == len(segs) - 1:
                n = total - pos
            elif stretch:
                n = round((total - fixed) * (e - s) / stretch_src)
            else:
                n = round((e - s) * scale)
            out.append((s, e, pos, n))
            pos += n
        return out
    W, H = size
    result = Image.new("RGBA", (W, H))
    for sx0, sx1, dx, w in plan(xs, W):
        for sy0, sy1, dy, h in plan(ys, H):
            if w > 0 and h > 0:
                result.paste(image.crop((sx0, sy0, sx1, sy1)).resize((w, h), Image.LANCZOS), (dx, dy))
    return result


def replace_fill(framed: Image.Image, source: Image.Image, inset: int) -> Image.Image:
    """
    伸ばした枠の中の地（縦に伸びて筋になる）を、元の絵の中の地をそのまま縮めたものに替える。
    金の線・飾り（明るい所）だけは枠の絵のまま残す
    """
    W, H = framed.size
    sw, sh = source.size
    fill = source.crop((round(sw * 0.15), round(sh * 0.25), round(sw * 0.85), round(sh * 0.75))).resize((W - inset * 2, H - inset * 2), Image.LANCZOS)
    out = framed.copy()
    fp, op = fill.load(), out.load()
    for y in range(fill.height):
        for x in range(fill.width):
            r, g, b, a = op[x + inset, y + inset]
            if max(r, g) < 70:   # 金ではない暗い地
                op[x + inset, y + inset] = fp[x, y]
    return out


def square_icon(image: Image.Image, size: int, margin: float = 0.06) -> Image.Image:
    """形のまわりで切ったアイコンを、正方形の真ん中に置く"""
    inner = round(size * (1 - margin * 2))
    icon = image.copy()
    icon.thumbnail((inner, inner), Image.LANCZOS)
    out = Image.new("RGBA", (size, size))
    out.paste(icon, ((size - icon.width) // 2, (size - icon.height) // 2), icon)
    return out



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

    for source, name, threshold, resize in ORDERED_ASSETS:
        path = ROOT / source
        if not path.exists():
            print(f"見つからない（とばす）: {source}")
            continue
        image = Image.open(path).convert("RGBA")
        if threshold is not None:
            image = trim(image, threshold)
        if resize:
            side, size = resize
            if side == "square":
                image = image.resize((size, size), Image.LANCZOS)
            else:
                scale = size / (image.width if side == "width" else image.height)
                image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
        out = OUT_DIR / f"{name}.png"
        image.save(out, optimize=True)
        print(f"{path.name} -> {out.relative_to(ROOT).as_posix()} {image.size}")

    # 上下同じ太さの枠（味方・敵）
    a1 = OUT_DIR / "panel_a1.png"
    if a1.exists():
        even = even_frame(Image.open(a1).convert("RGBA"))
        even.save(OUT_DIR / "panel_even.png", optimize=True)
        reddish(even).save(OUT_DIR / "panel_even_enemy.png", optimize=True)
        print("panel_a1.png -> assets/ui/panel_even.png, panel_even_enemy.png")
    for source, name in WEAPON_ICONS:
        path = ROOT / source
        if not path.exists():
            print(f"見つからない（とばす）: {source}")
            continue
        square_icon(trim(Image.open(path).convert("RGBA"), 64), 64).save(OUT_DIR / f"{name}.png", optimize=True)
        print(f"{path.name} -> assets/ui/{name}.png")

    source, name, size, scale = BAND_FRAME
    if (ROOT / source).exists():
        band = trim(Image.open(ROOT / source).convert("RGBA"), 128)
        replace_fill(slice_resize(band, size, scale, BAND_X, BAND_Y), band, 12).save(OUT_DIR / f"{name}.png", optimize=True)
        print(f"F1.png -> assets/ui/{name}.png {size}")


    b2 = OUT_DIR / "button_b2_normal.png"
    if b2.exists():
        violet_fill(Image.open(b2).convert("RGBA")).save(OUT_DIR / "button_violet.png", optimize=True)
        print("button_b2_normal.png -> assets/ui/button_violet.png")


if __name__ == "__main__":
    main()

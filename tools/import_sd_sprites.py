# 盤面のキャラのSDの絵（原作者が ChatGPT で作り、背景を抜いたもの）を Unity へ取り込む。
#
#   py -3.12 tools/import_sd_sprites.py [入力のフォルダ（既定: 立ち絵透過下処理/AI_SD）]
#
# ・色のある所（キャラ）だけを切り出し、上下左右に少し余白を足す（足の裏は下から3%）
# ・縦 512px まで縮める（元は 1254px。公開版を軽くするため）
# ・unity-prototype/Assets/Art/SD/<英字の名前>.png に書く（元の絵は変えない）
# どのキャラ（盤面の id）にどの絵を使うかは Unity 側（Editor/Agent/SdSprites.cs）で決める。
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "立ち絵透過下処理", "AI_SD")
DEST = os.path.join(ROOT, "unity-prototype", "Assets", "Art", "SD")
MAX_HEIGHT = 512
MARGIN = 0.03   # 余白（絵の高さに対する割合）

# 元の名前 → 英字の名前（Unity のファイル名）
NAMES = {
    "アルシェ": "young_arshe", "カリマ": "young_karima", "ギュンター": "gunter", "ベル": "bell",
    "リングホルム": "ringholm", "アルバス": "albas", "アルバス(魔物)": "albas_demon", "アン": "anne",
    "ウロボロスの双子・姉": "ouroboros_sister", "ウロボロスの双子・弟": "ouroboros_brother",
    "キャリー(過去)": "carrie", "キャリー(現代)": "carrie_present", "フィロ": "philo", "ヴァルツ": "walz",
    "アルストロモブ将軍": "alstro_general", "アルストロモブ弓兵士": "alstro_archer",
    "アルストロモブ槍兵士": "alstro_spear_1", "アルストロモブ槍兵士1-2": "alstro_spear_2",
    "アルストロモブ槍兵士1-3": "alstro_spear_3", "アルストロモブ槍兵士1-4": "alstro_spear_4",
    "アルストロ女モブ1-1": "alstro_mage_1", "アルストロ女モブ1-2": "alstro_mage_2",
    "アルストロ女モブ1-3": "alstro_mage_3", "アルストロ女モブ1-4": "alstro_mage_4",
    "オルクスモブ弓": "orcus_archer", "オルクス剣士モブ": "orcus_sword",
    "オルクス女モブ1-1": "orcus_mage_1", "オルクス女モブ1-2": "orcus_mage_2",
    "オルクス女モブ1-3": "orcus_mage_3", "オルクス女モブ1-4": "orcus_mage_4",
    "オルクス将軍モブ": "orcus_general", "オルクス騎乗モブ": "orcus_rider",
    "貧しいおっさんモブ": "poor_man", "貧しい女モブ": "poor_woman", "貧しい少女モブ": "poor_girl", "貧しい少年モブ": "poor_boy",
    "漁村青年モブ": "fisher_youth",
}


def main():
    os.makedirs(DEST, exist_ok=True)
    done, skipped = 0, []
    for file in sorted(os.listdir(SRC)):
        stem, ext = os.path.splitext(file)
        if ext.lower() != ".png":
            continue
        name = NAMES.get(stem)
        if name is None:
            skipped.append(file)
            continue
        im = Image.open(os.path.join(SRC, file)).convert("RGBA")
        alpha = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
        box = alpha.getbbox()
        if box is None:
            skipped.append(file)
            continue
        im = im.crop(box)
        w, h = im.size
        pad = int(round(h * MARGIN))
        canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
        canvas.paste(im, (pad, pad))
        if canvas.height > MAX_HEIGHT:
            scale = MAX_HEIGHT / canvas.height
            canvas = canvas.resize((max(1, round(canvas.width * scale)), MAX_HEIGHT), Image.LANCZOS)
        out = os.path.join(DEST, name + ".png")
        # 中身が同じなら書かない（Unity が読み込み中の絵を上書きしないように）
        tmp = out + ".tmp.png"
        canvas.save(tmp, optimize=True)
        if os.path.exists(out) and open(out, "rb").read() == open(tmp, "rb").read():
            os.remove(tmp)
        else:
            os.replace(tmp, out)
        done += 1
    print(f"取り込み: {done} 枚 → {os.path.relpath(DEST, ROOT)}")
    if skipped:
        print("名前の表にない（取り込まなかった）:", ", ".join(skipped))


if __name__ == "__main__":
    main()

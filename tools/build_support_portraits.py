# 支援会話の相手選び画面の立ち絵を作る（2026-11-12 総合担当）
#
# 仕様書 docs/10-design/ui/support_select/support_select_spec.md §11 の「顔の位置と大きさをそろえて切り抜く」用。
# 元の立ち絵（Unity の Art/Portraits）を、頭の幅がそろう大きさに縮めて Resources/Support/Portraits/ に書き出し、
# 縮めたあとの顔の中心 (fx, fy) と頭の幅 hw を faces.json に書く。画面で一番大きく出すのはカードの頭の幅 40px なので、
# その2倍（OUT_HEAD）にそろえる。
#
# アルシェとアルバスは、見本 ref_01 のカードに元の立ち絵を総当たりで重ねて、いちばん合う大きさ・位置から出した値。
# ほかの人は目で測った値（顔の中心＝両目のまん中あたり、頭の幅＝頬から頬）。直すときは FACES の値を変えて、もう一度実行する:
#   py -3.12 tools/build_support_portraits.py
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'unity-prototype', 'Assets', 'Art', 'Portraits')
OUT = os.path.join(ROOT, 'unity-prototype', 'Assets', 'Resources', 'Support', 'Portraits')
OUT_HEAD = 84  # 縮めたあとの頭の幅（px）

# id: (元の立ち絵, 顔の中心 x, y, 頭の幅) — 元の立ち絵の px
FACES = {
    'arshe': ('Dialogue/アルシェ.png', 565, 176, 144),
    'albus': ('albas.png', 409, 118, 68),
    'karima': ('Dialogue/カリマ.png', 522, 195, 140),
    'carrie': ('Dialogue/キャリー.png', 535, 130, 125),
    'henry': ('Dialogue/ヘンリー.png', 535, 165, 120),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    faces = []
    for pid, (path, fx, fy, hw) in FACES.items():
        im = Image.open(os.path.join(SRC, path)).convert('RGBA')
        box = im.split()[3].getbbox()   # 透明なふちを切る
        im = im.crop(box)
        fx, fy = fx - box[0], fy - box[1]
        s = min(1.0, OUT_HEAD / hw)   # 元より大きくはしない
        w, h = round(im.width * s), round(im.height * s)
        im = im.resize((w, h), Image.LANCZOS)
        im.save(os.path.join(OUT, pid + '.png'))
        faces.append({'id': pid, 'w': w, 'h': h, 'fx': round(fx * s, 1), 'fy': round(fy * s, 1), 'hw': round(hw * s, 1)})
        print(pid, w, h)
    with open(os.path.join(OUT, 'faces.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'_note': '支援会話の相手選びの立ち絵の顔の位置（tools/build_support_portraits.py で作る。手で直さない）', 'faces': faces}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()

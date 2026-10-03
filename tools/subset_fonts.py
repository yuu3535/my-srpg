"""Unity版の字体（Noto Serif JP）を、ゲームで使う字だけに絞る（総合担当 2026-10-03）。

Unity版（WebGL）の読み込みのうち、字体2つで約15MBあった。WebGL では字体を丸ごと入れるため、
JIS X 0208（第1・第2水準の漢字・かな・記号）＋ ASCII ＋ ゲームのデータとコードに出てくる字 に絞る。

使い方:
    py -3.12 tools/subset_fonts.py

入力: unity-prototype/FontsSource/NotoSerifJP-*.ttf（元の字体。Assets の外に置き、Unity には読ませない）
出力: unity-prototype/Assets/Fonts/NotoSerifJP-*.ttf（同じ名前で上書き。.meta はそのまま）
シナリオ・データに新しい字が増えたら、もう一度実行する（JIS にない字＝絵文字や珍しい記号などを拾う）。
字体は SIL Open Font License（OFL.txt）。絞った字体も同じライセンスで配布できる。
"""
import re
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "unity-prototype" / "FontsSource"
DST = ROOT / "unity-prototype" / "Assets" / "Fonts"
TEXT_DIRS = [
    ROOT / "unity-prototype" / "Assets" / "Data",
    ROOT / "unity-prototype" / "Assets" / "Scripts",
]


def jis_x0208():
    chars = set()
    for hi in list(range(0x81, 0xA0)) + list(range(0xE0, 0xF0)):
        for lo in range(0x40, 0xFD):
            if lo == 0x7F:
                continue
            try:
                c = bytes([hi, lo]).decode("cp932")
            except UnicodeDecodeError:
                continue
            if len(c) == 1:
                chars.add(c)
    return chars


def used_chars():
    chars = set()
    for d in TEXT_DIRS:
        for p in d.rglob("*"):
            if p.suffix.lower() in (".json", ".cs"):
                try:
                    chars.update(p.read_text(encoding="utf-8"))
                except UnicodeDecodeError:
                    pass
    return {c for c in chars if ord(c) >= 0x20}


def main():
    chars = set(chr(i) for i in range(0x20, 0x7F)) | jis_x0208() | used_chars()
    chars |= set("　「」『』（）【】〈〉《》…‥―ー～・、。！？♪◆◇●○■□▲△▼▽◀▶»«①②③④⑤")
    text = "".join(sorted(chars))
    for src in sorted(SRC.glob("NotoSerifJP-*.ttf")):
        opt = subset.Options()
        opt.layout_features = ["*"]
        opt.name_IDs = ["*"]
        opt.notdef_outline = True
        font = subset.load_font(str(src), opt)
        sub = subset.Subsetter(opt)
        sub.populate(text=text)
        sub.subset(font)
        out = DST / src.name
        subset.save_font(font, str(out), opt)
        print(f"wrote {out.relative_to(ROOT)} {out.stat().st_size // 1024}KB（{len(chars)}字）")


if __name__ == "__main__":
    main()

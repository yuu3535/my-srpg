# フォントをゲームで使う字だけに絞る（Shippori Mincho は 1つ約8.6MB あるため）
# 使い方: py -3.12 tools/subset_menu_fonts.py <ダウンロードした元の ttf の置き場> unity-prototype/Assets/Resources/Fonts .
#   元の ttf は github.com/google/fonts の ofl/shipporimincho・ofl/barlowcondensed（SIL OFL）。リポジトリには入れない
# 2026-11-13: 第2水準漢字も入れた（「絆」が無くて支援会話の帯の文が欠けた）。新しい文を足したら、もう一度実行する
import glob, os, sys
from fontTools import subset

dl, out, root = sys.argv[1], sys.argv[2], sys.argv[3]
chars = set()
for c in range(0x20, 0x7F): chars.add(chr(c))
# JIS X 0208 の記号・英数・かな・第1水準・第2水準漢字（EUC-JP の 0xA1A1〜0xF4A6）
for hi in range(0xA1, 0xF5):
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode('euc_jp'))
        except Exception: pass
# ゲームの文（Unity のデータ・コード）に出てくる字
for pat in ['unity-prototype/Assets/Data/**/*.json', 'unity-prototype/Assets/Scripts/**/*.cs', 'unity-prototype/Assets/Resources/**/*.json', 'scenario.js', 'characters.js']:
    for p in glob.glob(os.path.join(root, pat), recursive=True):
        try: chars.update(open(p, encoding='utf-8').read())
        except Exception: pass
chars = {c for c in chars if c.isprintable() or c == '　'}
text = ''.join(sorted(chars))
print('chars', len(text))
for src, dst in [('shipporimincho_ShipporiMincho-SemiBold.ttf', 'ShipporiMincho-SemiBold.ttf'),
                 ('shipporimincho_ShipporiMincho-ExtraBold.ttf', 'ShipporiMincho-ExtraBold.ttf'),
                 ('barlowcondensed_BarlowCondensed-SemiBold.ttf', 'BarlowCondensed-SemiBold.ttf')]:
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_legacy = True
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.glyph_names = False
    f = subset.load_font(os.path.join(dl, src), opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(f)
    subset.save_font(f, os.path.join(out, dst), opts)
    print(dst, os.path.getsize(os.path.join(out, dst)))

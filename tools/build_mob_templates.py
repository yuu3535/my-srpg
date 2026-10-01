"""
モブ（名のない敵）の「型」の数値の案を計算する（採用版 DAMAGE_WEAPON_ENEMY_RULES.md §5 の作り方）。

  配置する因果Lv L の能力値（期待値）= 因果Lv1基礎値 + (L − 1) × 実効成長率
  実効成長率 = 型の成長率 + 汎用兵種の成長率補正 + floor((幸運 + 最大勇気) / 40)%

出力:
  - 標準出力: 文書に貼る Markdown の表（docs/30-planning/MOB_TEMPLATES_DRAFT_2026-10-01.md の数値の元）
  - output/モブの型_案.csv（Googleドライブに貼る用。Git の外）

使い方:  py -3.12 tools/build_mob_templates.py
"""
import csv
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEYS = ["HP", "力", "防御", "魔攻", "魔防", "技", "速さ", "魅力"]
LEVELS = [1, 5, 10, 15, 20, 30, 40, 50]

# ── 型（系統ごと）: 因果Lv1基礎値（ヒト）と型の成長率(%)・幸運・最大勇気 ──
# 基準は「ふつうのヒト」= TRPG 3d6 の平均（10.5）を採用版 §4.1 の式で換算した値:
#   HP 11・力 10・防御 10・魔攻 10・魔防 10・技 5・速さ 6（DEX/4 + 回避技能4ほど）・魅力 10
# そこから系統の得意・不得意を少し振る（合計は基準とほぼ同じ）
TYPES = {
    "戦列": {"base": [13, 12, 12, 7, 9, 5, 6, 10], "growth": [60, 55, 50, 15, 30, 40, 45, 30], "luck": 40, "courage": 45,
             "note": "剣・槍・斧の歩兵。兵士・戦士・ならず者・盗賊の荒くれ"},
    "術":   {"base": [11, 7, 8, 13, 12, 6, 6, 10], "growth": [40, 15, 25, 55, 50, 45, 45, 50], "luck": 40, "courage": 40,
             "note": "杖・魔核で魔法を使う兵。魔法兵・神官・呪術師"},
    "騎兵": {"base": [12, 11, 11, 8, 9, 5, 7, 10], "growth": [50, 50, 50, 15, 30, 40, 50, 40], "luck": 40, "courage": 45,
             "note": "馬・竜に乗る兵。移動が長い"},
    "隠密": {"base": [10, 10, 8, 9, 9, 7, 9, 9], "growth": [40, 55, 25, 20, 30, 60, 55, 40], "luck": 45, "courage": 35,
             "note": "斥候・盗人・弓兵。技と速さが高く、打たれ弱い"},
    "民間人": {"base": [9, 8, 8, 8, 8, 4, 4, 10], "growth": [25, 20, 15, 15, 15, 25, 30, 55], "luck": 40, "courage": 30,
             "note": "戦わない町の人・村人（アン＝合計245% より弱い）"},
}

# 汎用兵種の成長率補正（採用版 GENERIC_CLASS_GROWTH_RATES.md §2）と、使う型
CLASSES = {
    "戦列下級":     ("戦列", [10, 10, 5, -10, -5, 0, 0, 0], "戦士・ならず者・兵士（剣・槍・斧）"),
    "戦列攻撃上級": ("戦列", [5, 10, 5, 0, -5, 10, 0, 0], "傭兵・ブレイバー"),
    "戦列防御上級": ("戦列", [10, 5, 10, -5, 5, 0, 0, 0], "ガーディアン"),
    "術下級":       ("術", [0, -10, -5, 10, 10, 0, 0, 5], "魔導師・魔法兵"),
    "術軍師上級":   ("術", [-5, 0, 0, 10, 5, 5, 0, 10], "戦術士"),
    "術魔法上級":   ("術", [5, -5, 0, 10, 10, 0, 0, 5], "アークメイジ・カラミティ"),
    "騎兵下級":     ("騎兵", [0, 5, 5, -5, 0, -5, 10, 5], "ナイト"),
    "騎馬上級":     ("騎兵", [0, 5, 10, -5, 0, 0, 5, 10], "パラディン"),
    "飛行上級":     ("騎兵", [0, 5, 5, 10, -5, 0, 10, 0], "スカイナイト・ドラゴンライダー"),
    "隠密下級":     ("隠密", [-5, 0, -10, 5, 0, 10, 10, 0], "斥候・盗人・弓兵"),
    "隠密暗殺上級": ("隠密", [0, 5, 0, 0, 5, 10, 10, -5], "アサシン"),
    "隠密遊撃上級": ("隠密", [5, 5, 0, 0, 10, 10, -5, 0], "シューター（弓）"),
    "民間人":       ("民間人", [0] * 8, "兵種なし"),
}

# 種族の差（採用版 §4.4 の能力値ダイスの平均の差を、§4.1 の換算式に通した値）
#   魔物: STR・CON・DEX・POW・INT が 4d6（+3.5）。竜人: 魔物と同じ＋SIZ が +1d10（+5.5）。エルフ: STR 2d6（−3.5）・POW 4d6・APP +1d3
RACES = {
    "ヒト":   [0, 0, 0, 0, 0, 0, 0, 0],
    "魔物":   [2, 3, 2, 3, 3, 2, 1, 0],
    "竜人":   [5, 3, 5, 3, 3, 2, 1, 0],
    "エルフ": [0, -3, -2, 3, 2, 0, 0, 2],
}

# 比べる相手（採用版 §5・§6・§6.1。個人成長率＋幸運・勇気補正。兵種補正は入れない）
HEROES = {
    "幼アルシェ": {"base": [13, 14, 13, 18, 15, 9, 10, 15], "growth": [70, 60, 55, 55, 50, 70, 70, 60], "bonus": 4},
    "リングホルム": {"base": [12, 16, 13, 16, 14, 7, 12, 16], "growth": [45, 75, 45, 65, 65, 75, 70, 60], "bonus": 3},
    "アルバス": {"base": [18, 12, 13, 24, 22, 12, 9, 17], "growth": [65, 40, 50, 80, 75, 80, 55, 70], "bonus": 3},
}


def luck_bonus(t):
    return math.floor((t["luck"] + t["courage"]) / 40)


def effective(class_name):
    tname, cls, _ = CLASSES[class_name]
    t = TYPES[tname]
    b = luck_bonus(t)
    return [max(0, g + c + b) for g, c in zip(t["growth"], cls)]


def mob_at(class_name, level, race="ヒト"):
    tname = CLASSES[class_name][0]
    base = [v + r for v, r in zip(TYPES[tname]["base"], RACES[race])]
    eff = effective(class_name)
    return [round(v + (level - 1) * e / 100) for v, e in zip(base, eff)]


def hero_at(name, level):
    h = HEROES[name]
    return [round(v + (level - 1) * (g + h["bonus"]) / 100) for v, g in zip(h["base"], h["growth"])]


def dmg(atk, dfn, power=6):
    return max(1, round(power + (atk - dfn) / 2))


def hits(hp, d):
    return math.ceil(hp / d)


def table(header, rows):
    out = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] + ["---:"] * (len(header) - 1)) + " |"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def main():
    md = []
    md.append("### 型（ヒト）の因果Lv1基礎値と型の成長率\n")
    rows = []
    for name, t in TYPES.items():
        rows.append([name] + t["base"] + [f"{sum(t['base'][1:])}"])
    md.append(table(["型"] + KEYS + ["HP以外の合計"], rows))
    md.append("")
    rows = []
    for name, t in TYPES.items():
        rows.append([name] + [f"{g}%" for g in t["growth"]] + [f"{sum(t['growth'])}%", f"{t['luck']} / {t['courage']}", f"+{luck_bonus(t)}%"])
    md.append(table(["型"] + KEYS + ["合計", "幸運 / 最大勇気", "幸運・勇気補正"], rows))

    md.append("\n### 兵種ごとの実効成長率（型の成長率 + 兵種補正 + 幸運・勇気補正）\n")
    rows = []
    for c, (tname, _, disp) in CLASSES.items():
        e = effective(c)
        rows.append([c, tname, disp] + [f"{v}%" for v in e] + [f"{sum(e)}%"])
    md.append(table(["兵種", "型", "例"] + KEYS + ["合計"], rows))

    md.append("\n### 因果Lvごとの期待値（ヒト・四捨五入）\n")
    for c in CLASSES:
        rows = [[f"Lv{L}"] + mob_at(c, L) for L in LEVELS]
        md.append(f"#### {c}（{CLASSES[c][2]}）\n")
        md.append(table(["因果Lv"] + KEYS, rows))
        md.append("")

    md.append("### 種族の補正（因果Lv1基礎値に足す）\n")
    md.append(table(["種族"] + KEYS, [[r] + v for r, v in RACES.items()]))

    # 手応え: 同じ因果Lvでの殴り合い（中威力6）
    md.append("\n### 手応え: 同じ因果Lvでの殴り合い（武器威力6・何発で倒れるか）\n")
    rows = []
    for L in [1, 10, 20, 30, 40]:
        a = hero_at("幼アルシェ", L)
        r = hero_at("リングホルム", L)
        al = hero_at("アルバス", L)
        s = mob_at("戦列下級" if L < 20 else "戦列攻撃上級", L)
        m = mob_at("術下級" if L < 20 else "術魔法上級", L)
        k = mob_at("隠密下級" if L < 20 else "隠密遊撃上級", L)
        rows.append([
            f"Lv{L}",
            hits(s[0], dmg(a[1], s[2])), hits(a[0], dmg(s[1], a[2])),
            hits(m[0], dmg(r[1], m[2])), hits(r[0], dmg(m[3], r[4])),
            hits(s[0], dmg(al[3], s[4])), hits(al[0], dmg(s[1], al[2])),
            hits(k[0], dmg(a[1], k[2])), hits(a[0], dmg(k[1], a[2])),
        ])
    md.append(table(["因果Lv", "アルシェ→戦列", "戦列→アルシェ", "リングホルム→術", "術→リングホルム（魔法）",
                     "アルバス→戦列（魔法）", "戦列→アルバス", "アルシェ→隠密", "隠密→アルシェ"], rows))
    md.append("\n（Lv20以上は上級の兵種: 戦列攻撃上級・術魔法上級・隠密遊撃上級。主人公たちは兵種補正なし）")
    print("\n".join(md))

    out = ROOT / "output" / "モブの型_案.csv"
    out.parent.mkdir(exist_ok=True)
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["兵種", "型", "例", "因果Lv"] + KEYS + [f"成長率_{k}" for k in KEYS])
        for c in CLASSES:
            for L in LEVELS:
                w.writerow([c, CLASSES[c][0], CLASSES[c][2], L] + mob_at(c, L) + [f"{v}%" for v in effective(c)])
    print(f"\n[CSV] {out}")


if __name__ == "__main__":
    main()

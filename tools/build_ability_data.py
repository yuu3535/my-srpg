"""兵種表CSVから abilityData.js（スキル・戦技・兵種の純粋データ）を作る。

使い方:
    py -3.12 tools/build_ability_data.py

入力: Regarding character growth rates, skills, and combat arts/ の兵種表CSV
出力: abilityData.js（リポジトリ直下。index.html とNodeテストから読む）

CSVは原作者が管理する正本。abilityData.js は手で直さず、CSVを直してからこのスクリプトを再実行する。
"""

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Regarding character growth rates, skills, and combat arts"
OUT = ROOT / "abilityData.js"

STAT_KEYS = {
    "HP": "hp", "力": "atk", "魔攻": "mag", "防御": "def",
    "魔防": "res", "技": "tec", "速さ": "spd", "魅力": "cha",
}
KIND_BY_LABEL = {
    "スキル": "skill",
    "物理戦技": "physicalArt",
    "魔法戦技": "magicArt",
    "戦技": "art",
    "専用戦技": "exclusiveArt",
}
# 兵種スキルのうち、効果文に「戦技」と書かれていないが戦技として扱うもの（SKILL_LOADOUT_RULES §4）
CLASS_ART_NAMES = {"突撃", "ブレス"}


def read_csv(name):
    with open(SRC / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f))


def clean(text):
    return re.sub(r"\s+", "", text or "").replace("＋", "+").replace("－", "-").replace("−", "-")


def parse_stat_bonus(desc):
    """「自分の力・魔攻+10」「魅力+5、魔攻+5」のような無条件の能力値上昇だけを読む。
    条件付き（〜時、〜いると）や能力値以外（命中など）を含む文は None。"""
    text = clean(desc)
    if not text:
        return None
    bonus = {}
    for clause in re.split(r"[、,]", text):
        m = re.fullmatch(r"(?:自分の|自身の)?((?:HP|力|魔攻|防御|魔防|技|速さ|魅力)(?:・(?:HP|力|魔攻|防御|魔防|技|速さ|魅力))*)\+(\d+)", clause)
        if not m:
            return None
        for label in m.group(1).split("・"):
            bonus[STAT_KEYS[label]] = bonus.get(STAT_KEYS[label], 0) + int(m.group(2))
    return bonus or None


def split_name_desc(cell):
    """兵種スキルの「名前(説明)」を分ける。括弧がなければ名前そのものが効果。"""
    text = (cell or "").strip()
    if not text:
        return None
    m = re.fullmatch(r"(.+?)[(（](.*)[)）]", text, re.S)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return text, text


def build_class_lines():
    rows = read_csv("各キャラ兵種表 - 兵種スキル.csv")
    header = rows[0]
    lines = {}
    for row in rows[1:]:
        if len(row) < 8 or not row[3]:
            continue
        slot = row[3]
        entries = []
        for col, need in ((4, 5), (5, 10), (6, 15), (7, "master")):
            parsed = split_name_desc(row[col])
            if not parsed:
                entries.append(None)
                continue
            name, desc = parsed
            is_art = name in CLASS_ART_NAMES or "戦技" in desc
            entries.append({
                "name": name,
                "desc": desc,
                "need": need,
                "kind": "art" if is_art else "skill",
                "statBonus": None if is_art else parse_stat_bonus(desc),
            })
        lines[slot] = {
            "family": row[0], "tier": row[1], "branch": row[2],
            "skills": entries,
        }
    return lines


def build_character_classes():
    rows = read_csv("各キャラ兵種表 - 各キャラ兵種適正.csv")
    chars = {}
    for row in rows[1:]:
        if len(row) < 7 or not row[4] or row[0].startswith("◎") or row[0].startswith("★"):
            continue
        raw_name = row[5]
        display = re.sub(r"[(（].*?[)）]", "", raw_name).replace("◎", "").replace("★", "").strip()
        chars.setdefault(row[0], []).append({
            "slot": row[4],
            "name": display,
            "aptitude": row[6],
            "initial": "◎" in raw_name,
            "recommended": "★" in raw_name,
            "selfAccess": row[7] if len(row) > 7 else "",
        })
    return chars


def build_cause_table():
    rows = read_csv("各キャラ兵種表 - 因果スキル_戦技.csv")
    header = rows[0]
    table = {}
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        entry = {"personal": None, "abilities": []}
        for col, cell in enumerate(row[1:], start=1):
            m = re.match(r"(.+?)\n種類[：:](.+?)\n効果[：:](.*)", cell.strip(), re.S)
            if not m:
                continue
            name = m.group(1).strip().replace("(戦技)", "").replace("（戦技）", "")
            kind = KIND_BY_LABEL.get(m.group(2).strip(), "skill")
            desc = re.sub(r"\s+", "", m.group(3)).removeprefix("効果：")
            item = {"name": name, "kind": kind, "desc": desc}
            if header[col] == "個人スキル":
                entry["personal"] = item
                continue
            level = int(re.search(r"\d+", header[col]).group())
            item["level"] = level
            item["statBonus"] = parse_stat_bonus(desc) if kind == "skill" else None
            entry["abilities"].append(item)
        table[row[0]] = entry
    return table


def main():
    data = {
        "classLines": build_class_lines(),
        "characterClasses": build_character_classes(),
        "causeTable": build_cause_table(),
    }
    body = json.dumps(data, ensure_ascii=False, indent=2)
    OUT.write_text(
        "// =====================================================================\n"
        "//  abilityData.js ― 兵種・スキル・戦技のデータ（自動生成・純粋データ）\n"
        "//\n"
        "//  tools/build_ability_data.py が兵種表CSVから作る。手で直さないこと。\n"
        "//  正本: Regarding character growth rates, skills, and combat arts/*.csv\n"
        "//  kind: skill / physicalArt / magicArt / art（物理・魔法の区別なし）/ exclusiveArt（専用戦技）\n"
        "//  statBonus: 無条件の能力値上昇だけを読み取ったもの。条件付きの効果は null\n"
        "// =====================================================================\n\n"
        f"const ABILITY_DATA = Object.freeze({body});\n\n"
        "if (typeof module !== \"undefined\") {\n"
        "    module.exports = { ABILITY_DATA };\n"
        "}\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

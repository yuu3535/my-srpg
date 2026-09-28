"""
シナリオの表（Excel）を、Unity版が読むデータ（JSON）と、ブロックの一覧（マップ担当が「どこで流れるか」を書くための表）にする。
計画: docs/30-planning/PROLOGUE_1_1_UNITY_PLAN_2026-09-28.md（段1）

使い方:
    py -3.12 tools/import_scenario.py <表.xlsx> <シート名> <シナリオのid> [--split 行番号 ...]
    例: py -3.12 tools/import_scenario.py "シナリオ集/シナリオブラッシュアップ/第1章プロローグ｜シナリオ執筆用.xlsx" シナリオプロローグ1-1 prologue_1_1 --split 9

--split: その行（Excel の行番号）から、次のブロックの手前までを別のブロックにする（例: 剣立てを調べたときだけ流す行）。
         id は分けたブロックの id に _r行番号 を付ける（prologue_1_1.b02_r09）。ほかのブロックの id はずれない。
         プロローグ1-1 は --split 9（マップ担当 2026-09-28: 自室の剣立てを調べたときに流す）

表の列（1行目の見出しで探す）: No・シーン・パート・話者・表情・本文・台詞・区分・演出・備考・ゲーム処理・背景

分け方:
- ブロック: 続けて流れる台詞のまとまり。シーン・区分・パート・背景（場所）が変わったら、新しいブロックにする。
  id は <シナリオのid>.b01 から順に付ける。寄り道のブロックは、マップの配置表で「どの人・どの範囲で流れるか」をこの id で指す。
- 行の種類: line（話者の台詞）/ narration（話者なし・場面説明）/ phone（携帯端末）/ memo（本文がなく演出・備考だけの行や、【】だけの目印。ゲームでは出さない）
- アイテム入手: 本文か演出・備考に「「○○」を手に入れた」「「○○」を…アイテムに入れた」があれば item に○○を入れる
- 表を直したら、このコマンドを実行し直す。表そのものは書き換えない。

出力:
    unity-prototype/Assets/Data/Scenario/<id>.json
    docs/30-planning/scenario/<id>_blocks.md（ブロックの一覧と、表の気になる所）
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
PARTS = {"シナリオ": "story", "寄り道": "sidetrack", "戦闘": "battle"}
ITEM_PATTERNS = [re.compile(r"「([^」]+)」を手に入れた"), re.compile(r"「([^」]+)」を[^。]*アイテムに入れた")]


def cell(row, headers, name):
    i = headers.get(name)
    if i is None or i >= len(row):
        return ""
    v = row[i]
    return "" if v is None else str(v).strip()


def find_item(*texts):
    for t in texts:
        for p in ITEM_PATTERNS:
            m = p.search(t or "")
            if m:
                return m.group(1)
    return ""


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return
    src, sheet, scenario_id = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    splits = {int(a) for a in sys.argv[5:]} if len(sys.argv) > 5 and sys.argv[4] == "--split" else set()
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    rows = list(wb[sheet].iter_rows(values_only=True))
    headers = {str(v).strip(): i for i, v in enumerate(rows[0]) if v is not None}
    need = ["シーン", "パート", "話者", "表情", "本文・台詞", "区分", "演出・備考", "ゲーム処理", "背景"]
    missing = [n for n in need if n not in headers]
    if missing:
        raise SystemExit(f"見出しが見つからない: {missing}")

    blocks, warnings = [], []
    current = None
    scene, location = "", ""
    for index, row in enumerate(rows[1:], start=2):   # Excel の行番号
        get = lambda name: cell(row, headers, name)
        text, note, process = get("本文・台詞"), get("演出・備考"), get("ゲーム処理")
        if not any([text, note, process, get("シーン"), get("区分"), get("話者")]):
            continue
        part_ja = get("パート")
        part = PARTS.get(part_ja, "")
        if part_ja and not part:
            warnings.append(f"{index}行目: パート「{part_ja}」は知らない値（シナリオ／寄り道／戦闘）")
        new_scene, label, background = get("シーン"), get("区分"), get("背景")
        if new_scene and new_scene != scene:
            scene = new_scene
        if background:
            location = background
        start_new = (current is None or bool(new_scene) or (label and label != current["label"])
                     or (part and part != current["part"]) or (background and background != current["location"]))
        numbered = [b for b in blocks if "_r" not in b["id"]]
        if not start_new and index in splits:
            # 分ける行: 前のブロックの id に _r行番号 を付けた別のブロック（同じパート・場所）
            base = numbered[-1]["id"] if numbered else f"{scenario_id}.b00"
            current = dict(current, id=f"{base}_r{index:02d}", row=index, lines=[], label=current["label"], process=process, note=note)
            blocks.append(current)
        elif start_new:
            current = {
                "id": f"{scenario_id}.b{len(numbered) + 1:02d}",
                "part": part or (current["part"] if current else "story"),
                "scene": scene, "label": label, "location": location,
                "process": process, "note": note, "row": index, "lines": [],
            }
            blocks.append(current)
        speaker = get("話者")
        # 【チュートリアル開始】のような【】だけの行は、画面に出さない目印（制作メモ）
        marker = bool(re.fullmatch(r"【[^】]*】", text))
        kind = ("memo" if not text or marker else "phone" if "携帯端末" in speaker else "line" if speaker else "narration")
        line = {
            "row": index, "type": kind,
            "speaker": speaker.strip("()（）"), "expression": get("表情"),
            "text": text, "note": note, "process": process,
            "item": find_item(text, note),
        }
        current["lines"].append(line)
        if not part_ja and text:
            warnings.append(f"{index}行目: パートが空（前の行のまとまりに入れた）")

    # 表の気になる所: 最初のブロックが「戦闘」なのに、場面は自室（入力の間違いかもしれない）
    for b in blocks:
        if b["part"] == "battle" and "訓練場" not in (b["location"] or "") and b["lines"] and any(l["type"] != "memo" for l in b["lines"]):
            warnings.append(f"{b['row']}行目: パートが「戦闘」だが、場所は「{b['location']}」（「シナリオ」の書き間違い？）")

    data = {"id": scenario_id, "source": f"{src.as_posix()} / {sheet}", "blocks": blocks}
    out = ROOT / "unity-prototype" / "Assets" / "Data" / "Scenario" / f"{scenario_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    md = [f"# シナリオのブロック一覧（{scenario_id}）", "",
          f"作った道具: `tools/import_scenario.py`（表 `{src.as_posix()}` のシート「{sheet}」から自動で作った。表を直したら作り直す）", "",
          "寄り道のブロックは、マップの配置表で「どの人に話しかけたら・どの範囲に近づいたら流れるか」を、この id で指す。", "",
          "| id | パート | シーン | 区分 | 場所 | 行 | 最初の台詞 | ゲーム処理 |", "|---|---|---|---|---|---|---|---|"]
    part_ja = {v: k for k, v in PARTS.items()}
    for b in blocks:
        first = next((l for l in b["lines"] if l["type"] != "memo"), None)
        head = "" if first is None else (f"{first['speaker']}「" if first["speaker"] else "") + first["text"].replace("\n", " ")[:28] + ("」" if first and first["speaker"] else "")
        items = [l["item"] for l in b["lines"] if l["item"]]
        head += f"（入手: {'・'.join(items)}）" if items else ""
        md.append(f"| `{b['id']}` | {part_ja.get(b['part'], b['part'])} | {b['scene']} | {b['label']} | {b['location']} | {b['row']} | {head} | {b['process']} |")
    if warnings:
        md += ["", "## 表の気になる所（原作者に確認）", ""] + [f"- {w}" for w in warnings]
    doc = ROOT / "docs" / "30-planning" / "scenario" / f"{scenario_id}_blocks.md"
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text("\n".join(md) + "\n", encoding="utf-8")
    lines = sum(len(b["lines"]) for b in blocks)
    print(f"{out.relative_to(ROOT).as_posix()}（ブロック {len(blocks)}・行 {lines}）")
    print(doc.relative_to(ROOT).as_posix())
    for w in warnings:
        print("注意:", w)


if __name__ == "__main__":
    main()

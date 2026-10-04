"""
マップの配置表（JSON）から、ChatGPT へ渡す下絵・床の発注書を作り、届いた床の1枚絵を Unity へ取り込む。
作り方の標準: docs/10-design/map/MAP_ART_PIPELINE_v1_2026-09-28.md（§4 配置表・§5 依頼文・§6 ツール）

使い方:
    py -3.12 tools/map_layout.py guide  <配置表.json>             # 下絵（正方形）を作る
    py -3.12 tools/map_layout.py order  <配置表.json>             # 床の1枚絵の発注書（依頼文つき）を作る
    py -3.12 tools/map_layout.py import <配置表.json> <届いた絵>   # 余白を切り、1マス64pxにして Unity へ
    py -3.12 tools/map_layout.py from-guide <下絵.png> <mapId> <名前>  # 前の下絵（1マス40px）から配置表を起こす
    py -3.12 tools/map_layout.py unity  <配置表.json> [...]        # Unity が読む形（Assets/Data/Maps/<mapId>.json）と仮の床（下絵）を書き出す

配置表（docs/10-design/map/layouts/<mapId>.json）:
    {
      "mapId": "watchroad", "name": "国境監視路", "indoor": false, "timeOfDay": "day",
      "description": "国境の古い監視路。手入れされなくなって自然に戻りかけている",
      "mood": "明るい昼。…",
      "terrain": ["ttss…", …],             # 場所の全体（1マス1文字。上が北）。探索でも戦闘でも使う
      "battleAreas": [{"id": "main", "x": 10, "y": 10, "w": 12, "h": 8}],   # 戦闘でマス目を出す範囲
      "padTerrain": "t",                    # 正方形にするときに足す余白の地形
      "legend": {"x": {"name": "…", "color": [r,g,b], "colorName": "…", "describe": "…"}}   # 足したい記号・上書き（省略可）
    }

出力:
    マップチップ/<mapId>/<mapId>_guide_square.png   … ChatGPT に渡す下絵（正方形・1マス40px・戦う範囲に赤い線）
    docs/10-design/map/graybox/<mapId>_topdown_guide.png … 余白なしの下絵（記録用）
    マップチップ/<mapId>/<mapId>_床の発注書.md       … 依頼文つき
    unity-prototype/Assets/Art/Board3D/Ground/<mapId>_ground.png … 取り込んだ床の1枚絵（元の絵は書き換えない）
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GUIDE_CELL, GROUND_CELL, MAX_CELLS = 40, 64, 32
RED = (220, 40, 40)

# 記号ごとの色と、依頼文に書く言葉（屋外の色は Unity の下絵 Board3DTestBuilder.GuideColors と同じ）
DEFAULT_LEGEND = {
    "s": {"name": "旧石畳", "color": [150, 146, 138], "colorName": "灰色", "describe": "古い石畳の道（暖かい灰色の四角い石、ところどころ欠けや補修、目地に苔）"},
    "d": {"name": "土道", "color": [176, 132, 84], "colorName": "茶色", "describe": "踏み固めた土の道（轍と小石）"},
    "g": {"name": "草・苔", "color": [104, 156, 72], "colorName": "明るい緑", "describe": "草原（短い草と小さな葉、ところどころ土がのぞく）"},
    "=": {"name": "橋", "color": [128, 88, 52], "colorName": "焦げ茶", "describe": "木の橋の板（上から見た板）"},
    "~": {"name": "水", "color": [48, 96, 150], "colorName": "青", "describe": "深い青緑の水面。岸は石積み"},
    "o": {"name": "瓦礫", "color": [120, 110, 96], "colorName": "灰茶", "describe": "崩れた石のかけらが散らばる地面"},
    "#": {"name": "石の基礎・壁の上面", "color": [90, 86, 84], "colorName": "暗い灰色", "describe": "崩れた砦の壁・石の基礎の上面（大きな四角い石）"},
    "t": {"name": "森・茂み", "color": [40, 84, 48], "colorName": "深い緑", "describe": "森の地面（落ち葉・シダ・下草の多い暗めの地面）。木はゲーム側で立てるので、根元のまわりの地面だけ"},
    "c": {"name": "岩場", "color": [110, 104, 100], "colorName": "灰色の点々", "describe": "ごつごつした灰色の岩の上面"},
    # 屋内（MAP_ART_PIPELINE_v1 §7 の案。マップ担当が決める）
    "f": {"name": "石の床", "color": [168, 160, 150], "colorName": "明るい灰色", "describe": "城の石の床（大きな切り石を敷きつめた床）"},
    "r": {"name": "絨毯", "color": [150, 40, 52], "colorName": "赤", "describe": "床に敷いた絨毯（縁取りの模様つき）"},
    "a": {"name": "砂の稽古場", "color": [214, 190, 140], "colorName": "砂色", "describe": "砂を撒いた稽古場の地面（足跡や擦れ跡）"},
    "+": {"name": "一段高い台", "color": [196, 176, 120], "colorName": "黄土色", "describe": "一段高くした石の台の上面（玉座の台・演台）"},
    "W": {"name": "壁", "color": [60, 52, 64], "colorName": "黒に近い紫", "describe": "壁が立つ所。壁はゲーム側で立てるので、足元の床だけ（壁ぎわの影は描かない）"},
    "P": {"name": "柱", "color": [96, 80, 110], "colorName": "くすんだ紫", "describe": "柱が立つ所。柱はゲーム側で立てるので、柱の台座のまわりの床だけ"},
    "D": {"name": "扉", "color": [200, 140, 60], "colorName": "橙", "describe": "出入口の床（敷居）。扉そのものは描かない"},
}


def load(path):
    layout = json.loads(Path(path).read_text(encoding="utf-8"))
    legend = {k: dict(v) for k, v in DEFAULT_LEGEND.items()}
    for k, v in (layout.get("legend") or {}).items():
        legend.setdefault(k, {}).update(v)
    layout["_legend"] = legend
    rows = layout["terrain"]
    width = max(len(r) for r in rows)
    layout["terrain"] = [r.ljust(width, layout.get("padTerrain", "t")) for r in rows]
    return layout


def square_padding(layout):
    """正方形にするときの上下左右の余白（マス）"""
    rows, cols = len(layout["terrain"]), len(layout["terrain"][0])
    side = max(rows, cols)
    top = (side - rows) // 2
    left = (side - cols) // 2
    return side, top, side - rows - top, left, side - cols - left


def draw(layout, pad):
    legend = layout["_legend"]
    rows, cols = len(layout["terrain"]), len(layout["terrain"][0])
    side, top, bottom, left, right = square_padding(layout) if pad else (0, 0, 0, 0, 0)
    width, height = (cols + left + right), (rows + top + bottom)
    image = Image.new("RGB", (width * GUIDE_CELL, height * GUIDE_CELL))
    dr = ImageDraw.Draw(image)
    fill = layout.get("padTerrain", "t")
    unknown = set()
    for y in range(height):
        for x in range(width):
            r, c = y - top, x - left
            ch = layout["terrain"][r][c] if 0 <= r < rows and 0 <= c < cols else fill
            if ch not in legend:
                unknown.add(ch)
                color = (255, 0, 255)
            else:
                color = tuple(legend[ch]["color"])
            dr.rectangle((x * GUIDE_CELL, y * GUIDE_CELL, (x + 1) * GUIDE_CELL - 1, (y + 1) * GUIDE_CELL - 1), fill=color)
    for area in layout.get("battleAreas", []):
        x0, y0 = (area["x"] + left) * GUIDE_CELL, (area["y"] + top) * GUIDE_CELL
        x1, y1 = x0 + area["w"] * GUIDE_CELL, y0 + area["h"] * GUIDE_CELL
        for k in range(2):   # 赤い線 2px（戦う範囲の内側）
            dr.rectangle((x0 + k, y0 + k, x1 - 1 - k, y1 - 1 - k), outline=RED)
    if unknown:
        print(f"注意: 色の決まっていない記号 {sorted(unknown)}（マゼンタで塗った）。配置表の legend に足す")
    return image


def guide(path):
    layout = load(path)
    map_id = layout["mapId"]
    rows, cols = len(layout["terrain"]), len(layout["terrain"][0])
    if max(rows, cols) > MAX_CELLS:
        print(f"注意: {cols}×{rows} マスは1枚で頼める広さ（{MAX_CELLS}マス）を超える。区画に分けて配置表を作る（作り方 §2）")
    out_dir = ROOT / "マップチップ" / map_id
    out_dir.mkdir(parents=True, exist_ok=True)
    square = out_dir / f"{map_id}_guide_square.png"
    draw(layout, True).save(square)
    plain = ROOT / "docs" / "10-design" / "map" / "graybox" / f"{map_id}_topdown_guide.png"
    picture = draw(layout, False)
    # 絵が同じなら書かない（Git に中身の同じ変更を出さない）
    if not plain.exists() or Image.open(plain).convert("RGB").tobytes() != picture.tobytes():
        picture.save(plain)
    side, top, bottom, left, right = square_padding(layout)
    print(f"{square.relative_to(ROOT).as_posix()}（{side}×{side}マス。余白 上{top}・下{bottom}・左{left}・右{right}）")
    print(plain.relative_to(ROOT).as_posix())


def order(path):
    layout = load(path)
    map_id, legend = layout["mapId"], layout["_legend"]
    used = []
    for row in layout["terrain"]:
        for ch in row:
            if ch not in used:
                used.append(ch)
    fill = layout.get("padTerrain", "t")
    if fill not in used:
        used.append(fill)
    side, top, bottom, left, right = square_padding(layout)
    colors = "\n".join(f"- {legend[ch]['colorName']}: {legend[ch]['describe']}" for ch in used if ch in legend)
    pads = "・".join(f"{n}の端の{v}マス分" for n, v in (("上", top), ("下", bottom), ("左", left), ("右", right)) if v > 0)
    pad_note = f"- 配置図の{pads}は余白です。ゲームでは切り落とすので、まわりの続きを描けば大丈夫です。\n" if pads else ""
    areas = layout.get("battleAreas", [])
    area_note = "- 赤い線の中は、戦闘でマス目を出す範囲です（絵の描き方はほかと同じ）。\n" if areas else ""
    text = f"""# 床の1枚絵 発注書（{layout['name']}・ChatGPT向け）

作った道具: `tools/map_layout.py order`（配置表 `{Path(path).as_posix()}` から自動で作った。直すときは配置表を直して作り直す）
作り方の標準: `docs/10-design/map/MAP_ART_PIPELINE_v1_2026-09-28.md`

## 渡すもの

1. 配置図: `マップチップ/{map_id}/{map_id}_guide_square.png`（{side}×{side}マス・1マス40px）
2. 画風の見本: 国境監視路の地面のブラッシュアップ版（`マップチップ/ground_order/270a8311-718d-4d80-a2bd-c92d3f6d86dd.png`）
3. 雰囲気の見本（あれば）: {layout.get('moodReference', 'なし')}

## 依頼文（コピーしてそのまま渡す）

```
添付の配置図のとおりに、ゲームのマップの「床」を、真上から見た1枚の絵として描いてください。
場所: {layout['name']}。{layout.get('description', '')}

【絵の形】
- 真上から真下を見下ろした絵（遠近・傾きなし）。正方形。配置図と同じ位置関係で描く。
- 配置図は1マス＝40pxの格子で、色が床の種類を表しています。色の境目は、なるべく配置図どおりに（ずれてもマスの1/4まで）。
{pad_note}{area_note}- マス目の線、文字、記号、キャラクター、UIは描かない。
- 壁・柱・扉・家具・木などの「高さのある物」は描かない（ゲーム側で立体の物を置きます）。そういう物が立つ所は、その足元の床だけを描く。
- 強い影や、特定の方向から当たる光の筋は描かない（光と影はゲーム側で付けます）。明るさのゆるやかなムラ程度はよい。

【色の意味】
{colors}

【雰囲気】
- {layout.get('mood', '（雰囲気を書く）')}
- 塗りは、添付の見本の地面の絵と同じ細かさ・同じ画風の、手描き風のゲーム背景。

【大きさ】
- できるだけ大きく（正方形）。
```

## 届いたら（総合担当）

```
py -3.12 tools/map_layout.py import {Path(path).as_posix()} マップチップ/{map_id}/<届いた絵>.png
```
"""
    out = ROOT / "マップチップ" / map_id / f"{map_id}_床の発注書.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(out.relative_to(ROOT).as_posix())


def import_ground(path, picture):
    layout = load(path)
    rows, cols = len(layout["terrain"]), len(layout["terrain"][0])
    side, top, bottom, left, right = square_padding(layout)
    image = Image.open(picture).convert("RGB")
    w, h = image.size
    box = (round(w * left / side), round(h * top / side), round(w * (side - right) / side), round(h * (side - bottom) / side))
    image = image.crop(box).resize((cols * GROUND_CELL, rows * GROUND_CELL), Image.LANCZOS)
    out = ROOT / "unity-prototype" / "Assets" / "Art" / "Board3D" / "Ground" / f"{layout['mapId']}_ground.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, optimize=True)
    print(f"{picture} -> {out.relative_to(ROOT).as_posix()} {image.size}")


def from_guide(picture, map_id, name):
    image = Image.open(picture).convert("RGB")
    cols, rows = image.width // GUIDE_CELL, image.height // GUIDE_CELL
    by_color = {tuple(v["color"]): k for k, v in DEFAULT_LEGEND.items()}
    terrain = []
    for r in range(rows):
        line = ""
        for c in range(cols):
            # マスの中ほど（赤い線を避ける）の色
            color = image.getpixel((c * GUIDE_CELL + GUIDE_CELL // 2, r * GUIDE_CELL + GUIDE_CELL // 2))
            line += by_color.get(color, "?")
        terrain.append(line)
    layout = {"mapId": map_id, "name": name, "indoor": False, "timeOfDay": "day", "description": "", "mood": "",
              "terrain": terrain, "battleAreas": [], "padTerrain": "t"}
    print(json.dumps(layout, ensure_ascii=False, indent=2))


def cells_of(v):
    """[[x, y], ...] / [x, y] / {x, y} を [{x, y}, ...] にする"""
    if v is None:
        return []
    if isinstance(v, dict):
        return [{"x": v["x"], "y": v["y"]}]
    if v and isinstance(v[0], (int, float)):
        return [{"x": int(v[0]), "y": int(v[1])}]
    return [{"x": int(c[0]), "y": int(c[1])} for c in v]


def area_of(v):
    return {"x": v.get("x", 0), "y": v.get("y", 0), "w": v.get("w", 1), "h": v.get("h", 1)} if v else {"x": 0, "y": 0, "w": 0, "h": 0}


def person_of(v):
    if not v:
        return None
    cell = cells_of(v.get("cell"))
    c = cell[0] if cell else {"x": 0, "y": 0}
    return {"id": v.get("id", ""), "name": v.get("name", ""), "facing": v.get("facing") or "", "talkBlock": v.get("talkBlock") or "", "x": c["x"], "y": c["y"]}


def inspect_of(v):
    cells = cells_of(v.get("cells")) or cells_of(v.get("cell"))
    return {"id": v.get("id", ""), "block": v.get("block") or "", "text": clean_text(v.get("text")), "cells": cells, "required": bool(v.get("required")),
            "label": clean_text(v.get("label") or v.get("kind"))}


def clean_text(text):
    """画面に出す文言から、作業用のメモを外す（レビュー 2026-09-28 J9）: 「（案）」、括弧の中の注意書き（…後で・見直す・当面…）"""
    import re
    text = (text or "").replace("（案）", "").strip()
    return re.sub(r"（[^）]*）", "", text).strip()


def to_unity(path):
    """配置表を Unity の JsonUtility で読める形にする（入れ子の配列・記号の辞書をやめ、マスは {x, y} に）"""
    layout = load(path)
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    map_id = layout["mapId"]
    rows, cols = len(layout["terrain"]), len(layout["terrain"][0])
    symbols = []
    for ch, v in (raw.get("legend") or {}).items():
        rules = ",".join(f"{k}={int(v[k]) if isinstance(v[k], bool) else v[k]}" for k in ("walk", "flyEnter", "flyStop", "height") if k in v)
        symbols.append({"symbol": ch, "name": v.get("name", ""), "color": v.get("color", []), "rules": rules})
    ex = raw.get("exploration") or {}
    objects = [{"id": o.get("id", ""), "kind": o.get("kind", ""), "cells": cells_of(o.get("cells")), "blocks": bool(o.get("blocks")),
                "height": float(o.get("height", 0))} for o in ex.get("objects", [])]
    props = []
    for pr in ex.get("props", []):
        c = cells_of(pr.get("cell"))
        if c:
            props.append({"id": pr.get("id", ""), "kind": pr.get("kind", ""), "edge": pr.get("edge") or "center", "x": c[0]["x"], "y": c[0]["y"]})
    lights = []
    for li in ex.get("lights", []):
        c = cells_of(li.get("cell"))
        if c:
            lights.append({"kind": li.get("kind", ""), "color": li.get("color") or "warm", "x": c[0]["x"], "y": c[0]["y"]})
    exits = []
    for e in ex.get("exits", []):
        to = e.get("to") or {}
        target = cells_of(to.get("cell")) if to else []
        exits.append({"id": e.get("id", ""), "label": clean_text(e.get("label", "")), "lockedText": e.get("lockedText") or "",
                      "toMap": to.get("map") or "", "facing": to.get("facing") or "",
                      "cells": cells_of(e.get("cells")), "hasTarget": bool(target), "toCell": target[0] if target else {"x": 0, "y": 0},
                      "requires": e.get("requires") or []})
    states = []
    for st in ex.get("states", []):
        goals = []
        for g in st.get("goals", []):
            then = g.get("then") or {}
            goals.append({"id": g.get("id", ""), "exit": g.get("exit") or "", "block": g.get("block") or "",
                          "thenBattleArea": then.get("battleArea") or "", "thenBlock": then.get("block") or "", "cells": cells_of(g.get("cells")),
                          # 着いたら、このマスまで歩いてから会話（イベントの場面の位置。原作者 2026-10-05）
                          "talkAt": {"x": g["talkAt"]["cell"][0], "y": g["talkAt"]["cell"][1]} if g.get("talkAt") else {"x": 0, "y": 0},
                          "hasTalkAt": bool(g.get("talkAt"))})
        talks = []
        for t in st.get("talkAreas", []):
            a = area_of(t.get("area"))
            talks.append({"id": t.get("id", ""), "block": t.get("block") or "", "trigger": t.get("trigger") or "", **a,
                          "required": bool(t.get("required")), "ambient": bool(t.get("ambient")), "once": bool(t.get("once", True))})
        states.append({"id": st.get("id", ""), "scene": st.get("scene", ""), "player": person_of(st.get("player")),
                       "onEnter": st.get("onEnter") or [], "people": [person_of(p) for p in st.get("people", [])],
                       "talkAreas": talks, "inspect": [inspect_of(i) for i in st.get("inspect", [])], "goals": goals,
                       # 入ったときの会話のあと、2Dの場所へ移る（戦闘の場所から2Dの探索へ戻る。2026-10-04）
                       "thenPlace2D": (st.get("then2D") or {}).get("place") or "", "thenState2D": (st.get("then2D") or {}).get("state") or ""})
    data = {"mapId": map_id, "name": layout["name"], "indoor": bool(layout.get("indoor")), "timeOfDay": layout.get("timeOfDay") or "day",
            "columns": cols, "rows": rows, "terrain": layout["terrain"], "symbols": symbols,
            "battleAreas": [{"id": b.get("id", ""), "battleId": b.get("battleId") or "", "x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]}
                            for b in layout.get("battleAreas", [])],
            "objects": objects, "props": props, "lights": lights, "exits": exits, "states": states,
            "inspect": [inspect_of(i) for i in (raw.get("inspect") or ex.get("inspect") or [])]}
    out = ROOT / "unity-prototype" / "Assets" / "Data" / "Maps" / f"{map_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if not out.exists() or out.read_text(encoding="utf-8") != text:
        out.write_text(text, encoding="utf-8")
    # 仮の床: 余白なしの下絵（床の絵が届いて import したら <mapId>_ground.png が使われる）
    ground = ROOT / "unity-prototype" / "Assets" / "Art" / "Board3D" / "Ground" / f"{map_id}_guide.png"
    picture = draw(layout, False)
    if not ground.exists() or Image.open(ground).convert("RGB").tobytes() != picture.tobytes():
        picture.save(ground)
    print(f"{out.relative_to(ROOT).as_posix()}（{cols}×{rows}・物 {len(objects)}・出口 {len(exits)}・場面 {len(states)}）")


def main():
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "guide":
        guide(args[1])
    elif len(args) == 2 and args[0] == "order":
        order(args[1])
    elif len(args) == 3 and args[0] == "import":
        import_ground(args[1], args[2])
    elif len(args) >= 2 and args[0] == "unity":
        for path in args[1:]:
            to_unity(path)
    elif len(args) == 4 and args[0] == "from-guide":
        from_guide(args[1], args[2], args[3])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

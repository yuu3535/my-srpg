"""
シナリオの正本（Google スプレッドシート）を読み書きする道具（テキスト修正の担当・総合担当が使う）。

鍵: サービスアカウント scenario-writer@srpg-scenario.iam.gserviceaccount.com の JSON 鍵。
    既定の場所は C:\\Users\\<ユーザー>\\.srpg\\scenario-writer.json（ゲームのフォルダの外。Git に入れない）。
    別の場所なら環境変数 SRPG_SHEET_KEY に書く。正本はこのアカウントに「編集者」で共有してある（原作者 2026-11-16）。
準備: py -3.12 -m pip install gspread

使い方:
    py -3.12 tools/scenario_sheet.py check
        正本のシートの一覧を出す（読み書きできるかの確認）
    py -3.12 tools/scenario_sheet.py apply <直しの.json> [--dry-run]
        直しを正本に入れる。直しの JSON:
        {"sheet": "シナリオプロローグ1-1 (1)",
         "edits": [{"row": 10, "old": "今の本文", "texts": ["1つ目の台詞", "2つ目の台詞（行を足す）"]}, ...]}
        - row は今の正本の行番号。old が今の「本文・台詞」と違えば、何も書かずに止まる（原作者が先に直した所を消さない）。
        - texts が2つ以上なら、その行の下に行を足す。足した行には パート・話者・表情・背景 を写し、書式は上の行を引き継ぐ。
        - 下の行から順に入れるので、行番号は「直す前の正本」の番号のままでよい。
"""
import json
import os
import sys
from pathlib import Path

SHEET_ID = "1MzI1us5Mfdp4lCb06yfnH9Roof0pFKvFGsJQGygHW8M"   # 第1章プロローグ｜シナリオ執筆用
KEY = Path(os.environ.get("SRPG_SHEET_KEY", Path.home() / ".srpg" / "scenario-writer.json"))
COLUMNS = ["No", "シーン", "パート", "話者", "表情", "本文・台詞", "区分", "演出・備考", "ゲーム処理", "背景"]
COPY = ["パート", "話者", "表情", "背景"]   # 足した行に写す列


def open_book():
    import gspread
    if not KEY.exists():
        raise SystemExit(f"鍵が見つからない: {KEY}")
    return gspread.service_account(filename=str(KEY)).open_by_key(SHEET_ID)


def col_letter(i):
    return chr(ord("A") + i)


def apply(plan_path, dry_run):
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    ws = open_book().worksheet(plan["sheet"])
    values = ws.get_all_values()
    head = {name: i for i, name in enumerate(values[0])}
    missing = [c for c in COLUMNS if c not in head]
    if missing:
        raise SystemExit(f"見出しが見つからない: {missing}")
    body = head["本文・台詞"]
    cell = lambda r, c: values[r - 1][c] if r - 1 < len(values) and c < len(values[r - 1]) else ""

    # 先に全部を確かめる（1つでも違えば何も書かない）
    stale = [e["row"] for e in plan["edits"] if cell(e["row"], body) != e["old"]]
    if stale:
        raise SystemExit(f"正本の本文が、直しを作ったときと違う行がある（先に読み直す）: {stale}")
    added = sum(len(e["texts"]) - 1 for e in plan["edits"])
    print(f"{plan['sheet']}: {len(plan['edits'])} 行を直し、{added} 行を足す" + ("（--dry-run なので書かない）" if dry_run else ""))
    if dry_run:
        return

    for e in sorted(plan["edits"], key=lambda e: e["row"], reverse=True):
        r, texts = e["row"], e["texts"]
        if len(texts) > 1:
            # 上の行の書式を引き継いで行を足す
            ws.spreadsheet.batch_update({"requests": [{"insertDimension": {
                "range": {"sheetId": ws.id, "dimension": "ROWS", "startIndex": r, "endIndex": r + len(texts) - 1},
                "inheritFromBefore": True}}]})
        updates = [{"range": f"{col_letter(body)}{r}", "values": [[texts[0]]]}]
        for k, t in enumerate(texts[1:], start=1):
            for name in COPY:
                v = cell(r, head[name])
                if v:
                    updates.append({"range": f"{col_letter(head[name])}{r + k}", "values": [[v]]})
            updates.append({"range": f"{col_letter(body)}{r + k}", "values": [[t]]})
        ws.batch_update(updates, value_input_option="RAW")
    print("入れた")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if not args:
        print(__doc__)
    elif args[0] == "check":
        book = open_book()
        print(book.title)
        for ws in book.worksheets():
            print(f"  {ws.title}（{ws.row_count} 行）")
    elif args[0] == "apply" and len(args) >= 2:
        apply(args[1], "--dry-run" in args)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

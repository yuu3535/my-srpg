"""生成済みの等間隔連番を切り出し、透過を保ってAPNGへ梱包する。

絵の生成・輪郭の描き直し・コマごとの自動トリミングは行わない。
元のシートと既存素材は変更しない。出力先の既存ファイルも上書きしない。
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


DURATIONS = [70, 70, 70, 80, 80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 100, 120, 220]
# 第一稿1254pxシートの火種の下端。絵を描き直さず共通キャンバスに登録する。
# 輪郭全体の中心で整列すると、炎が成長するたび火種が移動してしまう。
BASELINES = [306, 306, 306, 306, 308, 308, 308, 308, 293, 296, 295, 294, 255, 256, 254, 251]


def package(source: Path, output: Path, name: str):
    with Image.open(source) as image:
        if image.mode != "RGBA" or image.getchannel("A").getextrema()[0] != 0:
            raise ValueError("背景が透過したRGBA素材が必要です。背景除去はこのツールで行いません。")
        sheet = image.copy()
    if sheet.size != (1254, 1254):
        raise ValueError("この版の登録座標は第一稿1254×1254専用です。別のシートへ流用しないでください。")
    frame_dir = output / f"{name}-frames"
    apng_path = output / f"{name}.apng"
    manifest_path = output / f"{name}.json"
    if frame_dir.exists() or apng_path.exists() or manifest_path.exists():
        raise FileExistsError("既存の出力は上書きしません。別の版名を指定してください。")
    frames = []
    bounds = []
    # 総画像サイズが4で割り切れない場合も、境界を等間隔の丸めで切る。
    # 内容の重心をコマごとに動かさないことが重要。
    for index in range(16):
        row, column = divmod(index, 4)
        box = tuple(round(value * sheet.width / 4) for value in
                    (column, row, column + 1, row + 1))
        cell = sheet.crop(box)
        # 火種の下端を84%へ、横方向の支点を57%へ固定。
        # 元コマの画素をそのまま移し、最後に全コマ同じ倍率で縮小する。
        registered = Image.new("RGBA", (400, 400))
        offset = (round(400 * .57 - cell.width * .57), round(400 * .84 - BASELINES[index]))
        if offset[0] < 0 or offset[1] < 0 or offset[0] + cell.width > 400 or offset[1] + cell.height > 400:
            raise ValueError("コマが登録キャンバスからはみ出しています。")
        registered.paste(cell, offset)
        frame = registered.resize((192, 192), Image.Resampling.LANCZOS)
        if not frame.getchannel("A").getbbox():
            raise ValueError(f"生成コマ{index + 1}が空です。シートの配置を確認してください。")
        frames.append(frame)
        bounds.append(frame.getchannel("A").point(lambda value: 255 if value > 24 else 0).getbbox())
    # 消火後の間。生成された炎を加工せず、完全透過コマを1枚追加する。
    frames.append(Image.new("RGBA", (192, 192)))
    frame_dir.mkdir(parents=True)
    frame_names = []
    for index, frame in enumerate(frames):
        path = frame_dir / f"{index + 1:02}.png"
        frame.save(path)
        frame_names.append(f"{frame_dir.name}/{path.name}")
    frames[0].save(apng_path, format="PNG", save_all=True, append_images=frames[1:],
                   duration=DURATIONS, loop=0, disposal=0, blend=0, optimize=False)
    # SOURCE置換で残像を出さず、APNGの復号結果を全コマの元PNGと比較する。
    with Image.open(apng_path) as animation:
        assert animation.is_animated and animation.n_frames == 17
        assert animation.info["loop"] == 0
        for index, original in enumerate(frames):
            animation.seek(index)
            assert animation.convert("RGBA").tobytes() == original.tobytes(), index
            assert round(animation.info["duration"]) == DURATIONS[index], index
    manifest = {
        "schema": "solar-flame-apng-preview-v01",
        "status": "試作対象・メニュー未接続",
        "source": source.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "sheetSize": [sheet.width, sheet.height],
        "grid": [4, 4], "size": [192, 192], "registrationCanvas": [400, 400],
        "sourceBaselines": BASELINES, "targetBaseline": 0.84,
        "origin": [0.57, 0.78],
        "apng": apng_path.name,
        "frames": frame_names, "durations": DURATIONS,
        "cycleMs": sum(DURATIONS), "loop": 0,
        "visibleBounds": bounds,
        "note": "生成16コマ＋完全透過1コマ。等間隔切出し・火種下端の登録・全コマ同倍率縮小のみ。描き直しやワープなし。動きの連続性は作者の見本確認待ち。"
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"apng": str(apng_path), "frames": len(frames),
                      "cycleMs": sum(DURATIONS), "bytes": apng_path.stat().st_size,
                      "decodedFramesEqual": True, "visibleBounds": bounds}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--name", default="command-flame-burn-v03")
    args = parser.parse_args()
    if not args.name or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for char in args.name):
        parser.error("版名には英小文字・数字・-・_のみ指定できます。")
    package(args.source.resolve(strict=True), args.output.resolve(), args.name)

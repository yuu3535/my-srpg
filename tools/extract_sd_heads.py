"""原作者指定の元SDから頭部を選択する。再生成・背景推定・再描画をしない。"""
from pathlib import Path
import argparse
import hashlib
import json

from PIL import Image, ImageDraw
import numpy as np

PROJECT = Path(__file__).resolve().parent.parent
INPUT = PROJECT / "立ち絵透過下処理" / "AI_SD"
OUTPUT = PROJECT / "立ち絵透過下処理" / "SD頭部"
# 首と襟・後ろ髪の境界を拡大して指定した選択領域。上側は原透過をそのまま使う。
SPECS = {
    "arshe": {
        "name": "アルシェ", "join": [685, 565],
        "source_sha256": "651449d5efe941cac38a952da24e2bc2a109eeb851fbe3ac263ec46352bc801d",
        "polygon": [[290,40],[955,40],[955,560],[790,560],[750,560],
                    [721,551],[705,547],[699,547],[695,554],[690,562],
                    [686,568],[679,564],[663,557],[646,550],[634,543],
                    [628,542],[622,547],[618,551],[610,557],[600,562],
                    [290,562]],
    },
    "karima": {
        "name": "カリマ", "join": [680, 571],
        "source_sha256": "b88cc96a186d230823fd17473df6d875b6126f0d2274ef4c44fefd3db4dcada5",
        "polygon": [[330,35],[950,35],[950,577],[764,577],[750,574],
                    [739,568],[733,567],[726,570],[717,574],[708,575],
                    [700,570],[694,563],[690,549],[687,558],[685,566],
                    [680,574],[674,569],[657,561],[641,553],[636,549],
                    [632,543],[627,545],[623,551],[620,559],[618,568],
                    [610,573],[600,576],[580,582],[330,582]],
    },
}


def sha256(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def extract():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "マスク").mkdir(exist_ok=True)
    report = {"method": "manual binary selection; original retained RGBA unchanged", "heads": {}}
    for key, spec in SPECS.items():
        source_path = INPUT / f"{spec['name']}.png"
        source_hash = sha256(source_path)
        if source_hash != spec["source_sha256"]:
            raise ValueError(f"原本が変更されています。境界を再確認してください: {source_path}")
        source = Image.open(source_path)
        if source.mode != "RGBA" or source.size != (1254, 1254):
            raise ValueError(f"未確認の原本形式: {source_path}")
        original = np.asarray(source).copy()
        mask = Image.new("L", source.size, 0)
        ImageDraw.Draw(mask).polygon([tuple(point) for point in spec["polygon"]], fill=255)
        selected = np.asarray(mask) == 255
        # 既存Studio消しゴムと同じく、選択外のalphaだけを0へ。色・保持alphaは不変。
        result = original.copy()
        result[~selected, 3] = 0
        assert np.array_equal(result[selected], original[selected])
        assert np.array_equal(result[:, :, :3], original[:, :, :3])
        assert not np.any(result[~selected, 3])
        image = Image.fromarray(result)
        # 薄い原本残留alphaも保持。原寸で切り出し、拡縮・補間は行わない。
        bounds = image.getchannel("A").getbbox()
        head = image.crop(bounds)
        filename = f"{spec['name']}_頭部.png"
        target = OUTPUT / filename
        # 再実行時も元SDは変更しない。同じ指定・原本の頭部候補だけを更新する。
        head.save(target)
        mask.save(OUTPUT / "マスク" / f"{spec['name']}_頭部選択.png")
        loaded = np.asarray(Image.open(target))
        left, top, right, bottom = bounds
        assert np.array_equal(loaded, result[top:bottom, left:right])
        assert sha256(source_path) == source_hash
        report["heads"][key] = {
            "label": spec["name"], "file": filename, "output_sha256": sha256(target),
            "source": str(source_path.relative_to(PROJECT)), "source_sha256": source_hash,
            "source_size": list(source.size), "crop": list(bounds), "size": list(head.size),
            "join_source": spec["join"],
            "join": [spec["join"][0] - left, spec["join"][1] - top],
            "join_status": "provisional; body fitting not checked",
            "selection_polygon": spec["polygon"],
            "pixel_verification": "PASS retained RGBA equal; output equals source selection; source unchanged",
            "visible_pixels": int(np.count_nonzero(result[:, :, 3])),
        }
        # QA用のみ背景合成。頭部PNG自体には背景を追加しない。
        panel = Image.new("RGBA", head.size, "#d6ddd9")
        panel.alpha_composite(head)
        panel.convert("RGB").save(OUTPUT / "確認用" / f"{spec['name']}_頭部確認.jpg")
    (OUTPUT / "head_parts.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    make_preview()
    print(json.dumps({key: item["size"] for key, item in report["heads"].items()}))


def make_preview():
    """比較用だけ縮小。本番の透過PNGには補間をかけない。"""
    preview = Image.new("RGBA", (1000, 470), "#d6ddd9")
    draw = ImageDraw.Draw(preview)
    for index, spec in enumerate(SPECS.values()):
        head = Image.open(OUTPUT / f"{spec['name']}_頭部.png")
        head.thumbnail((460, 425), Image.Resampling.LANCZOS)
        preview.alpha_composite(head, (index * 500 + (500 - head.width) // 2, 25))
        draw.text((index * 500 + 25, 452), list(SPECS)[index].upper(), fill="#253a34")
    preview.convert("RGB").save(OUTPUT / "確認用" / "頭部2人比較.jpg", quality=95)


def verify_outputs():
    """保存結果を読み直す独立検査。ファイルは一切更新しない。"""
    report = json.loads((OUTPUT / "head_parts.json").read_text(encoding="utf-8"))
    for key, spec in SPECS.items():
        entry = report["heads"][key]
        source_path = INPUT / f"{spec['name']}.png"
        assert sha256(source_path) == entry["source_sha256"] == spec["source_sha256"]
        original = np.asarray(Image.open(source_path)).copy()
        mask = Image.new("L", (1254, 1254), 0)
        ImageDraw.Draw(mask).polygon([tuple(p) for p in spec["polygon"]], fill=255)
        saved_mask = np.asarray(Image.open(OUTPUT / "マスク" / f"{spec['name']}_頭部選択.png"))
        assert np.array_equal(saved_mask, np.asarray(mask))
        assert set(np.unique(saved_mask)) == {0, 255}
        expected = original.copy()
        expected[saved_mask == 0, 3] = 0
        bounds = Image.fromarray(expected).getchannel("A").getbbox()
        assert list(bounds) == entry["crop"]
        left, top, right, bottom = bounds
        target = OUTPUT / entry["file"]
        actual = np.asarray(Image.open(target))
        assert np.array_equal(actual, expected[top:bottom, left:right])
        assert list(Image.open(target).size) == entry["size"]
        assert sha256(target) == entry["output_sha256"]
        assert original[:, :, 3].max() == actual[:, :, 3].max()
        print(f"{key}: PASS (original unchanged; retained RGBA exact; binary mask; crop; saved hash)")


def inspect_sources():
    """判断用の拡大。元PNGと本番出力は変更しない。"""
    dest = OUTPUT / "確認用"
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("アルシェ", "カリマ"):
        source = Image.open(INPUT / f"{name}.png")
        crop = source.crop((440, 470, 840, 610))
        panel = Image.new("RGBA", crop.size, "#d6ddd9")
        panel.alpha_composite(crop)
        enlarged = panel.resize((1200, 420), Image.Resampling.NEAREST).convert("RGB")
        draw = ImageDraw.Draw(enlarged)
        for x in range(440, 841, 20):
            local = (x - 440) * 3
            draw.line((local, 0, local, 420), fill="#7a9690", width=1)
            draw.text((local + 2, 2), str(x), fill="#202624")
        for y in range(470, 611, 10):
            local = (y - 470) * 3
            draw.line((0, local, 1200, local), fill="#7a9690", width=1)
            draw.text((2, local + 2), str(y), fill="#202624")
        spec = next(item for item in SPECS.values() if item["name"] == name)
        points = [((x - 440) * 3, (y - 470) * 3) for x, y in spec["polygon"]]
        draw.line(points + points[:1], fill="#da4339", width=2)
        for x, y in spec["polygon"]:
            px, py = (x - 440) * 3, (y - 470) * 3
            draw.ellipse((px-3,py-3,px+3,py+3), fill="#da4339")
        enlarged.save(dest / f"{name}_首境界確認.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inspect", action="store_true", help="首境界の拡大だけ出力")
    parser.add_argument("--verify", action="store_true", help="保存済み候補を更新せず検証")
    args = parser.parse_args()
    if args.verify:
        verify_outputs()
    elif args.inspect:
        inspect_sources()
    else:
        (OUTPUT / "確認用").mkdir(parents=True, exist_ok=True)
        extract()

"""既存PNGを無加工で、短い点火と選択中の燃焼ループへ梱包する。"""
import argparse
import json
from pathlib import Path
from PIL import Image


def package(extinguish_only=False):
    directory = Path(__file__).resolve().parent / "fx"
    frame_dir = directory / "command-flame-burn-v03-frames"
    specs = {
        "ignite": {"frames": [1, 2, 3, 4], "durations": [40, 45, 45, 50], "loop": 1},
        "hold": {"frames": [5, 6, 7, 8, 9, 10, 11], "durations": [80, 80, 80, 80, 90, 90, 90], "loop": 0},
    }
    if extinguish_only:
        specs = {"extinguish": {"frames": [12, 13, 14, 15, 16, 17], "durations": [35, 35, 40, 40, 40, 10], "loop": 1}}
    outputs = [directory / f"command-flame-selection-v01-{key}.apng" for key in specs]
    manifest = directory / ("command-flame-selection-v01-extinguish.json" if extinguish_only else "command-flame-selection-v01.json")
    if manifest.exists() or any(path.exists() for path in outputs):
        raise FileExistsError("既存素材を上書きしません。出力は既にあります。")
    for (key, spec), output in zip(specs.items(), outputs):
        frames = []
        for number in spec["frames"]:
            with Image.open(frame_dir / f"{number:02}.png") as image:
                frames.append(image.copy())
        frames[0].save(output, format="PNG", save_all=True, append_images=frames[1:],
                       duration=spec["durations"], loop=spec["loop"], disposal=0, blend=0)
        with Image.open(output) as decoded:
            assert decoded.n_frames == len(frames)
            assert decoded.info["loop"] == spec["loop"]
            for index, original in enumerate(frames):
                decoded.seek(index)
                assert decoded.convert("RGBA").tobytes() == original.tobytes()
                assert round(decoded.info["duration"]) == spec["durations"][index]
        spec["src"] = output.name
        spec["durationMs"] = sum(spec["durations"])
        print(f"{key}: {len(frames)}コマ / {spec['durationMs']}ms / loop={spec['loop']} / 復号画素一致")
    manifest.write_text(json.dumps({"schema": "solar-flame-selection-apng-v01", "sourceFrames": frame_dir.name,
                                   "origin": [.57, .78], "stages": specs,
                                   "note": "既存コマを無加工で再梱包。短い消火。" if extinguish_only else "既存コマを無加工で再梱包。点火一度→消火コマを含まない燃焼ループ。"},
                                  ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extinguish-only", action="store_true", help="既存の点火・燃焼素材は残し、消火だけを別出力する")
    package(parser.parse_args().extinguish_only)

"""腕付きPoC: ブラウザと同じJS評価器からAPNG/シートを生成する。"""
from pathlib import Path
import hashlib
import json
import math
import subprocess
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "generated" / "v2"


def draw_frame(images, pose, size, quality=2, padding=0):
    width, height = size
    result = Image.new("RGBA", ((width + padding * 2) * quality,
                                  (height + padding * 2) * quality))
    for name in pose["drawOrder"]:
        a, b, c, d, e, f = pose["matrices"][name]
        a, b, c, d = [x * quality for x in (a, b, c, d)]
        e, f = (e + padding) * quality, (f + padding) * quality
        determinant = a * d - b * c
        inverse = (d / determinant, -c / determinant, (c * f - d * e) / determinant,
                   -b / determinant, a / determinant, (b * e - a * f) / determinant)
        # 半透明の縁を二重にマスクしない。色とアルファを同じ変換で描く。
        layer = images[name].convert("RGBa").transform(result.size, Image.Transform.AFFINE,
                inverse, Image.Resampling.BICUBIC).convert("RGBA")
        result.alpha_composite(layer)
    if quality != 1:
        result = result.resize((width + padding * 2, height + padding * 2), Image.Resampling.LANCZOS)
    return result


def point(matrix, local):
    a, b, c, d, e, f = matrix
    return (a * local["x"] + c * local["y"] + e,
            b * local["x"] + d * local["y"] + f)


def distance(actual, expected):
    return math.hypot(actual[0] - expected["x"], actual[1] - expected["y"])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(["node", str(ROOT / "export_motion.js")], check=True,
                               capture_output=True, encoding="utf-8")
    data = json.loads(completed.stdout)
    definition = data["definition"]
    canvas = definition["canvas"]
    size = (canvas["width"], canvas["height"])
    assets = {"body": definition["body"]["asset"], "weapon": definition["weapon"]["asset"]}
    assets.update({name: definition["rig"][name]["asset"] for name in ("upperArm", "forearm", "hand")})
    images = {name: Image.open(ROOT / asset).convert("RGBA") for name, asset in assets.items()}
    report = {"ok": True, "evaluator": "motion-core-v2.js (same as browser)",
              "definitionSha256": hashlib.sha256((ROOT / "motion-v2.json").read_bytes()).hexdigest(),
              "clips": {}, "issues": []}

    for name, clip in data["clips"].items():
        frames = [draw_frame(images, entry["sample"], size) for entry in clip["frames"]]
        durations = [entry["durationMs"] for entry in clip["frames"]]
        # Pillow は同一の連続コマを統合する。時間を足して明示的に同じ統合を行う。
        apng_frames = []
        apng_durations = []
        for frame, duration in zip(frames, durations):
            if apng_frames and frame.tobytes() == apng_frames[-1].tobytes():
                apng_durations[-1] += duration
            else:
                apng_frames.append(frame)
                apng_durations.append(duration)
        # 透過を含む完全フレームで置換。前フレームの剣の残像を残さない。
        apng_frames[0].save(OUT / f"{name}.apng", format="PNG", save_all=True,
                       append_images=apng_frames[1:], duration=apng_durations,
                       loop=0 if clip["loop"] else 1, disposal=0, blend=0, optimize=False)
        columns = 8
        rows = math.ceil(len(frames) / columns)
        sheet = Image.new("RGBA", (size[0] * columns, size[1] * rows))
        metadata = {"clip": name, "durationMs": clip["durationMs"], "loop": clip["loop"],
                    "fpsTarget": canvas["fps"], "frameSize": size, "frames": []}
        for index, (frame, entry) in enumerate(zip(frames, clip["frames"])):
            x, y = index % columns * size[0], index // columns * size[1]
            sheet.alpha_composite(frame, (x, y))
            metadata["frames"].append({**entry, "rect": {"x": x, "y": y, "w": size[0], "h": size[1]}})
        sheet.save(OUT / f"{name}_sheet.png")
        (OUT / f"{name}_frames.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        draw_frame(images, clip["endpoint"], size).save(OUT / f"{name}_end.png")

        checks = {"checkedSamples": len(clip["checks"]), "maxGripErrorPx": 0,
                  "maxJointErrorPx": 0, "maxFootAnchorErrorPx": 0, "clippedSamples": 0,
                  "apngFrameMismatches": 0, "durationMs": sum(durations)}
        for pose in clip["checks"]:
            matrices = pose["matrices"]
            checks["maxGripErrorPx"] = max(checks["maxGripErrorPx"],
                    distance(point(matrices["weapon"], pose["grip"]), pose["handPosition"]))
            for part, anchor, world in [
                ("upperArm", definition["rig"]["upperArm"]["start"], "shoulderPosition"),
                ("upperArm", definition["rig"]["upperArm"]["end"], "elbowPosition"),
                ("forearm", definition["rig"]["forearm"]["start"], "elbowPosition"),
                ("forearm", definition["rig"]["forearm"]["end"], "wristPosition"),
                ("hand", definition["rig"]["hand"]["wrist"], "wristPosition"),
            ]:
                checks["maxJointErrorPx"] = max(checks["maxJointErrorPx"],
                        distance(point(matrices[part], anchor), pose[world]))
            checks["maxFootAnchorErrorPx"] = max(checks["maxFootAnchorErrorPx"],
                    distance(point(matrices["body"], definition["body"]["anchors"]["foot"]), pose["footPosition"]))
            wide = draw_frame(images, pose, size, quality=1, padding=80)
            bbox = wide.getchannel("A").getbbox()
            if bbox is None or bbox[0] < 80 or bbox[1] < 80 or bbox[2] > size[0] + 80 or bbox[3] > size[1] + 80:
                checks["clippedSamples"] += 1

        reopened = Image.open(OUT / f"{name}.apng")
        if reopened.n_frames != len(apng_frames):
            report["issues"].append(f"{name}: APNGフレーム数不一致")
        decoded_duration = 0
        for index, frame in enumerate(apng_frames[:reopened.n_frames]):
            reopened.seek(index)
            decoded_duration += reopened.info.get("duration", 0)
            if reopened.convert("RGBA").tobytes() != frame.tobytes():
                checks["apngFrameMismatches"] += 1
        checks["sheetFrames"] = len(frames)
        checks["apngFrames"] = reopened.n_frames
        checks["decodedDurationMs"] = decoded_duration
        if abs(decoded_duration - clip["durationMs"]) > 0.01:
            report["issues"].append(f"{name}: APNG実時間不一致")
        if checks["clippedSamples"] or checks["apngFrameMismatches"] or checks["maxJointErrorPx"] > 1e-7:
            report["issues"].append(f"{name}: はみ出し・関節・APNGを確認")
        if sum(durations) != clip["durationMs"]:
            report["issues"].append(f"{name}: 時間不一致")
        report["clips"][name] = checks

    # 動きの節目を並べた確認用画像。画像パーツの加工は行わない。
    poses = data["clips"]["attack"]["frames"]
    selected = [0, 7, 10, 13, 16, len(poses) - 1]
    contact = Image.new("RGB", (size[0] * 3, (size[1] + 28) * 2), "#cbd6dc")
    draw = ImageDraw.Draw(contact)
    for slot, index in enumerate(selected):
        x, y = slot % 3 * size[0], slot // 3 * (size[1] + 28)
        frame = draw_frame(images, poses[index]["sample"], size)
        contact.paste(frame, (x, y), frame)
        draw.text((x + 16, y + size[1]), f'{poses[index]["time"]:.3f} s', fill="#34424a")
    contact.save(OUT / "attack_pose_review.jpg", quality=92)
    report["ok"] = not report["issues"]
    (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

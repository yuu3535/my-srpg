"""motion.json から確認用の剣・APNG・スプライトシートを作る。"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
DEFINITION_PATH = ROOT / "motion.json"
UPSTREAM_BODY = ROOT.parent.parent / "unity-prototype" / "Assets" / "Art" / "SD" / "young_arshe.png"
LOCAL_BODY = ROOT / "assets" / "character" / "young_arshe.png"
WEAPON_PATH = ROOT / "assets" / "weapon" / "one_hand_sword.png"
GENERATED = ROOT / "generated"


@dataclass(frozen=True)
class Point:
    x: float
    y: float


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def smoothstep(value: float) -> float:
    amount = clamp(value, 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def sample_keys(keys: list[dict[str, Any]], time: float) -> dict[str, Any]:
    for key in keys:
        if abs(time - key["t"]) < 1e-9:
            return dict(key)
    if time <= keys[0]["t"]:
        return dict(keys[0])
    if time >= keys[-1]["t"]:
        return dict(keys[-1])

    left = keys[0]
    right = keys[-1]
    for index in range(len(keys) - 1):
        if keys[index]["t"] <= time <= keys[index + 1]["t"]:
            left = keys[index]
            right = keys[index + 1]
            break

    amount = smoothstep((time - left["t"]) / (right["t"] - left["t"]))
    sampled = dict(left)
    sampled["t"] = time
    for field in ("x", "y", "rotation", "scale", "angle"):
        if field in left and field in right:
            sampled[field] = left[field] + (right[field] - left[field]) * amount
    sampled["layer"] = left.get("layer")
    return sampled


def rotate_point(point: Point, degrees: float) -> Point:
    radians = math.radians(degrees)
    return Point(
        point.x * math.cos(radians) - point.y * math.sin(radians),
        point.x * math.sin(radians) + point.y * math.cos(radians),
    )


def make_weapon(definition: dict[str, Any]) -> None:
    """AI画像ではなく、Pillowの多角形だけで仮の透過剣を作る。"""
    size = definition["weapon"]["size"]
    grip = definition["weapon"]["grip"]
    width, height = size["width"], size["height"]
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    outline = (35, 42, 50, 255)
    steel_dark = (113, 130, 139, 255)
    steel_light = (207, 218, 222, 255)
    brass = (180, 139, 73, 255)
    leather = (74, 50, 38, 255)

    draw.polygon([(36, 2), (47, 25), (42, 126), (36, 136), (30, 126), (25, 25)], fill=outline)
    draw.polygon([(36, 7), (43, 27), (39, 123), (36, 130), (33, 123), (29, 27)], fill=steel_dark)
    draw.polygon([(36, 8), (36, 129), (32, 121), (29, 27)], fill=steel_light)
    draw.polygon([(10, 130), (30, 128), (36, 134), (42, 128), (62, 130), (58, 139), (42, 141), (36, 137), (30, 141), (14, 139)], fill=outline)
    draw.polygon([(15, 132), (31, 131), (36, 136), (41, 131), (57, 132), (55, 136), (41, 138), (36, 134), (31, 138), (17, 136)], fill=brass)
    draw.rounded_rectangle((31, 137, 41, 164), radius=3, fill=outline)
    draw.rounded_rectangle((33, 139, 39, 162), radius=2, fill=leather)
    for y in range(142, 161, 5):
        draw.line((33, y, 39, y + 3), fill=(151, 113, 70, 255), width=1)
    draw.ellipse((29, 158, 43, 172), fill=outline)
    draw.ellipse((32, 161, 40, 169), fill=brass)
    draw.ellipse((grip["x"] - 2, grip["y"] - 2, grip["x"] + 2, grip["y"] + 2), fill=(0, 0, 0, 0))

    WEAPON_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(WEAPON_PATH)


def ensure_body_snapshot() -> None:
    if not UPSTREAM_BODY.exists():
        raise FileNotFoundError(f"原本が見つかりません: {UPSTREAM_BODY}")
    LOCAL_BODY.parent.mkdir(parents=True, exist_ok=True)
    if not LOCAL_BODY.exists():
        shutil.copy2(UPSTREAM_BODY, LOCAL_BODY)


def transform_image(
    image: Image.Image,
    pivot: Point,
    position: Point,
    rotation: float,
    scale: float,
    canvas_size: tuple[int, int],
) -> Image.Image:
    scaled_size = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    resized = image.resize(scaled_size, Image.Resampling.LANCZOS)
    scaled_pivot = Point(pivot.x * scale, pivot.y * scale)
    margin = int(math.ceil(math.hypot(resized.width, resized.height))) + 8
    local = Image.new("RGBA", (margin * 2, margin * 2), (0, 0, 0, 0))
    local.paste(
        resized,
        (round(margin - scaled_pivot.x), round(margin - scaled_pivot.y)),
        resized,
    )
    rotated = local.rotate(-rotation, resample=Image.Resampling.BICUBIC, center=(margin, margin))
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    layer.alpha_composite(rotated, (round(position.x - margin), round(position.y - margin)))
    return layer


def sample_motion(definition: dict[str, Any], clip_name: str, time: float) -> dict[str, Any]:
    clip = definition["clips"][clip_name]
    local_time = time % clip["duration"] if clip["loop"] else clamp(time, 0, clip["duration"])
    body = sample_keys(clip["bodyKeys"], local_time)
    weapon = sample_keys(clip["weaponKeys"], local_time)
    body_info = definition["body"]
    body_scale = body_info["referenceBodyHeight"] / body_info["sourceSize"]["height"] * body["scale"]
    foot = Point(**body_info["anchors"]["foot"])
    hand = Point(**body_info["anchors"]["hand"])
    hand_local = Point((hand.x - foot.x) * body_scale, (hand.y - foot.y) * body_scale)
    hand_rotated = rotate_point(hand_local, body["rotation"])
    foot_position = Point(definition["canvas"]["width"] / 2 + body["x"], definition["canvas"]["groundY"] + body["y"])
    hand_position = Point(
        foot_position.x + hand_rotated.x + weapon["x"],
        foot_position.y + hand_rotated.y + weapon["y"],
    )
    grip = Point(**definition["weapon"]["grip"])
    pivot = Point(**definition["weapon"]["pivot"])
    weapon_scale = definition["weapon"]["defaultScale"] * weapon["scale"]
    pivot_to_grip = rotate_point(
        Point((grip.x - pivot.x) * weapon_scale, (grip.y - pivot.y) * weapon_scale),
        weapon["angle"],
    )
    pivot_position = Point(hand_position.x - pivot_to_grip.x, hand_position.y - pivot_to_grip.y)
    return {
        "time": local_time,
        "body": body,
        "weapon": weapon,
        "bodyScale": body_scale,
        "footPosition": foot_position,
        "handPosition": hand_position,
        "grip": grip,
        "pivot": pivot,
        "pivotPosition": pivot_position,
        "weaponScale": weapon_scale,
        "layer": weapon.get("layer") or "front",
    }


def render_frame(
    definition: dict[str, Any],
    body_image: Image.Image,
    weapon_image: Image.Image,
    clip_name: str,
    time: float,
    flipped: bool = False,
) -> tuple[Image.Image, dict[str, Any]]:
    sample = sample_motion(definition, clip_name, time)
    canvas_size = (definition["canvas"]["width"], definition["canvas"]["height"])
    body_layer = transform_image(
        body_image,
        Point(**definition["body"]["anchors"]["foot"]),
        sample["footPosition"],
        sample["body"]["rotation"],
        sample["bodyScale"],
        canvas_size,
    )
    weapon_layer = transform_image(
        weapon_image,
        sample["pivot"],
        sample["pivotPosition"],
        sample["weapon"]["angle"],
        sample["weaponScale"],
        canvas_size,
    )
    frame = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    layers = (weapon_layer, body_layer) if sample["layer"] == "behind" else (body_layer, weapon_layer)
    for layer in layers:
        frame.alpha_composite(layer)
    if flipped:
        frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return frame, sample


def serializable_sample(sample: dict[str, Any]) -> dict[str, Any]:
    return {
        "time": round(sample["time"], 6),
        "body": {key: round(value, 6) if isinstance(value, float) else value for key, value in sample["body"].items()},
        "weapon": {key: round(value, 6) if isinstance(value, float) else value for key, value in sample["weapon"].items()},
        "foot": {"x": round(sample["footPosition"].x, 6), "y": round(sample["footPosition"].y, 6)},
        "hand": {"x": round(sample["handPosition"].x, 6), "y": round(sample["handPosition"].y, 6)},
        "weaponPivot": {"x": round(sample["pivotPosition"].x, 6), "y": round(sample["pivotPosition"].y, 6)},
        "drawOrder": "weapon-body" if sample["layer"] == "behind" else "body-weapon",
    }


def save_clip(
    definition: dict[str, Any],
    body_image: Image.Image,
    weapon_image: Image.Image,
    clip_name: str,
) -> dict[str, Any]:
    clip = definition["clips"][clip_name]
    fps = definition["canvas"]["fps"]
    if clip["loop"]:
        frame_count = round(clip["duration"] * fps)
        times = [index / fps for index in range(frame_count)]
    else:
        frame_count = math.ceil(clip["duration"] * fps) + 1
        times = [min(index / fps, clip["duration"]) for index in range(frame_count)]

    frames: list[Image.Image] = []
    samples: list[dict[str, Any]] = []
    for time in times:
        frame, sample = render_frame(definition, body_image, weapon_image, clip_name, time)
        frames.append(frame)
        samples.append(sample)

    duration_ms = round(1000 / fps)
    apng_path = GENERATED / f"{clip_name}.apng"
    frames[0].save(
        apng_path,
        save_all=True,
        append_images=frames[1:],
        duration=[duration_ms] * len(frames),
        loop=0 if clip["loop"] else 1,
        disposal=2,
        blend=0,
        optimize=False,
    )

    columns = 8
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new(
        "RGBA",
        (definition["canvas"]["width"] * columns, definition["canvas"]["height"] * rows),
        (0, 0, 0, 0),
    )
    frame_entries = []
    for index, (frame, sample) in enumerate(zip(frames, samples)):
        column, row = index % columns, index // columns
        x = column * definition["canvas"]["width"]
        y = row * definition["canvas"]["height"]
        sheet.alpha_composite(frame, (x, y))
        frame_entries.append({
            "index": index,
            "time": round(times[index], 6),
            "durationMs": duration_ms,
            "rect": {"x": x, "y": y, "w": definition["canvas"]["width"], "h": definition["canvas"]["height"]},
            "sample": serializable_sample(sample),
        })
    sheet.save(GENERATED / f"{clip_name}_sheet.png")
    with (GENERATED / f"{clip_name}_frames.json").open("w", encoding="utf-8") as handle:
        json.dump({
            "clip": clip_name,
            "loop": clip["loop"],
            "fps": fps,
            "frameSize": {"width": definition["canvas"]["width"], "height": definition["canvas"]["height"]},
            "sheet": {"columns": columns, "rows": rows},
            "frames": frame_entries,
        }, handle, ensure_ascii=False, indent=2)

    return {"clip": clip_name, "frames": len(frames), "apng": apng_path.name}


def verify(definition: dict[str, Any], body_image: Image.Image, weapon_image: Image.Image) -> dict[str, Any]:
    issues: list[str] = []
    clip_results = []
    canvas_size = (definition["canvas"]["width"], definition["canvas"]["height"])
    fps = definition["canvas"]["fps"]

    if body_image.mode != "RGBA" or body_image.getchannel("A").getextrema()[0] != 0:
        issues.append("人物PNGに透明領域がありません。")
    if weapon_image.mode != "RGBA" or weapon_image.getchannel("A").getextrema()[0] != 0:
        issues.append("武器PNGに透明領域がありません。")

    for clip_name, clip in definition["clips"].items():
        steps = math.ceil(clip["duration"] * fps) + 1
        max_grip_error = 0.0
        max_foot_offset = 0.0
        edge_hits = 0
        mirror_mismatches = 0
        for index in range(steps):
            time = min(index / fps, clip["duration"])
            frame, sample = render_frame(definition, body_image, weapon_image, clip_name, time)
            left_frame, _ = render_frame(definition, body_image, weapon_image, clip_name, time, flipped=True)
            if left_frame.tobytes() != frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT).tobytes():
                mirror_mismatches += 1
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                issues.append(f"{clip_name} {time:.3f}s は空フレームです。")
                continue
            if bbox[0] <= 0 or bbox[1] <= 0 or bbox[2] >= canvas_size[0] or bbox[3] >= canvas_size[1]:
                edge_hits += 1
            expected_foot = Point(canvas_size[0] / 2 + sample["body"]["x"], definition["canvas"]["groundY"] + sample["body"]["y"])
            max_foot_offset = max(max_foot_offset, math.hypot(sample["footPosition"].x - expected_foot.x, sample["footPosition"].y - expected_foot.y))
            pivot_to_grip = rotate_point(
                Point(
                    (sample["grip"].x - sample["pivot"].x) * sample["weaponScale"],
                    (sample["grip"].y - sample["pivot"].y) * sample["weaponScale"],
                ),
                sample["weapon"]["angle"],
            )
            rendered_grip = Point(
                sample["pivotPosition"].x + pivot_to_grip.x,
                sample["pivotPosition"].y + pivot_to_grip.y,
            )
            max_grip_error = max(
                max_grip_error,
                math.hypot(rendered_grip.x - sample["handPosition"].x, rendered_grip.y - sample["handPosition"].y),
            )

        if edge_hits:
            issues.append(f"{clip_name}: {edge_hits}フレームがキャンバス端に達しています。")
        if mirror_mismatches:
            issues.append(f"{clip_name}: 左右反転の不一致が{mirror_mismatches}フレームあります。")
        clip_results.append({
            "clip": clip_name,
            "checkedFrames": steps,
            "maxGripErrorPx": round(max_grip_error, 6),
            "maxFootAnchorErrorPx": round(max_foot_offset, 6),
            "edgeHits": edge_hits,
            "mirrorMismatches": mirror_mismatches,
        })

    upstream_hash = hashlib.sha256(UPSTREAM_BODY.read_bytes()).hexdigest()
    snapshot_hash = hashlib.sha256(LOCAL_BODY.read_bytes()).hexdigest()
    if upstream_hash != snapshot_hash:
        issues.append("PoC内の人物スナップショットがUnity側の原本と一致しません。")
    report = {
        "ok": not issues,
        "sourceSnapshot": {
            "matchesUpstream": upstream_hash == snapshot_hash,
            "sha256": snapshot_hash,
        },
        "bodyAlphaBounds": body_image.getchannel("A").getbbox(),
        "weaponAlphaBounds": weapon_image.getchannel("A").getbbox(),
        "clips": clip_results,
        "issues": issues,
    }
    with (GENERATED / "verification.json").open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true", help="再生成せず、現在の定義だけを検査する")
    args = parser.parse_args()

    with DEFINITION_PATH.open(encoding="utf-8") as handle:
        definition = json.load(handle)
    GENERATED.mkdir(parents=True, exist_ok=True)
    ensure_body_snapshot()
    if not args.verify_only or not WEAPON_PATH.exists():
        make_weapon(definition)

    body_image = Image.open(LOCAL_BODY).convert("RGBA")
    weapon_image = Image.open(WEAPON_PATH).convert("RGBA")
    outputs = []
    if not args.verify_only:
        for clip_name in definition["clips"]:
            outputs.append(save_clip(definition, body_image, weapon_image, clip_name))
    report = verify(definition, body_image, weapon_image)

    print(json.dumps({"outputs": outputs, "verification": report}, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

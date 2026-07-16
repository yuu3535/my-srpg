#!/usr/bin/env python3
"""白背景の未処理立ち絵だけを、1回のモデル読込で下処理する。"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from tachie_clear_v5 import create_session, process


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
OUTPUT_SUFFIXES = ("_transparent", "_clear")


def normalized_stem(path: Path) -> str:
    stem = path.stem
    for suffix in OUTPUT_SUFFIXES:
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    return stem.casefold()


def collect_existing_stems(directory: Path | None) -> set[str]:
    if directory is None or not directory.exists():
        return set()
    return {
        normalized_stem(path)
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    }


def white_edge_ratio(image: Image.Image) -> float:
    thumbnail = image.convert("RGB")
    thumbnail.thumbnail((256, 256))
    pixels = np.asarray(thumbnail)
    edge_x = max(1, thumbnail.width // 20)
    edge_y = max(1, thumbnail.height // 20)
    edges = np.concatenate(
        (
            pixels[:edge_y].reshape(-1, 3),
            pixels[-edge_y:].reshape(-1, 3),
            pixels[:, :edge_x].reshape(-1, 3),
            pixels[:, -edge_x:].reshape(-1, 3),
        )
    )
    return float((edges.min(axis=1) >= 245).mean())


def find_candidates(source: Path, existing_stems: set[str]) -> list[Path]:
    candidates = []
    for path in sorted(source.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if "ドット" in path.stem or normalized_stem(path) in existing_stems:
            continue
        try:
            with Image.open(path) as image:
                alpha_min, _ = image.convert("RGBA").getchannel("A").getextrema()
                if alpha_min == 255 and white_edge_ratio(image) >= 0.8:
                    candidates.append(path)
        except Exception as error:
            print(f"SKIP: {path} ({error})")
    return candidates


def output_path(source: Path, output: Path, path: Path) -> Path:
    relative = path.relative_to(source)
    return output / relative.parent / f"{path.stem}_clear.png"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="白背景立ち絵の入力フォルダ")
    parser.add_argument("output", type=Path, help="下処理結果の出力フォルダ")
    parser.add_argument(
        "--existing-dir",
        type=Path,
        help="同名の透過済み素材があれば処理対象から除外するフォルダ",
    )
    parser.add_argument("--dry-run", action="store_true", help="候補表示のみで変換しない")
    parser.add_argument("--limit", type=int, help="先頭から指定枚数だけ処理する")
    args = parser.parse_args()

    existing_stems = collect_existing_stems(args.existing_dir)
    candidates = find_candidates(args.source, existing_stems)
    candidates = [
        path
        for path in candidates
        if not output_path(args.source, args.output, path).exists()
    ]
    if args.limit is not None:
        candidates = candidates[: max(args.limit, 0)]

    print(f"下処理候補: {len(candidates)}枚")
    for path in candidates:
        print(f"  {path.relative_to(args.source)}")
    if args.dry_run or not candidates:
        return

    args.output.mkdir(parents=True, exist_ok=True)
    print("isnet-animeモデルを読み込みます")
    session = create_session()

    for index, path in enumerate(candidates, 1):
        destination = output_path(args.source, args.output, path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(path) as image:
                result = process(image, session)
            result.save(destination)
            print(f"[{index}/{len(candidates)}] OK: {destination}")
        except Exception as error:
            print(f"[{index}/{len(candidates)}] ERROR: {path} ({error})")


if __name__ == "__main__":
    main()

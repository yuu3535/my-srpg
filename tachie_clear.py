#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
立ち絵 白背景透過バッチツール
HTMLツール(white-bg-remover.html)と同じ処理をフォルダ一括で行う。

使い方:
  python tachie_clear.py 入力フォルダ 出力フォルダ
  python tachie_clear.py input.png 出力フォルダ --threshold 48 --softness 149

おすすめ設定の例(ギュンターで確定した値):
  python tachie_clear.py raw processed --threshold 48 --softness 149 ^
      --outline 0.5 --inner 0.5 --inner-alpha 49

必要なライブラリ: pip install pillow numpy scipy
"""
import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def hex_to_rgb(s: str):
    s = s.lstrip('#')
    return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))


def remove_white_bg(rgb: np.ndarray, src_alpha: np.ndarray,
                    threshold: int, softness: int, mode: str, defringe: bool):
    """白背景を透過したRGBA配列を返す(HTMLツールのprocess()と同じロジック)"""
    h, w = rgb.shape[:2]
    # 白からの距離(チャンネル差の最大値)
    dist = np.max(255 - rgb.astype(np.int16), axis=2)

    whiteish = dist <= threshold

    if mode == 'all':
        bg_core = whiteish
        band = (dist > threshold) & (dist < threshold + softness)
    else:
        # フラッドフィル: 外周に繋がる白だけを背景に
        labels, _ = ndimage.label(whiteish)
        edge = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
        edge.discard(0)
        bg_core = np.isin(labels, list(edge)) if edge else np.zeros_like(whiteish)
        # フェード帯: 背景コアを3px膨張させた範囲
        band = ndimage.binary_dilation(bg_core, iterations=3) & ~bg_core

    alpha = np.full((h, w), 255, dtype=np.float32)
    alpha[bg_core] = 0
    if softness > 0:
        t = np.clip((dist[band] - threshold) / softness, 0, 1)
        alpha[band] = t * 255
    else:
        alpha[band] = np.where(dist[band] > threshold, 255, 0)

    # 元画像のアルファも尊重
    alpha = np.minimum(alpha, src_alpha.astype(np.float32))

    out_rgb = rgb.astype(np.float32)
    if defringe:
        # 白フチ除去: 半透明ピクセルから混ざった白を引き算
        semi = (alpha > 0) & (alpha < 255)
        a = alpha[semi] / 255.0
        for c in range(3):
            ch = out_rgb[..., c]
            ch[semi] = np.clip((ch[semi] - 255 * (1 - a)) / np.maximum(a, 1e-6), 0, 255)

    return np.dstack([out_rgb.astype(np.uint8), alpha.astype(np.uint8)])


def build_layers(char: np.ndarray, outline_w: float, outline_rgb,
                 inner_w: float, inner_strength: float):
    """三段構造のレイヤーを距離変換で作る(小数px対応・エッジはアンチエイリアス)
    返り値: (outline_layer, inner_layer) いずれもRGBAまたはNone
    """
    A = char[..., 3].astype(np.float32)
    mask = A > 8

    outline_layer = None
    if outline_w > 0:
        # 背景側の各ピクセルからキャラまでの距離 → outline_w以内を塗る
        d_out = ndimage.distance_transform_edt(~mask)
        o_alpha = np.clip(outline_w + 1.0 - d_out, 0, 1) * 255
        o_alpha = np.maximum(o_alpha, A)  # キャラ内部はキャラのアルファ形状
        outline_layer = np.zeros_like(char)
        outline_layer[..., 0], outline_layer[..., 1], outline_layer[..., 2] = outline_rgb
        outline_layer[..., 3] = o_alpha.astype(np.uint8)

    inner_layer = None
    if inner_w > 0 and inner_strength > 0:
        # キャラ内部の各ピクセルから外までの距離 → inner_w以内のリングに線
        d_in = ndimage.distance_transform_edt(mask)
        ring = np.clip(inner_w + 1.0 - d_in, 0, 1)
        ring[~mask] = 0
        r_alpha = ring * (A / 255.0) * inner_strength * 255
        inner_layer = np.zeros_like(char)
        inner_layer[..., 0], inner_layer[..., 1], inner_layer[..., 2] = outline_rgb
        inner_layer[..., 3] = r_alpha.astype(np.uint8)

    return outline_layer, inner_layer


def composite(*layers):
    """RGBAレイヤーを下から順にアルファ合成"""
    base = Image.fromarray(layers[0], 'RGBA')
    for l in layers[1:]:
        if l is not None:
            base = Image.alpha_composite(base, Image.fromarray(l, 'RGBA'))
    return base


def process_file(path: Path, out_dir: Path, args):
    img = Image.open(path)
    src_alpha = np.asarray(img.convert('RGBA'))[..., 3]
    rgb = np.asarray(img.convert('RGB'))

    char = remove_white_bg(rgb, src_alpha, args.threshold, args.softness,
                           args.mode, not args.no_defringe)

    outline_rgb = hex_to_rgb(args.outline_color)
    outline_layer, inner_layer = build_layers(
        char, args.outline, outline_rgb, args.inner, args.inner_alpha / 100.0)

    stem = path.stem
    if args.layers:
        # クリスタ用: レイヤー別に書き出し(下から 01→03 の順で重ねる)
        if outline_layer is not None:
            Image.fromarray(outline_layer, 'RGBA').save(out_dir / f'{stem}_01_outline.png')
        Image.fromarray(char, 'RGBA').save(out_dir / f'{stem}_02_char.png')
        if inner_layer is not None:
            Image.fromarray(inner_layer, 'RGBA').save(out_dir / f'{stem}_03_innerline.png')
        print(f'  {path.name} → レイヤー別に書き出し')
    else:
        layers = [l for l in (outline_layer, char, inner_layer) if l is not None]
        result = composite(*layers)
        out_path = out_dir / f'{stem}{args.suffix}.png'
        result.save(out_path)
        print(f'  {path.name} → {out_path.name}')


def main():
    p = argparse.ArgumentParser(
        description='立ち絵の白背景を透過してPNG出力(縁取り・内側ライン付き)',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument('input', help='入力フォルダまたは画像ファイル')
    p.add_argument('output', help='出力フォルダ')
    p.add_argument('--threshold', type=int, default=12, help='しきい値(白とみなす範囲)')
    p.add_argument('--softness', type=int, default=50, help='フチのなめらかさ')
    p.add_argument('--mode', choices=['flood', 'all'], default='flood',
                   help='flood=外周に繋がる白だけ消す / all=白を全部消す')
    p.add_argument('--no-defringe', action='store_true', help='白フチ除去を無効化')
    p.add_argument('--outline', type=float, default=0, help='縁取りの太さpx(0で無効)')
    p.add_argument('--outline-color', default='#000000', help='縁取り・内側ラインの色')
    p.add_argument('--inner', type=float, default=0, help='内側ラインの太さpx(0で無効)')
    p.add_argument('--inner-alpha', type=float, default=60, help='内側ラインの濃さ%%')
    p.add_argument('--suffix', default='_transparent', help='出力ファイル名の接尾辞')
    p.add_argument('--layers', action='store_true',
                   help='合成せず縁取り/キャラ/内側ラインを別PNGで書き出す(クリスタ用)')
    args = p.parse_args()

    src = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    exts = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}
    if src.is_file():
        files = [src]
    else:
        files = sorted(f for f in src.iterdir() if f.suffix.lower() in exts)

    if not files:
        print('処理対象の画像が見つかりませんでした'); sys.exit(1)

    print(f'{len(files)}枚を処理します (threshold={args.threshold}, softness={args.softness}, '
          f'mode={args.mode}, outline={args.outline}, inner={args.inner}@{args.inner_alpha}%)')
    for f in files:
        try:
            process_file(f, out_dir, args)
        except Exception as e:
            print(f'  !! {f.name} の処理に失敗: {e}')
    print('完了!')


if __name__ == '__main__':
    main()

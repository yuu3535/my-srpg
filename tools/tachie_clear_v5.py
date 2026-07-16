#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
立ち絵 背景透過バッチツール v5（エッジ均一化）

v5の変更点:
  - マスク輪郭に軽いスムージング（--smooth、デフォルト1.5）
  - 縁取りを内側に食い込ませて境界の色ムラ帯を塗り潰し（--edge-cover、デフォルト1.0px）
    → 濃い背景に置いたときの「ギャザギャザ感」を解消

v4の変更点:
  - モデルをアニメキャラ特化のisnet-animeに変更（マスクが輪郭にピッタリ）
  - 賢い穴埋め: 純白の閉じ領域=隙間として透過、有色の閉じ領域=衣装内部として保護
  - shrinkのデフォルトを0に（isnetは膨らまないため。白フチが出る画像だけ調整）

白い衣装のキャラでも安全:
  1. isnet-animeでキャラの「形」を認識
  2. 二値化＋穴埋めで内部を完全不透明に固定（白衣装が絶対に抜けない）
  3. 輪郭1pxだけアンチエイリアス＋白フチ除去
  4. 縁取り0.5px＋内側ライン0.5px/49%（従来の確定値）

使い方:
  python tachie_clear_v2.py 入力.png 出力フォルダ
  python tachie_clear_v2.py rawフォルダ processedフォルダ

必要ライブラリ:
  pip install onnxruntime-directml pillow numpy scipy
  （初回実行時にモデル約176MBを自動DL）
"""
import argparse
import hashlib
import os
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
from PIL import Image
from scipy import ndimage


MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx"
MODEL_MD5 = "6f184e756bb3bd901c8849220a83e38e"


def model_path() -> Path:
    home = Path(os.environ.get("U2NET_HOME", Path.home() / ".u2net")).expanduser()
    home.mkdir(parents=True, exist_ok=True)
    path = home / "isnet-anime.onnx"
    if path.exists():
        return path

    temporary = path.with_suffix(".onnx.download")
    print("isnet-animeモデルをダウンロードします（約176MB）")
    urlretrieve(MODEL_URL, temporary)
    digest = hashlib.md5(temporary.read_bytes()).hexdigest()
    if digest != MODEL_MD5:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("isnet-animeモデルの検証に失敗しました")
    temporary.replace(path)
    return path


class AnimeSegmentationSession:
    def __init__(self):
        import onnxruntime as ort

        available = ort.get_available_providers()
        providers = [
            provider
            for provider in ("DmlExecutionProvider", "CUDAExecutionProvider", "CPUExecutionProvider")
            if provider in available
        ]
        self.provider = providers[0] if providers else "default"
        options = ort.SessionOptions()
        if self.provider == "DmlExecutionProvider":
            options.enable_mem_pattern = False
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        print(f"推論プロバイダー: {self.provider}")
        self.session = ort.InferenceSession(
            str(model_path()),
            sess_options=options,
            providers=providers or None,
        )
        self.input_name = self.session.get_inputs()[0].name

    def predict_mask(self, image: Image.Image) -> Image.Image:
        resized = image.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
        values = np.asarray(resized, dtype=np.float32)
        values /= max(float(values.max()), 1e-6)
        values[..., 0] -= 0.485
        values[..., 1] -= 0.456
        values[..., 2] -= 0.406
        tensor = values.transpose((2, 0, 1))[None].astype(np.float32)
        prediction = self.session.run(None, {self.input_name: tensor})[0][:, 0]
        prediction = np.squeeze(prediction)
        minimum = float(prediction.min())
        maximum = float(prediction.max())
        prediction = (prediction - minimum) / max(maximum - minimum, 1e-6)
        mask = Image.fromarray((prediction * 255).astype(np.uint8), mode="L")
        return mask.resize(image.size, Image.Resampling.LANCZOS)


def hex_to_rgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))


def create_session():
    """利用可能ならGPU、なければCPUでisnet-animeを初期化する。"""
    return AnimeSegmentationSession()


def process(img: Image.Image, session, shrink=0, smooth=1.5, edge_cover=1.0,
            outline=0.5, inner=0.5, inner_alpha=49,
            line_color='#1e2440', seg_threshold=100,
            keep_detached=True) -> Image.Image:
    orig = np.asarray(img.convert('RGB'), dtype=np.float32)

    # 1) AIセグメンテーションで形を取得
    seg = np.asarray(session.predict_mask(img), dtype=np.float32)

    # 2) 賢い穴埋め: 純白の穴=隙間として開放 / 有色の穴=衣装内部として保護
    dist_w = 255.0 - orig.min(axis=2)  # 白からの距離
    base = seg > seg_threshold
    filled = ndimage.binary_fill_holes(base)
    holes = filled & ~base
    hlbl, hn = ndimage.label(holes)
    solid = base.copy()
    if hn:
        hole_ids = np.arange(1, hn + 1)
        hole_sizes = np.asarray(ndimage.sum(holes, hlbl, hole_ids), dtype=np.float64)
        white_sizes = np.asarray(
            ndimage.sum(holes & (dist_w < 30), hlbl, hole_ids),
            dtype=np.float64,
        )
        colored_holes = hole_ids[(white_sizes / np.maximum(hole_sizes, 1)) <= 0.6]
        if colored_holes.size:
            solid |= np.isin(hlbl, colored_holes)
    if shrink > 0:  # マスクの膨らみ補正(必要な画像のみ)
        solid = ndimage.distance_transform_edt(solid) > shrink
    if smooth > 0:  # 輪郭のスムージング
        solid = ndimage.gaussian_filter(solid.astype(np.float32), smooth) > 0.5
    lbl, n = ndimage.label(solid)
    if n > 1 and not keep_detached:
        sizes = ndimage.sum(solid, lbl, range(1, n + 1))
        solid = lbl == (np.argmax(sizes) + 1)

    # 3) 輪郭1pxだけ滑らかに（符号付き距離）
    d_out = ndimage.distance_transform_edt(~solid)
    d_in = ndimage.distance_transform_edt(solid)
    sd = np.where(solid, d_in, -d_out)
    alpha = np.clip((sd + 0.5) * 255, 0, 255)

    # 白フチ除去（境界の半透明ピクセルのみ）
    rgb = orig.copy()
    a = alpha / 255.0
    semi = (a > 0.02) & (a < 0.98)
    if semi.any():
        aa = a[semi][:, None]
        rgb[semi] = np.clip((rgb[semi] - (1 - aa) * 255.0) / np.maximum(aa, 0.25), 0, 255)

    # 4) 縁取り(外側) + 境界の色ムラ塗り潰し(内側) + 馴染ませグラデ
    lc = np.array(hex_to_rgb(line_color), dtype=np.float32)
    if outline > 0:
        ring = (~solid) & (d_out <= outline + 0.5)
        cover = np.clip(outline + 0.5 - d_out[ring], 0, 1) * 255
        rgb[ring] = lc
        alpha[ring] = np.maximum(alpha[ring], cover)
    if edge_cover > 0:  # 境界内側を縁色で完全に塗り潰し(白ピクセルの明滅を消す)
        band_full = solid & (d_in <= edge_cover)
        rgb[band_full] = lc
    if inner > 0 and inner_alpha > 0:  # その内側は半透明グラデで馴染ませ
        band_soft = solid & (d_in > edge_cover) & (d_in <= edge_cover + inner + 0.5)
        k = (inner_alpha / 100.0) * np.clip(edge_cover + inner + 0.5 - d_in[band_soft], 0, 1)
        rgb[band_soft] = rgb[band_soft] * (1 - k[:, None]) + lc * k[:, None]

    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src'); p.add_argument('dst')
    p.add_argument('--outline', type=float, default=0.5)
    p.add_argument('--inner', type=float, default=0.5)
    p.add_argument('--inner-alpha', type=float, default=49)
    p.add_argument('--line-color', default='#1e2440')
    p.add_argument('--smooth', type=float, default=1.5,
                   help='輪郭スムージング強度。角が丸まりすぎるなら下げる')
    p.add_argument('--edge-cover', type=float, default=1.0,
                   help='縁取りの内側食い込み(px)。ギャザギャザが残るなら上げる')
    p.add_argument('--shrink', type=float, default=0,
                   help='マスク収縮量(px)。白フチが残るなら上げ、線画が削れるなら下げる')
    p.add_argument('--seg-threshold', type=int, default=100,
                   help='セグメンテーション二値化しきい値(0-255)。細部が欠けるなら下げる')
    p.add_argument('--largest-only', action='store_true',
                   help='人物から離れた小パーツを除き、最大の連結領域だけ残す')
    a = p.parse_args()

    src, dst = Path(a.src), Path(a.dst)
    dst.mkdir(parents=True, exist_ok=True)
    files = [src] if src.is_file() else sorted(
        f for f in src.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))

    session = create_session()  # モデルは1回だけロード
    for f in files:
        out = process(Image.open(f), session, a.shrink, a.smooth, a.edge_cover,
                      a.outline, a.inner, a.inner_alpha,
                      a.line_color, a.seg_threshold, not a.largest_only)
        path = dst / (f.stem + '_clear.png')
        out.save(path)
        print('OK:', path)


if __name__ == '__main__':
    main()

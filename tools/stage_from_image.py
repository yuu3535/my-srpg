"""2Dの背景の絵から、3Dキャラが歩く「透明な舞台」を作る（試作。原作者 2026-10-07）。

流れ:
1. 奥行きの推定（Depth Anything V2 small・室内の版・ONNX。手元のPCだけで動く）
2. 絵の床の線が集まる点（消失点）を、カメラの中心にする（柱が縦にまっすぐな絵は、カメラが水平で、写す範囲をずらした撮り方）
3. 床の面を探し、床が水平になる向き（世界の上向き）とカメラの高さを決める
4. 歩ける所の高さの表（床・階段・台）と、前後関係のための奥行き（床は奥へ押しやり、柱・燭台などだけで隠す）を書き出す

使い方（リポジトリのルートで）:
    py -3.12 tools/stage_from_image.py 背景/ブラッシュアップ版/オルクス謁見の間.png orcus_audience_hall [確かめ用の画像を出すフォルダ] [--floor=0.72]
    --floor: 床を探す帯（絵の上からの割合。ここより下が床。絵ごとに合わせる）
出力: unity-prototype/Assets/Art/Stage/<名前>/（background.png・occlusion.png・stage.json）
モデルは ~/.cache/depth-anything/ に置く（リポジトリには入れない）。
"""
from pathlib import Path
import json
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

PROJECT = Path(__file__).resolve().parents[1]
MODELS = Path.home() / ".cache" / "depth-anything"
FOV_Y = 60.0          # 仮の画角（奥行きだけでは決まらない。キャラの大きさは Unity 側でも調整できる）
CELL = 0.1            # 歩ける所の表のマス（メートル）
STEP_MAX = 0.28       # 一歩で上がれる高さ（階段の一段より少し大きい）
OCCLUDE_BIAS = 0.25   # 背景の物がキャラを隠すときの余裕（足元が床に埋まらないように）


def estimate_depth(image, model):
    """奥行き（メートル・カメラの前方向の距離）。入力は短い辺 518 前後・14 の倍数"""
    w, h = image.size
    scale = 518 / min(w, h)
    iw, ih = int(round(w * scale / 14)) * 14, int(round(h * scale / 14)) * 14
    x = np.asarray(image.convert("RGB").resize((iw, ih), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
    out = session.run(None, {session.get_inputs()[0].name: x})[0]
    return np.asarray(Image.fromarray(np.squeeze(out).astype(np.float32)).resize((w, h), Image.BILINEAR))


def vanishing_point(gray, floor_top):
    """床の斜めの線が集まる点（絵の下の床の部分の縁の向きから投票）"""
    h, w = gray.shape
    gx, gy = ndimage.sobel(gray, 1), ndimage.sobel(gray, 0)
    mag = np.hypot(gx, gy)
    ys, xs = np.mgrid[0:h, 0:w]
    band = ys > floor_top
    mask = band & (mag > np.percentile(mag[band], 90))
    a = np.arctan2(gy, gx)[mask]
    py, px = ys[mask], xs[mask]
    dx, dy = -np.sin(a), np.cos(a)
    ok = (np.abs(dy) > .25) & (np.abs(dx) > .25)
    py, px, dx, dy = py[ok], px[ok], dx[ok], dy[ok]
    pick = np.random.default_rng(0).choice(len(py), min(20000, len(py)), replace=False)
    py, px, dx, dy = py[pick], px[pick], dx[pick], dy[pick]
    best = (-1, w // 2, h // 2)
    for vy in range(int(h * .25), int(floor_top), 4):
        for vx in range(int(w * .3), int(w * .7), 4):
            vx_, vy_ = vx - px, vy - py
            n = np.hypot(vx_, vy_) + 1e-6
            s = int((np.abs(vx_ * dx + vy_ * dy) / n > .995).sum())
            if s > best[0]:
                best = (s, vx, vy)
    return best[1], best[2]


def fit_plane(points, iters=400, tol=0.04, seed=0):
    """RANSAC で床の面（上向きの法線 n と d。床の上の点は n·P + d = 0）"""
    rng = np.random.default_rng(seed)
    best, best_count = None, -1
    for _ in range(iters):
        p = points[rng.choice(len(points), 3, replace=False)]
        nrm = np.cross(p[1] - p[0], p[2] - p[0])
        if np.linalg.norm(nrm) < 1e-9:
            continue
        nrm = nrm / np.linalg.norm(nrm)
        if nrm[1] < 0:
            nrm = -nrm
        if nrm[1] < .5:
            continue
        d = -nrm @ p[0]
        count = int((np.abs(points @ nrm + d) < tol).sum())
        if count > best_count:
            best, best_count = (nrm, d), count
    nrm, d = best
    inl = points[np.abs(points @ nrm + d) < tol]
    c = inl.mean(0)
    _, _, vt = np.linalg.svd(inl - c)
    nrm = vt[2] if vt[2][1] > 0 else -vt[2]
    return nrm, -nrm @ c


def find_lights(image, depth_to_world, max_lights=24):
    """絵の中の光（炎・魔法の灯り・ステンドグラスなど）: 明るくて色のついた所のかたまり。
    場所は奥行きから3Dに、色はかたまりの平均、強さは大きさと明るさから（原作者 2026-10-07: 背景になじませる仕組み）"""
    rgb = np.asarray(image, dtype=np.float32) / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    glow = (mx > .78) & (sat > .35)
    glow = ndimage.binary_opening(glow, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(glow, iterations=3))
    lights = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None:
            continue
        m = (lab[sl] == i + 1) & glow[sl]
        area = int(m.sum())
        if area < 25:
            continue
        ys, xs = np.nonzero(m)
        ys, xs = ys + sl[0].start, xs + sl[1].start
        col = rgb[ys, xs].mean(0)
        col = col / max(col.max(), 1e-6)
        pos = np.median(depth_to_world[ys, xs], axis=0)
        if pos[1] < .3:   # 床の高さ＝床に映った光（反射）。光の元ではない
            continue
        lights.append({"position": [round(float(v), 3) for v in pos], "color": [round(float(v), 3) for v in col],
                       "power": round(float(np.sqrt(area) * mx[ys, xs].mean() / 10), 3),
                       "pixel": [int(xs.mean()), int(ys.mean())], "area": area})
    lights.sort(key=lambda l: -l["power"])
    return lights[:max_lights]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    src, name = PROJECT / args[0], args[1]
    out = PROJECT / "unity-prototype" / "Assets" / "Art" / "Stage" / name
    prev = Path(args[2]) if len(args) > 2 else out
    floor_top = float(opts.get("floor", .72))   # 床を探す帯（絵の上からの割合。ここより下）
    out.mkdir(parents=True, exist_ok=True)
    image = Image.open(src).convert("RGB")
    w, h = image.size
    depth = estimate_depth(image, MODELS / "depth_anything_v2_vits_indoor_dynamic.onnx")
    gray = np.asarray(image.convert("L"), dtype=np.float32)

    # 1回目: 床の帯を大まかに（絵の下 30%）。消失点 → カメラの中心
    cx, cy = vanishing_point(gray, h * (floor_top - .02))
    f = (h / 2) / np.tan(np.radians(FOV_Y) / 2)
    ys, xs = np.mgrid[0:h, 0:w]
    P = np.stack([(xs - cx) / f * depth, -(ys - cy) / f * depth, depth], -1)   # カメラから見た点（x右・y上・z前）
    sub = P[::4, ::4]
    region = (ys[::4, ::4] > h * floor_top) & (xs[::4, ::4] > w * .15) & (xs[::4, ::4] < w * .85)
    n, d = fit_plane(sub[region].reshape(-1, 3))
    print(f"絵 {w}x{h}  消失点 ({cx},{cy})  画角 {FOV_Y}°  カメラの高さ {d:.2f} m  床の傾き {np.degrees(np.arccos(n[1])):.1f}°")

    # 世界の向き: 上＝床の法線、前＝カメラの前を床に沿わせた向き。カメラは (0, 高さ, 0)
    up = n
    fwd = np.array([0, 0, 1.0]) - up * up[2]
    fwd /= np.linalg.norm(fwd)
    right = np.cross(up, fwd)
    to_world = np.stack([right, up, fwd])            # 行: 世界の x・y・z
    W = P @ to_world.T
    W[..., 1] += d                                    # 床が y=0

    # 歩ける面: 上を向いた面（法線を近くの点から）
    gxw = np.gradient(W, axis=1)
    gyw = np.gradient(W, axis=0)
    nrm = np.cross(gxw, gyw)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True) + 1e-9
    nrm *= np.sign(nrm[..., 1:2] + 1e-9)
    upward = nrm[..., 1] > .80
    surface = upward & (W[..., 1] > -.3) & (W[..., 1] < 3.0)

    # 高さの表
    xs_w, zs_w = W[..., 0][surface], W[..., 2][surface]
    x0, x1 = np.percentile(W[..., 0][surface], [1, 99])
    z0, z1 = np.percentile(W[..., 2][surface], [1, 99])
    nx, nz = int((x1 - x0) / CELL) + 1, int((z1 - z0) / CELL) + 1
    ix = np.clip(((xs_w - x0) / CELL).astype(int), 0, nx - 1)
    iz = np.clip(((zs_w - z0) / CELL).astype(int), 0, nz - 1)
    hs = W[..., 1][surface]
    sums = np.zeros((nz, nx)); counts = np.zeros((nz, nx))
    np.add.at(sums, (iz, ix), hs); np.add.at(counts, (iz, ix), 1)
    height = np.where(counts > 0, sums / np.maximum(counts, 1), np.nan)
    have = counts > 0
    # 穴（燭台の足元の陰など）を、近くの高さで埋める
    filled = ndimage.binary_closing(have, iterations=4)
    _, idx = ndimage.distance_transform_edt(~have, return_indices=True)
    height = np.where(have, height, height[idx[0], idx[1]])
    # 床（高さ 0 付近）から、一歩で上がれる高さでつながっている所だけを歩ける所に
    floorish = filled & (np.abs(height) < .12)
    lab, _ = ndimage.label(floorish)
    main = lab == np.bincount(lab.ravel()[lab.ravel() > 0]).argmax()
    walk = main.copy()
    for _ in range(400):
        grow = ndimage.binary_dilation(walk) & filled & ~walk
        if not grow.any():
            break
        cand = np.argwhere(grow)
        added = False
        for (r, c) in cand:
            nb = height[max(r - 1, 0):r + 2, max(c - 1, 0):c + 2][walk[max(r - 1, 0):r + 2, max(c - 1, 0):c + 2]]
            if nb.size and np.min(np.abs(nb - height[r, c])) < STEP_MAX * .5:
                walk[r, c] = True; added = True
        if not added:
            break
    walk = ndimage.binary_opening(walk, iterations=1)   # 細いすき間は歩かない

    # 前後関係の奥行き: 歩ける面の点は奥へ（隠さない）、それ以外は少し奥にずらして書く
    px_ix = np.clip(((W[..., 0] - x0) / CELL).astype(int), 0, nx - 1)
    px_iz = np.clip(((W[..., 2] - z0) / CELL).astype(int), 0, nz - 1)
    on_walk = surface & walk[px_iz, px_ix] & (np.abs(W[..., 1] - height[px_iz, px_ix]) < .15)
    occ = depth + OCCLUDE_BIAS
    dmax = float(depth.max()) + OCCLUDE_BIAS + 1
    occ = np.where(on_walk, dmax, occ)
    Image.fromarray((np.clip(occ / dmax, 0, 1) * 65535).astype(np.uint16)).save(out / "occlusion.png")
    image.save(out / "background.png")

    # 光は、歩ける所のまわり（左右・奥に 3 m まで、高さ 5 m まで）だけ。空・遠くの景色の明るい所は光の元にしない
    wx, wz = np.nonzero(walk.T)
    lo_x, hi_x = x0 + wx.min() * CELL - 3, x0 + wx.max() * CELL + 3
    lo_z, hi_z = z0 + wz.min() * CELL - 3, z0 + wz.max() * CELL + 3
    lights = [l for l in find_lights(image, W, max_lights=60)
              if lo_x <= l["position"][0] <= hi_x and lo_z <= l["position"][2] <= hi_z and l["position"][1] <= 5.0][:24]
    print(f"光 {len(lights)} 個（いちばん強い: 色 {lights[0]['color'] if lights else '-'} 場所 {lights[0]['position'] if lights else '-'}）")
    cam_fwd = to_world @ np.array([0, 0, 1.0])
    cam_up = to_world @ np.array([0, 1.0, 0])
    stage = {
        "note": "stage_from_image.py が作る。手で直さない",
        "source": sys.argv[1], "size": [w, h], "fovY": FOV_Y, "principal": [int(cx), int(cy)],
        "cameraHeight": float(d), "cameraForward": cam_fwd.tolist(), "cameraUp": cam_up.tolist(),
        "occlusionMax": dmax,
        "lights": [{k: l[k] for k in ("position", "color", "power")} for l in lights],
        "grid": {"x0": float(x0), "z0": float(z0), "cell": CELL, "nx": nx, "nz": nz,
                 "height": [round(float(v), 3) for v in np.nan_to_num(height, nan=0).ravel()],
                 "walk": "".join("1" if v else "0" for v in walk.ravel())},
    }
    (out / "stage.json").write_text(json.dumps(stage, ensure_ascii=False), encoding="utf-8")
    print(f"歩ける所の表 {nx}x{nz}（{CELL} m）  歩けるマス {int(walk.sum())}  高さ {np.nanmin(height[walk]):.2f}〜{np.nanmax(height[walk]):.2f} m")

    # 確かめ用: 歩ける所（緑）と、隠す物として扱う所（そのまま）
    vis = np.asarray(image, dtype=np.float32) * .55
    vis[on_walk] = vis[on_walk] * .4 + np.array([60, 200, 120]) * .6
    for l in lights:   # 拾った光を黄色の丸で
        px_, py_ = l["pixel"]; r = int(6 + l["power"] * 2)
        yy, xx = np.ogrid[:h, :w]
        ring = np.abs(np.hypot(xx - px_, yy - py_) - r) < 2
        vis[ring] = [255, 230, 80]
    Image.fromarray(vis.astype(np.uint8)).save(prev / f"{name}_walk_check.jpg", quality=85)
    top = np.zeros((nz, nx, 3), np.uint8)
    hn = np.clip(height / max(.5, np.nanmax(height[walk])), 0, 1)
    top[walk] = (np.stack([60 + 195 * hn, 200 - 120 * hn, 120 * np.ones_like(hn)], -1)[walk]).astype(np.uint8)
    Image.fromarray(top[::-1]).resize((nx * 4, nz * 4), Image.NEAREST).save(prev / f"{name}_walk_top.png")
    print("書き出し:", out)


if __name__ == "__main__":
    main()

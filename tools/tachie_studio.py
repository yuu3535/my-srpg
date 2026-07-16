#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
立ち絵スタジオ — 自動透過 ＋ タップお直し 統合ツール

使い方:
  python tachie_studio.py
  → ブラウザが自動で開く(http://localhost:8787)
  → 白背景の立ち絵をドロップ → 自動透過 → そのままタップでお直し → PNG保存

処理エンジンは v5 と同じ:
  isnet-anime分離 / 賢い穴埋め(隙間は透過・衣装は保護) /
  輪郭スムージング / 縁取り＋境界の色ムラ塗り潰し

必要ライブラリ:
  pip install onnxruntime-directml pillow numpy scipy
  （初回はisnet-animeモデル約176MBを自動DL）
"""
import io
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import numpy as np
from PIL import Image
from scipy import ndimage

PORT = 8787
_session = None
_session_lock = threading.Lock()


def get_session():
    global _session
    with _session_lock:
        if _session is None:
            from tachie_clear_v5 import create_session

            print('モデル読込中…（初回はDLに少し時間がかかります）')
            _session = create_session()
            print('モデル準備完了')
    return _session


def hex_to_rgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))


def process(img: Image.Image, shrink=0.0, smooth=1.5, edge_cover=1.0,
            outline=0.5, inner=0.5, inner_alpha=49,
            line_color='#1e2440', seg_threshold=100,
            keep_detached=True) -> Image.Image:
    """v5と同一の自動透過パイプライン"""
    session = get_session()
    orig = np.asarray(img.convert('RGB'), dtype=np.float32)

    # 1) AIセグメンテーション(アニメ特化)
    seg = np.asarray(session.predict_mask(img), dtype=np.float32)

    # 2) 賢い穴埋め: 純白の穴=隙間として開放 / 有色の穴=衣装内部として保護
    dist_w = 255.0 - orig.min(axis=2)
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
    if shrink > 0:
        solid = ndimage.distance_transform_edt(solid) > shrink
    if smooth > 0:
        solid = ndimage.gaussian_filter(solid.astype(np.float32), smooth) > 0.5
    lbl2, n2 = ndimage.label(solid)
    if n2 > 1 and not keep_detached:
        sizes = ndimage.sum(solid, lbl2, range(1, n2 + 1))
        solid = lbl2 == (np.argmax(sizes) + 1)

    # 3) 輪郭1pxアンチエイリアス + 白フチ除去
    d_out = ndimage.distance_transform_edt(~solid)
    d_in = ndimage.distance_transform_edt(solid)
    sd = np.where(solid, d_in, -d_out)
    alpha = np.clip((sd + 0.5) * 255, 0, 255)
    rgb = orig.copy()
    a = alpha / 255.0
    semi = (a > 0.02) & (a < 0.98)
    if semi.any():
        aa = a[semi][:, None]
        rgb[semi] = np.clip((rgb[semi] - (1 - aa) * 255.0) / np.maximum(aa, 0.25), 0, 255)

    # 4) 縁取り(外) + 色ムラ塗り潰し(内) + 馴染ませグラデ
    lc = np.array(hex_to_rgb(line_color), dtype=np.float32)
    if outline > 0:
        ring = (~solid) & (d_out <= outline + 0.5)
        rgb[ring] = lc
        alpha[ring] = np.maximum(alpha[ring],
                                 np.clip(outline + 0.5 - d_out[ring], 0, 1) * 255)
    if edge_cover > 0:
        band_full = solid & (d_in <= edge_cover)
        rgb[band_full] = lc
    if inner > 0 and inner_alpha > 0:
        band_soft = solid & (d_in > edge_cover) & (d_in <= edge_cover + inner + 0.5)
        k = (inner_alpha / 100.0) * np.clip(edge_cover + inner + 0.5 - d_in[band_soft], 0, 1)
        rgb[band_soft] = rgb[band_soft] * (1 - k[:, None]) + lc * k[:, None]

    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA')


# ============================================================ HTTP
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if urlparse(self.path).path == '/':
            body = PAGE.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/process':
            self.send_error(404)
            return
        try:
            q = parse_qs(u.query)
            def num(name, default):
                return float(q.get(name, [default])[0])
            length = int(self.headers['Content-Length'])
            data = self.rfile.read(length)
            img = Image.open(io.BytesIO(data))
            out = process(
                img,
                shrink=num('shrink', 0),
                smooth=num('smooth', 1.5),
                edge_cover=num('edge_cover', 1.0),
                outline=num('outline', 0.5),
                line_color=q.get('line_color', ['#1e2440'])[0],
                keep_detached=q.get('keep_detached', ['1'])[0] != '0',
            )
            buf = io.BytesIO()
            out.save(buf, 'PNG')
            body = buf.getvalue()
            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            msg = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)


# ============================================================ UI
PAGE = r'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>立ち絵スタジオ — 自動透過＋お直し</title>
<style>
  :root{
    --bg:#14151d; --panel:#1d1f2b; --panel2:#252838;
    --gold:#c9a35a; --gold-dim:#8a7344; --star:#6b8fd4;
    --text:#e8e6df; --muted:#9a97a8; --line:#33364a;
    --restore:#7dbf8e;
  }
  *{box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent;}
  html,body{height:100%; overflow:hidden;}
  body{
    background:var(--bg); color:var(--text);
    font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;
    display:flex; flex-direction:column;
  }
  header{
    display:flex; align-items:baseline; gap:10px;
    padding:10px 14px 8px; border-bottom:1px solid var(--line); flex:none;
  }
  header h1{
    font-family:"Hiragino Mincho ProN","Yu Mincho",serif;
    font-size:17px; font-weight:600; letter-spacing:.14em; color:var(--gold);
  }
  header .sub{font-size:11px; color:var(--muted);}
  #bar{
    flex:none; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
    padding:8px 12px; background:var(--panel); border-bottom:1px solid var(--line);
  }
  .seg{display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden;}
  .seg button{
    background:transparent; color:var(--muted); border:none;
    padding:7px 12px; font-size:12.5px; cursor:pointer; white-space:nowrap;
  }
  .seg button.on{background:var(--gold); color:#1a1408; font-weight:600;}
  .seg button.on.green{background:var(--restore); color:#0d1a10;}
  .ctrl{display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--muted);}
  .ctrl input[type=range]{width:88px; accent-color:var(--gold);}
  .ctrl output{color:var(--text); min-width:2em; text-align:right; font-variant-numeric:tabular-nums;}
  .btn{
    background:var(--panel2); color:var(--text); border:1px solid var(--line);
    border-radius:8px; padding:7px 12px; font-size:12.5px; cursor:pointer; white-space:nowrap;
  }
  .btn:disabled{opacity:.35; cursor:default;}
  .btn.gold{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:600;}
  .spacer{flex:1;}

  /* 自動処理パラメーター行 */
  #autoBar{
    flex:none; display:flex; flex-wrap:wrap; gap:10px; align-items:center;
    padding:7px 12px; background:#191b26; border-bottom:1px solid var(--line);
    font-size:11.5px; color:var(--muted);
  }
  #autoBar .tag{color:var(--gold); letter-spacing:.08em; font-size:11px;}
  #autoBar input[type=color]{
    width:26px; height:22px; border:1px solid var(--line); border-radius:5px;
    background:none; padding:0; cursor:pointer;
  }

  #stage{flex:1; position:relative; overflow:hidden; touch-action:none; background:#0e0f15;}
  #stage.bg-dark #canvasWrap{background:#232028;}
  #stage.bg-checker #canvasWrap{
    background:repeating-conic-gradient(#c8c8c8 0% 25%, #a0a0a0 0% 50%) 0 0/24px 24px;
  }
  #stage.bg-white #canvasWrap{background:#fff;}
  #canvasWrap{
    position:absolute; transform-origin:0 0;
    box-shadow:0 0 0 1px var(--line), 0 12px 40px rgba(0,0,0,.5);
  }
  canvas{display:block; image-rendering:pixelated;}
  #brushCursor{
    position:absolute; border:1.5px solid var(--gold); border-radius:50%;
    pointer-events:none; display:none; transform:translate(-50%,-50%);
    mix-blend-mode:difference;
  }

  /* フローティング戻すボタン: 常に親指の届く場所に */
  #floatUndo{
    position:absolute; left:14px; bottom:14px; z-index:5;
    display:flex; gap:8px;
  }
  #floatUndo button{
    background:rgba(29,31,43,.92); color:var(--text);
    border:1.5px solid var(--gold-dim); border-radius:24px;
    padding:12px 20px; font-size:14px; font-weight:600; cursor:pointer;
    box-shadow:0 4px 16px rgba(0,0,0,.45);
    backdrop-filter:blur(4px);
  }
  #floatUndo button:disabled{opacity:.3;}
  #floatUndo button:active{transform:scale(.95);}

  #drop{
    position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:14px; text-align:center;
    color:var(--muted); font-size:14px; line-height:1.9; padding:20px;
  }
  #drop .star{font-size:34px; color:var(--star);}
  #drop.hidden{display:none;}
  #drop strong{color:var(--gold);}
  #drop.dragover{background:rgba(107,143,212,.08); outline:2px dashed var(--star); outline-offset:-14px;}

  /* 処理中オーバーレイ */
  #busy{
    position:absolute; inset:0; z-index:9; display:none;
    background:rgba(14,15,21,.82); backdrop-filter:blur(2px);
    flex-direction:column; align-items:center; justify-content:center; gap:16px;
  }
  #busy.show{display:flex;}
  #busy .orb{
    width:44px; height:44px; border-radius:50%;
    border:3px solid var(--line); border-top-color:var(--gold);
    animation:spin 1s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
  #busy p{color:var(--muted); font-size:13px; letter-spacing:.05em;}

  #status{
    flex:none; display:flex; gap:14px; align-items:center;
    padding:6px 14px; font-size:11px; color:var(--muted);
    background:var(--panel); border-top:1px solid var(--line);
  }
  #status b{color:var(--gold);}
  #toast{
    position:absolute; left:50%; bottom:70px; transform:translateX(-50%);
    background:var(--panel2); border:1px solid var(--gold-dim); color:var(--text);
    padding:8px 16px; border-radius:20px; font-size:12.5px;
    opacity:0; transition:opacity .25s; pointer-events:none; white-space:nowrap; z-index:8;
  }
  #toast.show{opacity:1;}
  input[type=file]{display:none;}
  @media (max-width:640px){
    .ctrl input[type=range]{width:60px;}
    header .sub{display:none;}
    #autoBar{gap:7px;}
  }
</style>
</head>
<body>
<header>
  <h1>立ち絵スタジオ</h1>
  <span class="sub">自動透過 → タップお直し → 保存 を、ひとつの画面で</span>
</header>

<div id="autoBar">
  <span class="tag">自動透過</span>
  <label class="ctrl">縁色 <input type="color" id="lineColor" value="#1e2440"></label>
  <label class="ctrl">縁太さ(外)
    <input type="range" id="outlineP" min="0" max="30" value="5">
    <output id="outlineOut">0.5</output>
  </label>
  <label class="ctrl">縁の食い込み
    <input type="range" id="edgeCover" min="0" max="50" value="10">
    <output id="edgeCoverOut">1.0</output>
  </label>
  <label class="ctrl">輪郭平滑
    <input type="range" id="smoothP" min="0" max="40" value="15">
    <output id="smoothOut">1.5</output>
  </label>
  <label class="ctrl">収縮
    <input type="range" id="shrinkP" min="0" max="40" value="0">
    <output id="shrinkOut">0</output>
  </label>
  <label class="ctrl">
    <input type="checkbox" id="keepDetached" checked>
    離れたパーツを保持
  </label>
  <div class="seg" id="presetSeg">
    <button data-preset="soft">標準</button>
    <button data-preset="lineart">線画仕上げ</button>
    <button data-preset="bold">線画・太</button>
  </div>
  <button class="btn" id="rerunBtn" disabled>この設定で再処理</button>
</div>

<div id="bar">
  <div class="seg" id="modeSeg">
    <button data-mode="wand" class="on">魔法の杖</button>
    <button data-mode="erase">消しゴム</button>
    <button data-mode="restore">復元</button>
    <button data-mode="pan">移動</button>
  </div>
  <label class="ctrl" id="tolCtrl">許容量
    <input type="range" id="tol" min="1" max="80" value="24">
    <output id="tolOut">24</output>
  </label>
  <label class="ctrl" id="sizeCtrl" style="display:none">サイズ
    <input type="range" id="size" min="2" max="80" value="16">
    <output id="sizeOut">16</output>
  </label>
  <div class="seg" id="bgSeg">
    <button data-bg="dark" class="on">濃色</button>
    <button data-bg="checker">市松</button>
    <button data-bg="white">白</button>
  </div>
  <span class="spacer"></span>
  <button class="btn" id="openBtn">画像を開く</button>
  <button class="btn gold" id="saveBtn" disabled>PNG保存</button>
</div>

<div id="stage" class="bg-dark">
  <div id="canvasWrap"><canvas id="cv"></canvas></div>
  <div id="brushCursor"></div>
  <div id="floatUndo">
    <button id="undoBtn" disabled>⟲ 戻す</button>
    <button id="redoBtn" disabled>⟳</button>
  </div>
  <div id="drop">
    <div class="star">✦</div>
    <div>
      白背景の立ち絵をここに<strong>ドロップ</strong><br>
      自動で透過してから、お直しモードに入ります<br>
      <span style="font-size:12px">貼り付け（Ctrl+V）にも対応 ・ 透過済みPNGを直接開いてもOK</span>
    </div>
  </div>
  <div id="busy"><div class="orb"></div><p id="busyMsg">自動透過を実行中…</p></div>
  <div id="toast"></div>
</div>

<div id="status">
  <span id="stZoom">拡大 —</span>
  <span id="stInfo">画像未読込</span>
  <span class="spacer" style="flex:1"></span>
  <span>ホイール/ピンチで拡大 ・ 2本指または「移動」でパン ・ Ctrl+Zでも戻せます</span>
</div>

<input type="file" id="file" accept="image/png,image/jpeg,image/webp,image/*">

<script>
'use strict';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d', {willReadFrequently:true});
const wrap = document.getElementById('canvasWrap');
const stage = document.getElementById('stage');
const drop = document.getElementById('drop');
const brushCursor = document.getElementById('brushCursor');
const busy = document.getElementById('busy');

let img = null, baseAlpha = null, W = 0, H = 0;
let fileName = 'tachie';
let rawBlob = null;           // 元画像（再処理用に保持）
let view = {x:40, y:20, s:1};
let mode = 'wand', tol = 24, brush = 16;
const undoStack = [], redoStack = [];
const MAX_UNDO = 40;

/* ---------- 読み込み → 自動透過 ---------- */
const fileInput = document.getElementById('file');
document.getElementById('openBtn').onclick = () => fileInput.click();
drop.onclick = () => fileInput.click();
fileInput.onchange = e => { if(e.target.files[0]) intake(e.target.files[0]); };
['dragover','dragleave','drop'].forEach(ev => stage.addEventListener(ev, e => {
  e.preventDefault();
  drop.classList.toggle('dragover', ev==='dragover');
  if(ev==='drop' && e.dataTransfer.files[0]) intake(e.dataTransfer.files[0]);
}));
window.addEventListener('paste', e => {
  for(const item of e.clipboardData.items)
    if(item.type.startsWith('image/')) return intake(item.getAsFile());
});

async function intake(file){
  fileName = (file.name || 'tachie').replace(/\.[^.]+$/, '');
  rawBlob = file;
  document.getElementById('rerunBtn').disabled = false;
  // 既に透過済み(アルファあり)ならそのまま開く選択肢もあるが、
  // シンプルに: PNGでアルファに0が含まれていれば「処理済み」とみなし直接開く
  const hasAlpha = await blobHasTransparency(file);
  if(hasAlpha){
    await openIntoEditor(file);
    toast('透過済み画像として開きました（再処理も可能）');
  } else {
    await autoProcess();
  }
}

async function blobHasTransparency(blob){
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  const s = Math.min(1, 256/Math.max(bmp.width,bmp.height));
  c.width = Math.max(1,bmp.width*s|0); c.height = Math.max(1,bmp.height*s|0);
  const cx = c.getContext('2d');
  cx.drawImage(bmp,0,0,c.width,c.height);
  const d = cx.getImageData(0,0,c.width,c.height).data;
  for(let i=3;i<d.length;i+=4) if(d[i]<250) return true;
  return false;
}

function params(){
  return {
    line_color: document.getElementById('lineColor').value,
    edge_cover: (+document.getElementById('edgeCover').value/10).toFixed(1),
    outline: (+document.getElementById('outlineP').value/10).toFixed(1),
    smooth: (+document.getElementById('smoothP').value/10).toFixed(1),
    shrink: (+document.getElementById('shrinkP').value/10).toFixed(1),
    keep_detached: document.getElementById('keepDetached').checked ? '1' : '0',
  };
}
/* プリセット: 白ギザが残るときは線画仕上げへ */
const PRESETS = {
  soft:    {outlineP:5,  edgeCover:10},  // 外0.5/内1.0
  lineart: {outlineP:10, edgeCover:25},  // 外1.0/内2.5
  bold:    {outlineP:15, edgeCover:35},  // 外1.5/内3.5 (白ギザ完全消滅)
};
document.getElementById('presetSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  const p = PRESETS[b.dataset.preset];
  for(const [id,v] of Object.entries(p)){
    const el = document.getElementById(id);
    el.value = v; el.dispatchEvent(new Event('input'));
  }
  [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x===b));
  if(rawBlob) autoProcess();
});
document.getElementById('rerunBtn').onclick = autoProcess;

async function autoProcess(){
  if(!rawBlob) return;
  busy.classList.add('show');
  document.getElementById('busyMsg').textContent = '自動透過を実行中…（初回はモデル読込で少し待ちます）';
  try{
    const p = params();
    const qs = new URLSearchParams(p).toString();
    const res = await fetch('/process?' + qs, {method:'POST', body: rawBlob});
    if(!res.ok){
      const err = await res.json().catch(()=>({error:res.statusText}));
      throw new Error(err.error);
    }
    const blob = await res.blob();
    await openIntoEditor(blob);
    toast('自動透過が完了。気になる所をタップでお直し');
  }catch(err){
    toast('処理エラー: ' + err.message);
  }finally{
    busy.classList.remove('show');
  }
}

function openIntoEditor(blob){
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => {
      W = im.naturalWidth; H = im.naturalHeight;
      cv.width = W; cv.height = H;
      ctx.clearRect(0,0,W,H);
      ctx.drawImage(im, 0, 0);
      img = ctx.getImageData(0, 0, W, H);
      baseAlpha = new Uint8ClampedArray(W*H);
      for(let i=0;i<W*H;i++) baseAlpha[i] = img.data[i*4+3];
      undoStack.length = redoStack.length = 0;
      updateUndoBtns();
      drop.classList.add('hidden');
      document.getElementById('saveBtn').disabled = false;
      fitView(); paint();
      setInfo(`${W}×${H}px`);
      URL.revokeObjectURL(url);
      resolve();
    };
    im.src = url;
  });
}

/* ---------- 描画・ビュー ---------- */
function paint(){ ctx.putImageData(img, 0, 0); }
function applyView(){
  wrap.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`;
  document.getElementById('stZoom').textContent = `拡大 ${(view.s*100)|0}%`;
}
function fitView(){
  const r = stage.getBoundingClientRect();
  view.s = Math.min((r.width-40)/W, (r.height-40)/H, 1);
  view.x = (r.width - W*view.s)/2;
  view.y = (r.height - H*view.s)/2;
  applyView();
}
function toImage(cx_, cy_){
  const r = stage.getBoundingClientRect();
  return {x: Math.floor((cx_-r.left-view.x)/view.s), y: Math.floor((cy_-r.top-view.y)/view.s)};
}

/* ---------- アンドゥ（差分方式） ---------- */
function pushUndo(idxArr, oldArr, label){
  undoStack.push({idx:idxArr, alpha:oldArr, label});
  if(undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateUndoBtns();
}
function applyDiff(diff, useOld){
  const d = img.data;
  const cur = new Uint8ClampedArray(diff.idx.length);
  for(let k=0;k<diff.idx.length;k++){
    const i = diff.idx[k];
    cur[k] = d[i*4+3];
    d[i*4+3] = useOld ? diff.alpha[k] : diff.newAlpha[k];
  }
  return cur;
}
document.getElementById('undoBtn').onclick = () => {
  const diff = undoStack.pop(); if(!diff) return;
  diff.newAlpha = applyDiff(diff, true);
  redoStack.push(diff); paint(); updateUndoBtns();
  toast(`${diff.label} を取り消し`);
};
document.getElementById('redoBtn').onclick = () => {
  const diff = redoStack.pop(); if(!diff) return;
  applyDiff(diff, false);
  undoStack.push(diff); paint(); updateUndoBtns();
};
function updateUndoBtns(){
  document.getElementById('undoBtn').disabled = !undoStack.length;
  document.getElementById('redoBtn').disabled = !redoStack.length;
}

/* ---------- 魔法の杖 ---------- */
function wand(px, py){
  if(px<0||py<0||px>=W||py>=H) return;
  const d = img.data;
  const seed = py*W+px;
  if(d[seed*4+3] === 0){ toast('そこはもう透明です'); return; }
  const sr=d[seed*4], sg=d[seed*4+1], sb=d[seed*4+2];
  const tol2 = tol*tol*3;
  const visited = new Uint8Array(W*H);
  const stack = [seed]; visited[seed]=1;
  const hit = [];
  while(stack.length){
    const i = stack.pop();
    const dr=d[i*4]-sr, dg=d[i*4+1]-sg, db=d[i*4+2]-sb;
    if(dr*dr+dg*dg+db*db > tol2 || d[i*4+3]===0) continue;
    hit.push(i);
    const x=i%W, y=(i/W)|0;
    if(x>0   && !visited[i-1]){visited[i-1]=1; stack.push(i-1);}
    if(x<W-1 && !visited[i+1]){visited[i+1]=1; stack.push(i+1);}
    if(y>0   && !visited[i-W]){visited[i-W]=1; stack.push(i-W);}
    if(y<H-1 && !visited[i+W]){visited[i+W]=1; stack.push(i+W);}
  }
  if(!hit.length){ toast('近い色が見つかりません（許容量を上げてみて）'); return; }
  const mark = new Uint8Array(W*H);
  for(const i of hit) mark[i]=1;
  const idx = new Uint32Array(hit.length);
  const old = new Uint8ClampedArray(hit.length);
  for(let k=0;k<hit.length;k++){
    const i = hit[k];
    idx[k]=i; old[k]=d[i*4+3];
    const x=i%W, y=(i/W)|0;
    const edge = (x>0&&!mark[i-1])||(x<W-1&&!mark[i+1])||(y>0&&!mark[i-W])||(y<H-1&&!mark[i+W]);
    d[i*4+3] = edge ? Math.min(d[i*4+3], 70) : 0;
  }
  pushUndo(idx, old, '魔法の杖');
  paint();
  toast(`${hit.length}px を透過（⟲で戻せます）`);
}

/* ---------- ブラシ ---------- */
let strokeIdx=null, strokeOld=null, strokeMark=null;
function beginStroke(){ strokeIdx=[]; strokeOld=[]; strokeMark=new Uint8Array(W*H); }
function stampBrush(px, py, restore){
  const d = img.data;
  const r = brush/2, r2 = r*r;
  const x0=Math.max(0,Math.floor(px-r)), x1=Math.min(W-1,Math.ceil(px+r));
  const y0=Math.max(0,Math.floor(py-r)), y1=Math.min(H-1,Math.ceil(py+r));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const dx=x-px, dy=y-py;
    if(dx*dx+dy*dy > r2) continue;
    const i = y*W+x;
    if(strokeMark[i]) continue;
    strokeMark[i]=1;
    strokeIdx.push(i); strokeOld.push(d[i*4+3]);
    d[i*4+3] = restore ? baseAlpha[i] : 0;
  }
  paint();
}
function endStroke(label){
  if(strokeIdx && strokeIdx.length)
    pushUndo(Uint32Array.from(strokeIdx), Uint8ClampedArray.from(strokeOld), label);
  strokeIdx = strokeOld = strokeMark = null;
}

/* ---------- 入力 ---------- */
const pointers = new Map();
let pinchBase=null, panBase=null, drawing=false;

stage.addEventListener('pointerdown', e => {
  if(!img) return;
  if(e.target.closest('#floatUndo')) return;
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pointers.size === 2){
    if(drawing){ endStroke(mode==='erase'?'消しゴム':'復元'); drawing=false; }
    const [a,b] = [...pointers.values()];
    pinchBase = {d:Math.hypot(a.x-b.x,a.y-b.y), cx:(a.x+b.x)/2, cy:(a.y+b.y)/2, view:{...view}};
    return;
  }
  if(mode==='pan'){
    panBase = {x:e.clientX, y:e.clientY, view:{...view}};
  } else if(mode==='wand'){
    const p = toImage(e.clientX, e.clientY);
    wand(p.x, p.y);
  } else {
    drawing = true; beginStroke();
    const p = toImage(e.clientX, e.clientY);
    stampBrush(p.x, p.y, mode==='restore');
  }
});
stage.addEventListener('pointermove', e => {
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if((mode==='erase'||mode==='restore') && img){
    const r = stage.getBoundingClientRect();
    brushCursor.style.display='block';
    brushCursor.style.left = e.clientX - r.left + 'px';
    brushCursor.style.top  = e.clientY - r.top + 'px';
    brushCursor.style.width = brushCursor.style.height = brush*view.s + 'px';
  } else brushCursor.style.display='none';

  if(pointers.size===2 && pinchBase){
    const [a,b] = [...pointers.values()];
    const d = Math.hypot(a.x-b.x, a.y-b.y);
    const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
    const scale = Math.min(16, Math.max(.05, pinchBase.view.s * d/pinchBase.d));
    const k = scale/pinchBase.view.s;
    const r = stage.getBoundingClientRect();
    view.s = scale;
    view.x = (cx-r.left) - k*((pinchBase.cx-r.left) - pinchBase.view.x);
    view.y = (cy-r.top)  - k*((pinchBase.cy-r.top)  - pinchBase.view.y);
    applyView();
    return;
  }
  if(panBase){
    view.x = panBase.view.x + (e.clientX - panBase.x);
    view.y = panBase.view.y + (e.clientY - panBase.y);
    applyView();
  } else if(drawing){
    const p = toImage(e.clientX, e.clientY);
    stampBrush(p.x, p.y, mode==='restore');
  }
});
['pointerup','pointercancel'].forEach(ev => stage.addEventListener(ev, e => {
  pointers.delete(e.pointerId);
  if(pointers.size < 2) pinchBase = null;
  panBase = null;
  if(drawing && pointers.size===0){
    endStroke(mode==='erase'?'消しゴム':'復元');
    drawing = false;
  }
}));
stage.addEventListener('wheel', e => {
  if(!img) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  const k = e.deltaY < 0 ? 1.15 : 1/1.15;
  const ns = Math.min(16, Math.max(.05, view.s*k));
  const kk = ns/view.s;
  view.x = (e.clientX-r.left) - kk*((e.clientX-r.left)-view.x);
  view.y = (e.clientY-r.top)  - kk*((e.clientY-r.top)-view.y);
  view.s = ns;
  applyView();
}, {passive:false});

/* ---------- ツールバー ---------- */
document.getElementById('modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  mode = b.dataset.mode;
  [...e.currentTarget.children].forEach(x => {
    x.classList.toggle('on', x===b);
    x.classList.toggle('green', x===b && mode==='restore');
  });
  document.getElementById('tolCtrl').style.display = mode==='wand' ? '' : 'none';
  document.getElementById('sizeCtrl').style.display = (mode==='erase'||mode==='restore') ? '' : 'none';
});
document.getElementById('bgSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  stage.className = 'bg-' + b.dataset.bg;
  [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x===b));
});
const tolEl = document.getElementById('tol'), sizeEl = document.getElementById('size');
tolEl.oninput = () => { tol = +tolEl.value; document.getElementById('tolOut').textContent = tol; };
sizeEl.oninput = () => { brush = +sizeEl.value; document.getElementById('sizeOut').textContent = brush; };
[['edgeCover','edgeCoverOut'],['outlineP','outlineOut'],['smoothP','smoothOut'],['shrinkP','shrinkOut']].forEach(([id,out]) => {
  const el = document.getElementById(id);
  el.oninput = () => document.getElementById(out).textContent = (el.value/10).toFixed(1).replace(/\.0$/,'') || '0';
});

/* ---------- 保存 ---------- */
document.getElementById('saveBtn').onclick = () => {
  paint();
  cv.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName + '_clear.png';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    toast('保存しました');
  }, 'image/png');
};

let toastTimer = null;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}
function setInfo(msg){ document.getElementById('stInfo').textContent = msg; }
window.addEventListener('resize', () => { if(img) applyView(); });
window.addEventListener('keydown', e => {
  if((e.ctrlKey||e.metaKey) && e.key==='z'){ e.preventDefault();
    (e.shiftKey ? document.getElementById('redoBtn') : document.getElementById('undoBtn')).click(); }
  if(e.key==='w') document.querySelector('[data-mode=wand]').click();
  if(e.key==='e') document.querySelector('[data-mode=erase]').click();
  if(e.key==='r') document.querySelector('[data-mode=restore]').click();
});
</script>
</body>
</html>'''


def main():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    url = f'http://localhost:{PORT}'
    print(f'立ち絵スタジオ起動: {url}  (終了は Ctrl+C)')
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n終了します')


if __name__ == '__main__':
    main()

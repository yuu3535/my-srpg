"""
効果音（SE）の試聴・選別の道具（2026-11-18 総合担当）。

原作者が規約を確かめて手で集めた音の素材を試聴し、ゲームのどの場面（id）で鳴らすかを決める。
決めた音は Unity の Resources/SE/〈id〉.wav（.ogg／.mp3）へ写し、se_map.json に元のファイル名と配布元を書く。
ゲームは Sfx.Play("id") でその音を鳴らす（unity-prototype/Assets/Scripts/Battle/Audio/Sfx.cs）。

使い方:
    py -3.12 tools/se_picker.py            （素材のフォルダは リポジトリ直下の SE素材/）
    py -3.12 tools/se_picker.py 別のフォルダ
    → ブラウザが自動で開く（http://localhost:8789）

素材の置き方:
    SE素材/〈配布元のサイト名〉/〈音のファイル〉   （wav・ogg・mp3。サイトごとにフォルダを分ける）
    フォルダの名前が、その音の配布元（クレジット）になる。サイトごとの URL・規約のメモ・クレジットの書き方は、道具の画面で書く（tools/se_sites.json に残る）。

決まり:
    - 素材サイトから自動では集めない（規約）。原作者が規約を確かめて手で取る。
    - 元の素材は消さない・書き換えない（写すだけ）。SE素材/ は Git に入れない。
    - クレジットの一覧は docs/10-design/audio/SE_CREDITS.md に自動で書く。

ライブラリは使わない（Python の標準の機能だけ）。
"""
import json
import shutil
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

ROOT = Path(__file__).resolve().parent.parent
SE_DIR = ROOT / "unity-prototype" / "Assets" / "Resources" / "SE"
MAP_PATH = SE_DIR / "se_map.json"
SITES_PATH = ROOT / "tools" / "se_sites.json"
CREDITS_PATH = ROOT / "docs" / "10-design" / "audio" / "SE_CREDITS.md"
EXTS = (".wav", ".ogg", ".mp3")
PORT = 8789
SRC = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "SE素材"


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def materials():
    out = []
    if not SRC.exists():
        return out
    for f in sorted(SRC.rglob("*")):
        if f.is_file() and f.suffix.lower() in EXTS:
            rel = f.relative_to(SRC)
            site = rel.parts[0] if len(rel.parts) > 1 else "（フォルダなし）"
            out.append({"path": rel.as_posix(), "site": site, "name": f.name, "size": f.stat().st_size})
    return out


def current_file(sid):
    for ext in EXTS:
        p = SE_DIR / f"{sid}{ext}"
        if p.exists():
            return p
    return None


def state():
    m = load_json(MAP_PATH, {"items": []})
    items = []
    for e in m.get("items", []):
        cur = current_file(e["id"])
        items.append(dict(e, has=cur is not None, ext=cur.suffix if cur else ""))
    return {"src": str(SRC), "srcExists": SRC.exists(), "materials": materials(), "items": items, "sites": load_json(SITES_PATH, {})}


def write_credits():
    m = load_json(MAP_PATH, {"items": []})
    sites = load_json(SITES_PATH, {})
    used = [e for e in m.get("items", []) if current_file(e["id"])]
    lines = ["# 効果音のクレジット（自動で作る）", "",
             "`tools/se_picker.py` が、ゲームに入れた音（`unity-prototype/Assets/Resources/SE/`）から作る。手で直さない（道具の画面で直す）。", "",
             "## 使っている音", "", "| id | 場面 | 元のファイル | 配布元 |", "|---|---|---|---|"]
    for e in used:
        lines.append(f"| `{e['id']}` | {e.get('name', '')} | {e.get('file', '')} | {e.get('source', '')} |")
    lines += ["", "## 配布元ごとの規約", "", "| 配布元 | URL | 規約のメモ | クレジットの書き方 |", "|---|---|---|---|"]
    for name in sorted({e.get("source", "") for e in used if e.get("source")} | set(sites)):
        s = sites.get(name, {})
        lines.append(f"| {name} | {s.get('url', '')} | {s.get('terms', '')} | {s.get('credit', '')} |")
    CREDITS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CREDITS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def assign(sid, rel):
    src = (SRC / rel).resolve()
    if SRC not in src.parents or not src.is_file() or src.suffix.lower() not in EXTS:
        raise ValueError("素材のフォルダの中の音のファイルではない")
    m = load_json(MAP_PATH, {"items": []})
    entry = next((e for e in m["items"] if e["id"] == sid), None)
    if entry is None:
        raise ValueError(f"id が一覧に無い: {sid}")
    for ext in EXTS:   # 前の音（拡張子ちがい）を外す
        old = SE_DIR / f"{sid}{ext}"
        if old.exists():
            old.unlink()
            meta = old.with_name(old.name + ".meta")
            if meta.exists():
                meta.unlink()
    shutil.copy2(src, SE_DIR / f"{sid}{src.suffix.lower()}")
    rel_path = src.relative_to(SRC)
    entry["file"] = rel_path.as_posix()
    entry["source"] = rel_path.parts[0] if len(rel_path.parts) > 1 else ""
    save_json(MAP_PATH, m)
    write_credits()


def unassign(sid):
    m = load_json(MAP_PATH, {"items": []})
    for ext in EXTS:
        old = SE_DIR / f"{sid}{ext}"
        if old.exists():
            old.unlink()
            meta = old.with_name(old.name + ".meta")
            if meta.exists():
                meta.unlink()
    for e in m["items"]:
        if e["id"] == sid:
            e["file"] = ""
            e["source"] = ""
    save_json(MAP_PATH, m)
    write_credits()


def set_volume(sid, volume):
    m = load_json(MAP_PATH, {"items": []})
    for e in m["items"]:
        if e["id"] == sid:
            e["volume"] = round(max(0.0, min(2.0, float(volume))), 2)
    save_json(MAP_PATH, m)


def set_site(name, url, terms, credit):
    sites = load_json(SITES_PATH, {})
    sites[name] = {"url": url, "terms": terms, "credit": credit}
    save_json(SITES_PATH, sites)
    write_credits()


PAGE = r"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>SE の試聴・選別</title>
<style>
:root{--bg:#121318;--pn:#1b1d24;--ln:#2e313b;--tx:#e9e6df;--sub:#a29e95;--ac:#d9b25c}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.5 "Yu Gothic UI","Meiryo",sans-serif}
header{padding:12px 18px;border-bottom:1px solid var(--ln)}h1{font-size:17px;margin:0}
.wrap{display:grid;grid-template-columns:1fr 1.2fr;gap:14px;padding:14px}
.box{background:var(--pn);border:1px solid var(--ln);border-radius:8px;padding:10px;max-height:calc(100vh - 110px);overflow:auto}
h2{font-size:14px;margin:4px 0 8px;color:var(--ac)}
.row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-bottom:1px solid var(--ln)}
.row.sel{background:#2a2a1e}.row:hover{background:#22242c}
button{background:#2b2e38;color:var(--tx);border:1px solid #444856;border-radius:5px;padding:3px 9px;cursor:pointer;font:inherit}
button:hover{border-color:var(--ac)}button.pick{background:#4a3f22;border-color:var(--ac)}
.sub{color:var(--sub);font-size:12px}.grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
input[type=text]{background:#0f1015;color:var(--tx);border:1px solid #444856;border-radius:5px;padding:3px 6px;font:inherit}
.site{margin-top:12px;padding:6px 0;border-top:1px solid var(--ln)}.site b{color:var(--ac)}
.tag{font-size:11px;padding:1px 6px;border-radius:9px;background:#333;color:var(--sub)}.tag.on{background:#2f4a2f;color:#bfe3b5}
</style></head><body>
<header><h1>効果音（SE）の試聴・選別</h1><div class="sub" id="src"></div></header>
<div class="wrap">
 <div class="box"><h2>素材（押して試聴 → 選ぶ）</h2><input type="text" id="q" placeholder="名前でしぼる" style="width:95%;margin-bottom:6px"><div id="mats"></div></div>
 <div class="box"><h2>ゲームの場面（選んだ素材を「この音にする」）</h2><div class="sub" id="picked">素材を選んでいません</div><div id="items"></div><div id="sites"></div></div>
</div>
<audio id="au"></audio>
<script>
let S=null,picked=null;const au=document.getElementById('au');
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
function play(url,vol){au.src=url;au.volume=Math.min(1,vol??1);au.currentTime=0;au.play();}
async function load(){S=await (await fetch('/api/state')).json();draw();}
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const j=await r.json();if(!j.ok)alert(j.error);await load();}
function draw(){
 document.getElementById('src').textContent='素材のフォルダ: '+S.src+(S.srcExists?'':'（まだ無い。作って、配布元のサイトごとのフォルダに音を入れてください）');
 const q=document.getElementById('q').value.trim();let h='',site='';
 for(const m of S.materials){if(q&&!m.path.includes(q))continue;if(m.site!==site){site=m.site;h+=`<div class="sub" style="margin-top:8px">■ ${site}</div>`;}
  h+=`<div class="row ${picked===m.path?'sel':''}"><button onclick="play('/mat/${enc(m.path)}')">▶</button><span class="grow" title="${m.path}">${m.name}</span><button class="${picked===m.path?'pick':''}" onclick="picked='${m.path.replace(/'/g,"\\'")}';draw()">選ぶ</button></div>`;}
 document.getElementById('mats').innerHTML=h||'<div class="sub">音のファイルがありません</div>';
 document.getElementById('picked').textContent=picked?('選んだ素材: '+picked):'素材を選んでいません';
 let t='';for(const e of S.items){
  t+=`<div class="row"><span class="tag ${e.has?'on':''}">${e.has?'入っている':'なし'}</span><span class="grow"><b>${e.name}</b><br><span class="sub">${e.id}${e.has?' ／ '+(e.file||'')+(e.source?'（'+e.source+'）':''):''}</span></span>`+
   (e.has?`<button onclick="play('/se/${e.id}${e.ext}?t='+Date.now(),${e.volume})">▶</button>`:'')+
   `<span class="sub">音量</span><input type="range" min="0" max="2" step="0.05" value="${e.volume}" onchange="post('/api/volume',{id:'${e.id}',volume:this.value})" style="width:80px">`+
   `<button ${picked?'':'disabled'} onclick="post('/api/assign',{id:'${e.id}',path:picked})">この音にする</button>`+(e.has?`<button onclick="if(confirm('外しますか？'))post('/api/unassign',{id:'${e.id}'})">外す</button>`:'')+`</div>`;}
 document.getElementById('items').innerHTML=t;
 const names=[...new Set([...S.materials.map(m=>m.site),...Object.keys(S.sites)])];let s='<h2 style="margin-top:14px">配布元ごとの規約（クレジット用）</h2>';
 for(const n of names){const v=S.sites[n]||{};s+=`<div class="site"><b>${n}</b><br>URL <input type="text" id="u_${n}" value="${v.url||''}" style="width:70%"><br>規約のメモ <input type="text" id="t_${n}" value="${v.terms||''}" style="width:70%"><br>クレジットの書き方 <input type="text" id="c_${n}" value="${v.credit||''}" style="width:60%"> <button onclick="post('/api/site',{name:'${n}',url:document.getElementById('u_${n}').value,terms:document.getElementById('t_${n}').value,credit:document.getElementById('c_${n}').value})">保存</button></div>`;}
 document.getElementById('sites').innerHTML=s;
}
document.getElementById('q').oninput=draw;load();
</script></body></html>"""

TYPES = {".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def file(self, base, rel):
        from urllib.parse import unquote
        p = (base / unquote(rel)).resolve()
        if base.resolve() not in p.parents or not p.is_file() or p.suffix.lower() not in TYPES:
            return self.send(404, "{}")
        self.send(200, p.read_bytes(), TYPES[p.suffix.lower()])

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            return self.send(200, PAGE, "text/html; charset=utf-8")
        if u.path == "/api/state":
            return self.send(200, json.dumps(state(), ensure_ascii=False))
        if u.path.startswith("/mat/"):
            return self.file(SRC, u.path[5:])
        if u.path.startswith("/se/"):
            return self.file(SE_DIR, u.path[4:])
        self.send(404, "{}")

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(n) or b"{}"
        try:
            b = json.loads(raw.decode("utf-8"))
        except UnicodeDecodeError:
            b = json.loads(raw.decode("cp932"))   # Windows のコマンドから送ったとき
        try:
            u = urlparse(self.path).path
            if u == "/api/assign":
                assign(b["id"], b["path"])
            elif u == "/api/unassign":
                unassign(b["id"])
            elif u == "/api/volume":
                set_volume(b["id"], b["volume"])
            elif u == "/api/site":
                set_site(b["name"], b.get("url", ""), b.get("terms", ""), b.get("credit", ""))
            else:
                return self.send(404, "{}")
            self.send(200, json.dumps({"ok": True}))
        except Exception as e:  # 画面に理由を出す
            self.send(200, json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"SE の試聴・選別: {url}  （素材のフォルダ: {SRC}）  止めるときは Ctrl+C")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

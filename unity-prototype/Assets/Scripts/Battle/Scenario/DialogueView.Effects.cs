using System.Collections.Generic;
using System.Linq;
using Srpg.Battle.Menu;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 吹き出しの演出（2026-11-15 デザインのチャット「吹き出し配置の仕様」§4〜§6。正本 docs/10-design/ui/talk/TALK_BUBBLE_PLACEMENT_SPEC_2026-11-15.md）。
    /// ガヤ（3人以上の場面で外側に立つ人のつぶやき。ふつう／強め）・画面の外の声（ひそひそ／ざわざわ）・叫ぶ演出（一気に出る＋揺れ＋話す人が前へ＋周りが暗く）。
    /// 何を出すかはシナリオの行（ScenarioLine.gaya／mob／fx）が決める。支援会話では出さない
    /// </summary>
    public partial class DialogueView
    {
        private RectTransform gayaLayer, mobLayer;
        private RawImage shoutDim;

        // ── ガヤ ──
        private class GayaView
        {
            public RectTransform root;
            public CanvasGroup fade;
            public PolyGraphic fill, line, inner;
            public RawImage dots;
            public RectTransform dia;
            public Text label;
            public string text;
            public bool strong, active;
            public float shownAt, hideAt = -10f;
            public Rect rect;
            public Texture2D dotsTex;
        }
        private readonly Dictionary<string, GayaView> gayaViews = new Dictionary<string, GayaView>();

        /// <summary>今出ているガヤ（確認・テスト用。消えかけのものは入れない）</summary>
        public IReadOnlyList<string> GayaNow => gayaViews.Where(g => g.Value.active).Select(g => g.Key).ToList();
        /// <summary>出ているガヤの箱（1688×780 の座標。確認・テスト用）</summary>
        public Rect GayaRect(string who) => gayaViews.TryGetValue(who ?? "", out var g) && g.active ? g.rect : default;

        // ── 画面の外の声 ──
        private class MobView { public RectTransform root; public CanvasGroup fade; public float delay; public Vector2 at; }
        private readonly List<MobView> mobViews = new List<MobView>();
        private string mobKey = "";
        private float mobStart;
        /// <summary>今出ている画面の外の声の数（確認・テスト用）</summary>
        public int MobCount => mobViews.Count;

        // ── 叫ぶ ──
        private bool shoutNow;
        private float shoutAt = -10f, shoutEndAt = -10f;
        /// <summary>今の台詞が叫ぶ演出か（確認・テスト用）</summary>
        public bool ShoutNow => shoutNow;
        private readonly Dictionary<string, float> actorZoom = new Dictionary<string, float>();

        private void BuildEffects()
        {
            // 周りを暗くする（叫ぶ）: 立ち絵より奥・景色より手前
            shoutDim = TRaw("ShoutDim", content, ShoutDimTexture(), Color.white);
            TPlace(shoutDim.rectTransform, 0f, 0f, TalkW, TalkH);
            shoutDim.transform.SetAsFirstSibling();
            shoutDim.gameObject.SetActive(false);
            // 画面の外の声: 立ち絵より手前・吹き出しより奥
            mobLayer = TNode("Mob", content);
            mobLayer.anchorMin = mobLayer.anchorMax = mobLayer.pivot = new Vector2(0f, 1f);
            mobLayer.SetSiblingIndex(stageRoot.GetSiblingIndex() + 1);
            // ガヤ: 吹き出しと同じ高さ（吹き出しの次）
            gayaLayer = TNode("Gaya", content);
            gayaLayer.anchorMin = gayaLayer.anchorMax = gayaLayer.pivot = new Vector2(0f, 1f);
            gayaLayer.SetSiblingIndex(bubbleGroup.GetSiblingIndex() + 1);
        }

        /// <summary>この行で出すガヤ（条件: ふだんの会話・3人以上・外側に立つ人・その人がメインで話していない・地の文と携帯端末のあいだは出さない）</summary>
        private List<GayaLine> GayaFor(ScenarioLine line)
        {
            var list = new List<GayaLine>();
            if (SupportMode || line == null || line.gaya == null || line.type == "narration" || line.type == "phone") return list;
            if (placed.Count < 3) return list;
            foreach (var g in line.gaya)
            {
                if (g == null || string.IsNullOrEmpty(g.text) || string.IsNullOrEmpty(g.who)) continue;
                if (!placed.TryGetValue(g.who, out var q) || q.inner) continue;
                if (line.type == "line" && line.speaker == g.who) continue;
                if (list.Any(x => x.who == g.who)) continue;
                list.Add(g);
            }
            return list;
        }

        /// <summary>行を出したあと（立ち絵・吹き出しを並べたあと）に、ガヤ・画面の外の声・叫ぶ演出を合わせる</summary>
        private void ShowEffects(ScenarioLine line)
        {
            float now = Application.isPlaying ? Time.unscaledTime : -10f;
            // ガヤ
            var gayas = GayaFor(line);
            foreach (var pair in gayaViews)
            {
                var v = pair.Value;
                if (v.active && !gayas.Any(g => g.who == pair.Key)) { v.active = false; v.hideAt = now; }
            }
            foreach (var g in gayas)
            {
                if (!gayaViews.TryGetValue(g.who, out var v)) { v = NewGayaView(g.who); gayaViews[g.who] = v; }
                // 同じガヤが次の台詞にも続くときは、動き直さない（ちらつかせない）
                bool same = v.active && v.text == g.text && v.strong == g.strong;
                LayoutGaya(v, g, placed[g.who]);
                if (!same) v.shownAt = now;
                v.active = true;
                v.hideAt = -10f;
                v.root.gameObject.SetActive(true);
                // ガヤを言っている人の明るさ 0.9
                if (g.who != stage.Speaker) actorColor[g.who] = new Color(0.9f, 0.9f, 0.9f, 1f);
                if (!Application.isPlaying && actors.TryGetValue(g.who, out var img) && img != null) img.color = actorColor[g.who];
            }
            // 画面の外の声（地の文のあいだも出してよい）
            string key = SupportMode || string.IsNullOrEmpty(line.mob) ? "" : line.mob + "|" + string.Join("|", line.mobTexts ?? new string[0]);
            if (key != mobKey) BuildMobs(SupportMode ? "" : line.mob, line.mobTexts);
            mobKey = key;
            // 叫ぶ（メインの台詞だけ。箱の形は変えない）
            bool wasShout = shoutNow;
            shoutNow = !SupportMode && line.type == "line" && line.fx == "shout";
            if (shoutNow) shoutAt = now;
            else if (wasShout) shoutEndAt = now;
            foreach (var who in actors.Keys) actorZoom[who] = 1f;
            if (shoutNow && line.speaker != null && placed.TryGetValue(line.speaker, out var sp) && actorTarget.ContainsKey(line.speaker))
            {
                // 立ち絵を 12px 上げて 1.04 倍（足元を基準）。話す人はもう 6px 上がっているので、残りの 6px と、大きくした分を足元から
                actorTarget[line.speaker] += new Vector2(0f, 6f + sp.height * 0.02f);
                actorZoom[line.speaker] = 1.04f;
            }
        }

        private GayaView NewGayaView(string who)
        {
            var p = Pal;
            var v = new GayaView();
            v.root = TNode("Gaya_" + who, gayaLayer);
            v.root.anchorMin = v.root.anchorMax = v.root.pivot = new Vector2(0f, 1f);
            v.fade = v.root.gameObject.AddComponent<CanvasGroup>();
            v.fade.blocksRaycasts = false;
            v.fill = TPoly("Fill", v.root, Dark(p.pl, 0.79f));
            v.fill.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            v.dots = TRaw("Dots", v.fill.rectTransform, null, Color.white);
            v.line = TPoly("Line", v.root, Light(p.ln));
            v.inner = TPoly("Inner", v.root, Light(p.ln2));
            v.dia = TDiamond(v.root, 0f, 0f, 7f, p.ac, new Color(0f, 0f, 0f, 0f));
            v.label = TLabel(v.root, "", 0f, 0f, 400f, 60f, 24, HexC("#d6d2c9"), 600);
            v.label.alignment = TextAnchor.UpperCenter;
            v.label.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.06f;
            return v;
        }

        /// <summary>ガヤの形（仕様 §4）。頭の中心 X に中央をそろえ（画面の端から 16px 以内）、下の端は頭のてっぺん −26。尾は下の辺から 14px 下へ</summary>
        private void LayoutGaya(GayaView v, GayaLine g, Placed q)
        {
            var p = Pal;
            int n = (g.text ?? "").Length;
            float w = g.strong ? Mathf.Round(n * 28f) + 54f : Mathf.Round(n * 25.4f) + 48f, h = g.strong ? 54f : 50f;
            float hx = q.headX;
            float x0 = Mathf.Max(16f, Mathf.Min(TalkW - 16f - w, Mathf.Round(hx - w / 2f))), y1 = q.top - 26f, y0 = y1 - h, x1 = x0 + w;
            float bx = Mathf.Max(x0 + 22f, Mathf.Min(x1 - 22f, hx));
            float tx = bx + (q.right ? -4f : 4f), ty = y1 + 14f;
            // 拡大・縮小の中心（箱の真ん中・上から 32）を入れ物の原点にする
            float ox = x0 + w / 2f, oy = y0 + 32f;
            v.root.anchoredPosition = TP(ox, oy);
            Vector2 R(float x, float y) => TP(x - ox, y - oy);
            var shape = new List<Vector2>();
            if (g.strong)
            {
                // とげC（c 10・s 13・k 4。尾つき）。内側の線もとげに沿う（5px 内側・c 7・s 5・k 3・尾なし）
                shape.AddRange(SpikeC(x0, y0, x1, y1, 10f, 13f, 4f, bx, tx, ty).Select(t => R(t.x, t.y)));
                v.inner.Set(SpikeC(x0 + 5f, y0 + 5f, x1 - 5f, y1 - 5f, 7f, 5f, 3f, null, 0f, 0f).Select(t => R(t.x, t.y)).ToList(), PolyGraphic.Mode.Stroke, true, 1f);
            }
            else
            {
                const float c = 8f;
                shape.Add(R(x0 + c, y0)); shape.Add(R(x1 - c, y0)); shape.Add(R(x1, y0 + c)); shape.Add(R(x1, y1 - c)); shape.Add(R(x1 - c, y1));
                shape.Add(R(bx + 7f, y1)); shape.Add(R(tx, ty)); shape.Add(R(bx - 7f, y1));
                shape.Add(R(x0 + c, y1)); shape.Add(R(x0, y1 - c)); shape.Add(R(x0, y0 + c));
                const float k = 5f, ci = 5f;
                v.inner.Set(new List<Vector2> { R(x0 + k + ci, y0 + k), R(x1 - k - ci, y0 + k), R(x1 - k, y0 + k + ci), R(x1 - k, y1 - k - ci), R(x1 - k - ci, y1 - k), R(x0 + k + ci, y1 - k), R(x0 + k, y1 - k - ci), R(x0 + k, y0 + k + ci) }, PolyGraphic.Mode.Stroke, true, 1f);
            }
            v.fill.color = Dark(p.pl, 0.79f);
            v.fill.Set(shape, PolyGraphic.Mode.Fill);
            v.line.color = Light(p.ln);
            v.line.Set(shape, PolyGraphic.Mode.Stroke, true, 1f);
            v.inner.color = Light(p.ln2);
            // ドット柄 0.22
            if (v.dotsTex != null) { if (Application.isPlaying) Destroy(v.dotsTex); else DestroyImmediate(v.dotsTex); }
            v.dotsTex = BuildDots(x0, y0, x1, y1, 0.22f);
            v.dots.texture = v.dotsTex;
            TPlace(v.dots.rectTransform, x0 - ox, y0 - oy, w, h);
            // 菱形は右下に1つだけ（7px、中心 (右端 −12, 下の端)）
            v.dia.anchoredPosition = R(x1 - 12f, y1 - 0.5f);
            // 字（ふつう 24px・600・行送り 50・#d6d2c9／強め 26px・800・行送り 54・#f6f4ef）。中央揃え＋字間の戻し
            v.label.font = g.strong ? fontExtra : fontSemi;
            v.label.fontSize = g.strong ? 26 : 24;
            v.label.color = g.strong ? HexC("#f6f4ef") : HexC("#d6d2c9");
            v.label.text = g.text;
            TPlace(v.label.rectTransform, x0 - ox, y0 - oy - TextTopPad(v.label, h), w, h + 20f);
            v.label.rectTransform.anchoredPosition += new Vector2(-n * 0.06f * v.label.fontSize / 2f + 0.03f * v.label.fontSize, 0f);
            v.text = g.text;
            v.strong = g.strong;
            v.rect = Rect.MinMaxRect(x0, y0, x1, y1);
        }

        /// <summary>とげC の輪郭（仕様 §4「とげC の作り方」。尾は bx が null なら無し）</summary>
        private static List<Vector2> SpikeC(float x0, float y0, float x1, float y1, float c, float s, float k, float? bx, float tx, float ty)
        {
            float mx = (x0 + x1) / 2f, my = (y0 + y1) / 2f;
            var P = new List<Vector2> { new Vector2(x0 + c, y0), new Vector2(mx, y0 + k), new Vector2(x1 - c, y0), new Vector2(x1 + s, y0 - s), new Vector2(x1, y0 + c),
                new Vector2(x1 - k, my), new Vector2(x1, y1 - c), new Vector2(x1 + s, y1 + s), new Vector2(x1 - c, y1) };
            if (bx.HasValue) { P.Add(new Vector2(bx.Value + 7f, y1)); P.Add(new Vector2(tx, ty)); P.Add(new Vector2(bx.Value - 7f, y1)); }
            P.AddRange(new[] { new Vector2(x0 + c, y1), new Vector2(x0 - s, y1 + s), new Vector2(x0, y1 - c), new Vector2(x0 + k, my), new Vector2(x0, y0 + c), new Vector2(x0 - s, y0 - s) });
            return P;
        }

        // ── 画面の外の声（仕様 §5） ──

        private static readonly string[] WhisperTexts = { "ねえ、聞いた…？", "ひそひそ…" };
        private static readonly string[] MurmurTexts = { "ざわ…", "ざわざわ…", "ざわ…", "ざわざわ…" };

        private void BuildMobs(string kind, string[] texts)
        {
            foreach (var m in mobViews) if (m.root != null) Remove(m.root.gameObject);
            mobViews.Clear();
            mobStart = Application.isPlaying ? Time.unscaledTime : 0f;
            if (kind != "whisper" && kind != "murmur") return;
            var defaults = kind == "whisper" ? WhisperTexts : MurmurTexts;
            string T(int i) => texts != null && texts.Length > 0 ? texts[i % texts.Length] : defaults[i];
            float W(string t) => Mathf.Round(t.Length * 21.6f) + 36f;
            if (kind == "whisper")
            {
                // 左上（左の端 46）と右上（右の端 1688−46）。2つ目は 1.8 秒遅らせて交互に
                string a = T(0), b = T(1);
                AddMob(a, 46f, 112f, 0f);
                AddMob(b, TalkW - 46f - W(b), 108f, 1.8f);
            }
            else
            {
                var at = new[] { (70f, 118f, 0f), (372f, 150f, 0.9f), (1150f, 112f, 1.8f), (1430f, 108f, 2.7f) };
                for (int i = 0; i < at.Length; i++) AddMob(T(i), at[i].Item1, at[i].Item2, at[i].Item3);
            }
        }

        private void AddMob(string text, float x, float y, float delay)
        {
            float w = Mathf.Round(text.Length * 21.6f) + 36f, h = 40f;
            var root = TNode("MobVoice", mobLayer);
            root.anchorMin = root.anchorMax = root.pivot = new Vector2(0f, 1f);
            root.anchoredPosition = TP(x, y);
            var fade = root.gameObject.AddComponent<CanvasGroup>();
            fade.blocksRaycasts = false;
            var shape = Chamfer(0f, 0f, w, h, 6f);
            TPoly("Fill", root, Dark(Pal.pl, 0.58f)).Set(shape, PolyGraphic.Mode.Fill);
            TPoly("Line", root, Light(Rgb(214, 218, 224, 0.3f))).Set(shape, PolyGraphic.Mode.Stroke, true, 1f);
            var t = TLabel(root, text, 0f, 0f, w, h, 20, HexC("#b8b5ae"), 600);
            t.alignment = TextAnchor.UpperCenter;
            t.gameObject.AddComponent<Menu.LetterSpacing>().em = 0.08f;
            TPlace(t.rectTransform, 0f, -TextTopPad(t, h), w, h + 20f);
            t.rectTransform.anchoredPosition += new Vector2(-text.Length * 0.08f * 20f / 2f + 0.04f * 20f, 0f);
            mobViews.Add(new MobView { root = root, fade = fade, delay = delay, at = new Vector2(x, y) });
        }

        // ── 毎コマ ──

        private void TickEffects()
        {
            float now = Time.unscaledTime;
            bool still = Still || !Application.isPlaying;
            // ガヤ: 出る（メインと同じ: 下から 6px・0.26 秒。強めは 0.8 → 1 に弾む 0.38 秒）・消える（0.45 秒で 5px 上へ）
            foreach (var v in gayaViews.Values)
            {
                if (v.root == null) continue;
                if (v.active)
                {
                    float t = still ? 1f : Mathf.Clamp01((now - v.shownAt) / (v.strong ? 0.38f : 0.26f));
                    if (v.strong)
                    {
                        float e = CubicBezier(0.2f, 1.6f, 0.4f, 1f, t);
                        v.fade.alpha = Mathf.Clamp01(t * 2.5f);
                        float s = Mathf.LerpUnclamped(0.8f, 1f, e);
                        v.root.localScale = new Vector3(s, s, 1f);
                        v.root.anchoredPosition = TP(v.rect.center.x, v.rect.yMin + 32f);
                    }
                    else
                    {
                        float e = 1f - Mathf.Pow(1f - t, 3f);
                        v.fade.alpha = Mathf.Lerp(0.3f, 1f, e);
                        v.root.localScale = Vector3.one;
                        v.root.anchoredPosition = TP(v.rect.center.x, v.rect.yMin + 32f) + new Vector2(0f, -6f * (1f - e));
                    }
                }
                else if (v.root.gameObject.activeSelf)
                {
                    float t = still ? 1f : Mathf.Clamp01((now - v.hideAt) / 0.45f);
                    v.fade.alpha = 1f - t;
                    v.root.anchoredPosition = TP(v.rect.center.x, v.rect.yMin + 32f) + new Vector2(0f, 5f * t);
                    if (t >= 1f) v.root.gameObject.SetActive(false);
                }
            }
            // 画面の外の声: 3.6 秒で1周（0〜18% で 5px 下から出る → 68% まで → 100% で 5px 上へ消える）
            foreach (var m in mobViews)
            {
                if (m.root == null) continue;
                float a = 1f, dy = 0f;
                if (!still)
                {
                    float el = now - mobStart - m.delay;
                    if (el < 0f) a = 0f;
                    else
                    {
                        float ph = Mathf.Repeat(el, 3.6f) / 3.6f;
                        if (ph < 0.18f) { float e = EaseInOut(ph / 0.18f); a = e; dy = 5f * (1f - e); }
                        else if (ph > 0.68f) { float e = EaseInOut((ph - 0.68f) / 0.32f); a = 1f - e; dy = -5f * e; }
                    }
                }
                m.fade.alpha = a;
                m.root.anchoredPosition = TP(m.at.x, m.at.y + dy);
            }
            // 叫ぶ: 箱と文字が 1.08 倍・0.2 から 0.2 秒で戻る／画面が 0.36 秒揺れる／周りが 0.25 秒で暗くなる
            if (shoutNow)
            {
                float t = still ? 1f : Mathf.Clamp01((now - shoutAt) / 0.2f);
                float e = CubicBezier(0.2f, 0.9f, 0.3f, 1f, t);
                float s = Mathf.Lerp(1.08f, 1f, e);
                bubbleFade.alpha = Mathf.Lerp(0.2f, 1f, e);
                var c = new Vector2((bx0 + bx1) / 2f, (by0 + by1) / 2f);
                bubbleGroup.localScale = new Vector3(s, s, 1f);
                bubbleGroup.anchoredPosition = TP(c.x, c.y) * (1f - s);
                Shake(still ? 1f : (now - shoutAt) / 0.36f);
                shoutDim.gameObject.SetActive(true);
                shoutDim.color = new Color(1f, 1f, 1f, still ? 1f : 1f - Mathf.Pow(1f - Mathf.Clamp01((now - shoutAt) / 0.25f), 2f));
            }
            else
            {
                bubbleGroup.localScale = Vector3.one;
                content.localScale = Vector3.one;
                content.anchoredPosition = Vector2.zero;
                if (shoutDim.gameObject.activeSelf)
                {
                    float t = still ? 1f : Mathf.Clamp01((now - shoutEndAt) / 0.25f);
                    shoutDim.color = new Color(1f, 1f, 1f, 1f - t);
                    if (t >= 1f) shoutDim.gameObject.SetActive(false);
                }
            }
        }

        /// <summary>画面の揺れ（0.36 秒。scale 1.015 のまま (−6,3)→(6,−3)→(−4,2)→(3,−1)→(−1,0)→元へ。15/30/48/66/84/100%）</summary>
        private void Shake(float t)
        {
            if (t >= 1f) { content.localScale = Vector3.one; content.anchoredPosition = Vector2.zero; return; }
            float[] k = { 0f, 0.15f, 0.30f, 0.48f, 0.66f, 0.84f, 1f };
            Vector2[] o = { Vector2.zero, new Vector2(-6f, 3f), new Vector2(6f, -3f), new Vector2(-4f, 2f), new Vector2(3f, -1f), new Vector2(-1f, 0f), Vector2.zero };
            int i = 0;
            while (i < k.Length - 2 && t > k[i + 1]) i++;
            var off = Vector2.Lerp(o[i], o[i + 1], Mathf.InverseLerp(k[i], k[i + 1], t));
            float sc = i == k.Length - 2 ? Mathf.Lerp(1.015f, 1f, Mathf.InverseLerp(k[i], k[i + 1], t)) : 1.015f;
            content.localScale = new Vector3(sc, sc, 1f);
            content.anchoredPosition = new Vector2(off.x, -off.y);
        }

        private void HideEffects()
        {
            foreach (var v in gayaViews.Values) { v.active = false; if (v.root != null) v.root.gameObject.SetActive(false); }
            foreach (var m in mobViews) if (m.root != null) Remove(m.root.gameObject);
            mobViews.Clear();
            mobKey = "";
            shoutNow = false;
            if (shoutDim != null) shoutDim.gameObject.SetActive(false);
            if (content != null) { content.localScale = Vector3.one; content.anchoredPosition = Vector2.zero; }
            if (bubbleGroup != null) bubbleGroup.localScale = Vector3.one;
            actorZoom.Clear();
        }

        /// <summary>ガヤを会話ログにも残す（名前の横に「（ガヤ）」）</summary>
        private void AddGayaLog(ScenarioLine line)
        {
            foreach (var g in GayaFor(line))
                logEntries.Add(new LogEntry { name = g.who + "（ガヤ）", text = g.text });
            while (logEntries.Count > 80) logEntries.RemoveAt(0);
        }

        // ── 小さな道具 ──

        private static float EaseInOut(float t) => t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;

        /// <summary>CSS の cubic-bezier(x1,y1,x2,y2)（t は時間の割合）</summary>
        private static float CubicBezier(float x1, float y1, float x2, float y2, float t)
        {
            if (t <= 0f) return 0f;
            if (t >= 1f) return 1f;
            float u = t;
            for (int i = 0; i < 8; i++)
            {
                float x = Bz(x1, x2, u) - t, dx = BzD(x1, x2, u);
                if (Mathf.Abs(x) < 1e-4f || Mathf.Abs(dx) < 1e-5f) break;
                u = Mathf.Clamp01(u - x / dx);
            }
            return Bz(y1, y2, u);
        }
        private static float Bz(float a, float b, float u) => 3f * a * u * (1f - u) * (1f - u) + 3f * b * u * u * (1f - u) + u * u * u;
        private static float BzD(float a, float b, float u) => 3f * a * (1f - u) * (1f - u) + 6f * (b - a) * u * (1f - u) + 3f * (1f - b) * u * u;

        private static Texture2D shoutDimTex;

        /// <summary>周りを暗くする絵（中心 50%・45%、楕円 70%、30% まで透明 → 端で黒 0.5）</summary>
        private static Texture2D ShoutDimTexture()
        {
            if (shoutDimTex != null) return shoutDimTex;
            const int W = 256, H = 128;
            shoutDimTex = new Texture2D(W, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "ShoutDim" };
            var px = new Color[W * H];
            for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
            {
                float fx = (x + 0.5f) / W, fy = 1f - (y + 0.5f) / H;
                float dx = (fx - 0.5f) / 0.7f, dy = (fy - 0.45f) / 0.7f;
                float r = Mathf.Sqrt(dx * dx + dy * dy);
                float a = 0.5f * Mathf.Clamp01((r - 0.3f) / 0.7f);
                px[y * W + x] = new Color(0f, 0f, 0f, Hub2Textures.Seen(a));
            }
            shoutDimTex.SetPixels(px);
            shoutDimTex.Apply();
            return shoutDimTex;
        }
    }
}

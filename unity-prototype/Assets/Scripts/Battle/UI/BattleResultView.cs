using System;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 戦闘のあとの画面（2026-10-08。原作者: 負けたらその戦闘の最初からやり直す）。
    /// ・勝ち: 戦闘の名前・ターン・倒した敵・倒れた味方 →「次へ」で話の続き。経験値は成長を入れたらここに足す
    /// ・負け: 「この戦闘をやり直す」「セーブした所から」「最初の画面へ」
    /// 画面はコードで組み立てる（仮の見た目。銀の戦闘UIの意匠は、あとで合わせる）
    /// </summary>
    public static class BattleResultView
    {
        private static GameObject open;
        private static Action next, retry;

        public static bool IsOpen => open != null;

        public static void ShowVictory(Battle3DController.ResultSummary s, Action onNext)
        {
            Close();
            next = onNext;
            var (root, font) = Build("勝利", s.title);
            float y = 34f;
            void Row(string label, string value)
            {
                var l = StartMenu.Label(root, label, new Vector2(-70f, y), new Vector2(160f, 20f), 14, HudPalette.Muted, font);
                l.alignment = TextAnchor.MiddleLeft;
                var v = StartMenu.Label(root, value, new Vector2(80f, y), new Vector2(120f, 20f), 15, HudPalette.Text, font);
                v.alignment = TextAnchor.MiddleRight;
                y -= 26f;
            }
            Row("ターン", $"{s.turns}");
            Row("倒した敵", $"{s.enemiesDefeated} / {s.enemiesTotal}");
            Row("倒れた味方", $"{s.alliesDown} / {s.alliesTotal}");
            // 仲間の経験値と、上がった因果Lv（2026-10-09）
            y -= 4f;
            foreach (var g in s.growth ?? new System.Collections.Generic.List<GrowthResult>())
            {
                bool up = g.levelAfter > g.levelBefore;
                var n = StartMenu.Label(root, g.name, new Vector2(-110f, y), new Vector2(90f, 18f), 13, HudPalette.Text, font);
                n.alignment = TextAnchor.MiddleLeft;
                var e = StartMenu.Label(root, $"EXP +{g.exp}", new Vector2(-20f, y), new Vector2(90f, 18f), 13, HudPalette.Silver, font);
                e.alignment = TextAnchor.MiddleLeft;
                var lv = StartMenu.Label(root, up ? $"因果Lv {g.levelBefore} → {g.levelAfter}" : $"因果Lv {g.levelAfter}", new Vector2(95f, y), new Vector2(130f, 18f), 13, up ? HudPalette.Teal : HudPalette.Muted, font);
                lv.alignment = TextAnchor.MiddleRight;
                y -= 18f;
                if (up)
                {
                    var gains = StartMenu.Label(root, g.GainsText, new Vector2(10f, y), new Vector2(300f, 16f), 11, HudPalette.Teal, font);
                    gains.alignment = TextAnchor.MiddleLeft;
                    y -= 17f;
                }
            }
            float buttonY = Mathf.Min(-84f, y - 20f);
            Button(root, "次へ", new Vector2(0f, buttonY), font, Next);
            Fit(root, buttonY - 28f);
        }

        public static void ShowDefeat(string title, string reason, Action onRetry)
        {
            Close();
            retry = onRetry;
            var (root, font) = Build("敗北", title);
            StartMenu.Label(root, reason, new Vector2(0f, 30f), new Vector2(400f, 20f), 13, HudPalette.Muted, font);
            Button(root, "この戦闘をやり直す", new Vector2(0f, -10f), font, Retry);
            Button(root, "セーブした所から", new Vector2(0f, -48f), font, () => SaveMenu.Open(SaveMenu.Mode.Load));
            Button(root, "最初の画面へ", new Vector2(0f, -86f), font, () => { Close(); StartMenu.BackToStart(); });
            Fit(root, -86f - 28f);
        }

        /// <summary>「次へ」（ボタンとテストから）</summary>
        public static void Next()
        {
            var a = next;
            Close();
            a?.Invoke();
        }

        /// <summary>「この戦闘をやり直す」（ボタンとテストから）</summary>
        public static void Retry()
        {
            var a = retry;
            Close();
            a?.Invoke();
        }

        public static void Close()
        {
            if (open != null) UnityEngine.Object.Destroy(open);
            open = null;
            next = retry = null;
        }

        private static (Transform root, Font font) Build(string heading, string title)
        {
            var font = StartMenu.FontOf();
            var canvas = StartMenu.NewCanvas("BattleResult", 550);
            open = canvas.gameObject;
            var root = canvas.transform;
            var dim = StartMenu.Rect("Dim", root, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            dim.anchorMin = Vector2.zero;
            dim.anchorMax = Vector2.one;
            dim.gameObject.AddComponent<Image>().color = new Color(0.03f, 0.06f, 0.09f, 0.72f);   // 盤面は薄く見えたまま
            var panel = StartMenu.Rect("Panel", root, new Vector2(0.5f, 0.5f), new Vector2(0f, -22f), new Vector2(360f, 300f));
            panel.gameObject.AddComponent<Image>().color = HudPalette.Panel;
            var line = panel.gameObject.AddComponent<Outline>();
            line.effectColor = new Color(0.85f, 0.88f, 0.9f, 0.85f);
            line.effectDistance = new Vector2(1f, -1f);
            StartMenu.Label(root, heading, new Vector2(0f, 92f), new Vector2(300f, 34f), 26, HudPalette.Silver, font);
            StartMenu.Label(root, title, new Vector2(0f, 64f), new Vector2(320f, 18f), 12, HudPalette.Muted, font);
            return (root, font);
        }

        /// <summary>欄の高さを中身に合わせる（上は見出しの上、下は bottom）</summary>
        private static void Fit(Transform root, float bottom)
        {
            const float top = 123f;
            var panel = (RectTransform)root.Find("Panel");
            panel.sizeDelta = new Vector2(panel.sizeDelta.x, top - bottom);
            panel.anchoredPosition = new Vector2(0f, (top + bottom) / 2f);
        }

        private static void Button(Transform parent, string title, Vector2 pos, Font font, Action onClick)
        {
            var rt = StartMenu.Rect(title, parent, new Vector2(0.5f, 0.5f), pos, new Vector2(220f, 30f));
            rt.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.95f);
            var o = rt.gameObject.AddComponent<Outline>();
            o.effectColor = new Color(0.85f, 0.88f, 0.9f, 0.6f);
            o.effectDistance = new Vector2(1f, -1f);
            var button = rt.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.highlightedColor = new Color(1.25f, 1.25f, 1.25f, 1f);
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1f);
            button.colors = colors;
            button.onClick.AddListener(() => onClick());
            StartMenu.Label(rt, title, Vector2.zero, new Vector2(220f, 30f), 14, HudPalette.Text, font);
        }
    }
}

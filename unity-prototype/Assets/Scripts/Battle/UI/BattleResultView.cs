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
            Button(root, "次へ", new Vector2(0f, -84f), font, Next);
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
            var panel = StartMenu.Rect("Panel", root, new Vector2(0.5f, 0.5f), new Vector2(0f, -4f), new Vector2(340f, 250f));
            panel.gameObject.AddComponent<Image>().color = HudPalette.Panel;
            var line = panel.gameObject.AddComponent<Outline>();
            line.effectColor = new Color(0.85f, 0.88f, 0.9f, 0.85f);
            line.effectDistance = new Vector2(1f, -1f);
            StartMenu.Label(root, heading, new Vector2(0f, 92f), new Vector2(300f, 34f), 26, HudPalette.Silver, font);
            StartMenu.Label(root, title, new Vector2(0f, 64f), new Vector2(320f, 18f), 12, HudPalette.Muted, font);
            return (root, font);
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

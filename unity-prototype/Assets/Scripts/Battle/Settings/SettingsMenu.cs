using System;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 環境設定の画面（2026-10-09。仮の最小限）。選んだらすぐ保存する。
    /// メニュー画面（携帯端末。Codex）の「設定」ができたら、そちらから GameSettings を読み書きする形に置き換える
    /// </summary>
    public static class SettingsMenu
    {
        private static GameObject open;
        public static bool IsOpen => open != null;

        public static void Open()
        {
            Close();
            var font = StartMenu.FontOf();
            var canvas = StartMenu.NewCanvas("SettingsMenu", 600);
            open = canvas.gameObject;
            var root = canvas.transform;
            var dim = StartMenu.Rect("Dim", root, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            dim.anchorMin = Vector2.zero;
            dim.anchorMax = Vector2.one;
            dim.gameObject.AddComponent<Image>().color = new Color(0.03f, 0.06f, 0.09f, 0.96f);
            StartMenu.Label(root, "設定", new Vector2(0f, 168f), new Vector2(300f, 26f), 20, HudPalette.Text, font);

            var v = GameSettings.Current;
            float y = 128f;
            void Row(string label, string[] names, int value, Action<int> set)
            {
                var l = StartMenu.Label(root, label, new Vector2(-250f, y), new Vector2(150f, 22f), 14, HudPalette.Silver, font);
                l.alignment = TextAnchor.MiddleLeft;
                float w = 74f, x0 = -130f + w / 2f;
                for (int i = 0; i < names.Length; i++)
                {
                    int index = i;
                    Choice(root, names[i], new Vector2(x0 + i * (w + 6f), y), new Vector2(w, 24f), font, i == value, () => { set(index); GameSettings.Save(); Open(); });
                }
                y -= 34f;
            }
            Row("文字の速さ", GameSettings.TextSpeedNames, v.textSpeed, i => v.textSpeed = i);
            Row("オートの速さ", GameSettings.AutoSpeedNames, v.autoSpeed, i => v.autoSpeed = i);
            Row("スキップ", new[] { "既読だけ", "未読も" }, v.skipUnread ? 1 : 0, i => v.skipUnread = i == 1);
            Row("歩く速さ", GameSettings.MoveSpeedNames, v.moveSpeed, i => v.moveSpeed = i);
            Row("音楽", GameSettings.VolumeNames, v.musicVolume, i => v.musicVolume = i);
            Row("効果音", GameSettings.VolumeNames, v.soundVolume, i => v.soundVolume = i);
            StartMenu.Label(root, "音楽・効果音はまだ入っていません（入れたら、この大きさで鳴らします）", new Vector2(0f, y + 8f), new Vector2(600f, 16f), 11, HudPalette.Muted, font);
            Choice(root, "初めの値に戻す", new Vector2(-70f, -160f), new Vector2(130f, 24f), font, false, () => { GameSettings.ResetToDefaults(); Open(); });
            Choice(root, "閉じる", new Vector2(70f, -160f), new Vector2(130f, 24f), font, false, Close);
        }

        public static void Close()
        {
            if (open != null) UnityEngine.Object.Destroy(open);
            open = null;
        }

        private static void Choice(Transform parent, string title, Vector2 pos, Vector2 size, Font font, bool on, Action onClick)
        {
            var rt = StartMenu.Rect(title, parent, new Vector2(0.5f, 0.5f), pos, size);
            rt.gameObject.AddComponent<Image>().color = on ? new Color(0.16f, 0.32f, 0.36f, 1f) : new Color(0.035f, 0.08f, 0.12f, 0.95f);
            var o = rt.gameObject.AddComponent<Outline>();
            o.effectColor = on ? new Color(0.62f, 0.85f, 0.86f, 0.9f) : new Color(0.85f, 0.88f, 0.9f, 0.35f);
            o.effectDistance = new Vector2(1f, -1f);
            rt.gameObject.AddComponent<Button>().onClick.AddListener(() => onClick());
            StartMenu.Label(rt, title, Vector2.zero, size, 13, on ? HudPalette.Text : HudPalette.Muted, font);
        }
    }
}

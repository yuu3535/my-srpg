using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// セーブ・ロードの枠を選ぶ画面（2026-10-08。仮の最小限）。
    /// メニュー画面（携帯端末。Codex が作っている）ができたら、そちらの「セーブ」から SaveSystem を呼ぶ形に置き換える。
    /// 枠は10ずつのページで出す（スマホでも押しやすい大きさ）。上書きは確かめてから
    /// </summary>
    public static class SaveMenu
    {
        public enum Mode { Save, Load }

        private const int PerPage = 10;
        private static GameObject open;
        private static Text message;

        public static bool IsOpen => open != null;

        public static void Open(Mode mode, int page = 0)
        {
            Close();
            var font = StartMenu.FontOf();
            var canvas = StartMenu.NewCanvas("SaveMenu", 600);
            open = canvas.gameObject;
            var root = canvas.transform;
            var dim = StartMenu.Rect("Dim", root, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            dim.anchorMin = Vector2.zero;
            dim.anchorMax = Vector2.one;
            dim.gameObject.AddComponent<Image>().color = new Color(0.03f, 0.06f, 0.09f, 0.96f);   // 下の画面を押せないように

            int pages = (SaveStore.SlotCount + PerPage - 1) / PerPage;
            page = Mathf.Clamp(page, 0, pages - 1);
            StartMenu.Label(root, mode == Mode.Save ? "セーブ" : "続きから", new Vector2(0f, 168f), new Vector2(300f, 26f), 20, HudPalette.Text, font);
            message = StartMenu.Label(root, mode == Mode.Save ? "セーブする枠を選んでください" : "続ける枠を選んでください",
                new Vector2(0f, 146f), new Vector2(600f, 16f), 11, HudPalette.Muted, font);

            var slots = SaveStore.List();
            for (int i = 0; i < PerPage; i++)
            {
                int index = page * PerPage + i;
                if (index >= slots.Length) break;
                var slot = slots[index];
                float y = 118f - i * 25f;
                var row = Row(root, new Vector2(0f, y), slot, font);
                row.onClick.AddListener(() => Pick(mode, page, slot));
                if (mode == Mode.Load && slot.state != SaveStore.SlotState.Ok) row.interactable = false;
            }

            SmallButton(root, "◀", new Vector2(-120f, -146f), font, page > 0, () => Open(mode, page - 1));
            StartMenu.Label(root, $"{page + 1} / {pages}", new Vector2(0f, -146f), new Vector2(80f, 18f), 12, HudPalette.Silver, font);
            SmallButton(root, "▶", new Vector2(120f, -146f), font, page < pages - 1, () => Open(mode, page + 1));
            SmallButton(root, "閉じる", new Vector2(0f, -172f), font, true, Close);
        }

        public static void Close()
        {
            if (open != null) Object.Destroy(open);
            open = null;
        }

        private static void Pick(Mode mode, int page, SaveStore.Slot slot)
        {
            if (mode == Mode.Load)
            {
                if (SaveSystem.LoadFrom(slot.index, out var why)) Close();
                else message.text = why;
                return;
            }
            if (slot.state != SaveStore.SlotState.Empty)
            {
                Confirm($"No.{slot.index:00} に上書きしますか？", () => DoSave(page, slot.index));
                return;
            }
            DoSave(page, slot.index);
        }

        private static void DoSave(int page, int index)
        {
            bool ok = SaveSystem.SaveTo(index, out var text);
            Open(Mode.Save, page);
            message.text = text;
            message.color = ok ? HudPalette.Teal : new Color(0.95f, 0.6f, 0.55f);
        }

        private static void Confirm(string question, System.Action yes)
        {
            var font = StartMenu.FontOf();
            var panel = StartMenu.Rect("Confirm", open.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300f, 110f));
            panel.gameObject.AddComponent<Image>().color = HudPalette.Panel;
            var line = panel.gameObject.AddComponent<Outline>();
            line.effectColor = new Color(0.85f, 0.88f, 0.9f, 0.85f);
            line.effectDistance = new Vector2(1f, -1f);
            StartMenu.Label(panel, question, new Vector2(0f, 22f), new Vector2(280f, 20f), 14, HudPalette.Text, font);
            SmallButton(panel, "上書きする", new Vector2(-60f, -24f), font, true, () => yes());
            SmallButton(panel, "やめる", new Vector2(60f, -24f), font, true, () => Object.Destroy(panel.gameObject));
        }

        private static Button Row(Transform parent, Vector2 pos, SaveStore.Slot slot, Font font)
        {
            var rt = StartMenu.Rect($"Slot{slot.index:00}", parent, new Vector2(0.5f, 0.5f), pos, new Vector2(560f, 22f));
            rt.gameObject.AddComponent<Image>().color = HudPalette.Panel;
            var button = rt.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.highlightedColor = new Color(1.25f, 1.25f, 1.25f, 1f);
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1f);
            colors.disabledColor = new Color(0.7f, 0.7f, 0.7f, 0.6f);
            button.colors = colors;
            string body = slot.state switch
            {
                SaveStore.SlotState.Ok => $"{slot.data.placeName}",
                SaveStore.SlotState.Unreadable => "（読めないセーブ）",
                _ => "― 空き ―",
            };
            string right = slot.state == SaveStore.SlotState.Ok ? $"{slot.data.savedAt}　{slot.data.PlayTimeText}" : "";
            Cell(rt, $"No.{slot.index:00}", -248f, 56f, TextAnchor.MiddleLeft, HudPalette.Silver, font);
            Cell(rt, body, -40f, 300f, TextAnchor.MiddleLeft, slot.state == SaveStore.SlotState.Ok ? HudPalette.Text : HudPalette.Muted, font);
            Cell(rt, right, 190f, 170f, TextAnchor.MiddleRight, HudPalette.Muted, font);
            return button;
        }

        private static void Cell(Transform parent, string text, float x, float width, TextAnchor anchor, Color color, Font font)
        {
            var t = StartMenu.Label(parent, text, new Vector2(x, 0f), new Vector2(width, 18f), 12, color, font);
            t.alignment = anchor;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
        }

        private static void SmallButton(Transform parent, string title, Vector2 pos, Font font, bool enabled, System.Action onClick)
        {
            var rt = StartMenu.Rect(title, parent, new Vector2(0.5f, 0.5f), pos, new Vector2(96f, 20f));
            rt.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.95f);
            var button = rt.gameObject.AddComponent<Button>();
            button.interactable = enabled;
            button.onClick.AddListener(() => onClick());
            StartMenu.Label(rt, title, Vector2.zero, new Vector2(96f, 20f), 12, enabled ? HudPalette.Silver : HudPalette.Muted, font);
        }
    }
}

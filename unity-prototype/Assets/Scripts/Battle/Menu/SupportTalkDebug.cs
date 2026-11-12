using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle.Menu
{
    /// <summary>
    /// 開発用: 支援会話テスト（2026-11-13 原作者「デバッグで支援会話見れるページもあった方が確認しやすそう」）。
    /// 入口の画面の「支援会話テスト」→ 2Dの探索の回廊で、台本（Resources/Support/support_talks.json）の一覧を出す。
    /// 押すとその支援会話を流し、終わる（CLOSE・最後まで）と一覧に戻る。ランクや見た記録は変えない。戻るときは右下の「最初へ」
    /// </summary>
    public class SupportTalkDebug : MonoBehaviour
    {
        /// <summary>入口から来た（2Dの探索の場面を開いたら一覧を出す）</summary>
        public static bool Pending;

        private Canvas canvas;
        private RectTransform list;
        private Font font, fontEn;

        public static SupportTalkDebug Attach()
        {
            Pending = false;
            return new GameObject("SupportTalkDebug").AddComponent<SupportTalkDebug>();
        }

        private IEnumerator Start()
        {
            font = Resources.Load<Font>("Fonts/ShipporiMincho-SemiBold") ?? StartMenu.FontOf();
            fontEn = Resources.Load<Font>("Fonts/BarlowCondensed-SemiBold") ?? font;
            yield return null;
            yield return null;
            // 起きたときの会話などは閉じて、回廊に立つ
            var dialogue = FindFirstObjectByType<DialogueView>();
            var explore = FindFirstObjectByType<Explore2DController>();
            for (int i = 0; i < 40 && dialogue != null && dialogue.IsPlaying; i++) dialogue.Close();
            if (explore != null) explore.EnterPlace("orcus_castle", "orcus_room_arshe_karima");
            yield return null;
            for (int i = 0; i < 40 && dialogue != null && dialogue.IsPlaying; i++) dialogue.Close();
            Build();
        }

        private void Build()
        {
            var go = new GameObject("SupportTalkDebugCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 470;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1688f, 780f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            var root = (RectTransform)go.transform;
            list = Node("List", root);
            list.anchorMin = Vector2.zero; list.anchorMax = Vector2.one; list.sizeDelta = Vector2.zero;
            list.gameObject.AddComponent<Image>().color = new Color(9f / 255f, 10f / 255f, 13f / 255f, Hub2Textures.Seen(0.9f));
            var area = Node("Area", list);
            area.anchorMin = area.anchorMax = area.pivot = new Vector2(0.5f, 0.5f);
            area.sizeDelta = new Vector2(1688f, 780f);
            Label(area, "DEBUG", 150f, 40f, 200f, 24f, 15, new Color(0.89f, 0.69f, 0.29f), fontEn);
            Label(area, "支援会話テスト（開発用）", 150f, 64f, 900f, 48f, 34, new Color(0.98f, 0.96f, 0.91f), font);
            Label(area, "押すとその支援会話を流します。終わると、この一覧に戻ります（見た記録やランクは変えません）。戻るときは右下の「最初へ」", 150f, 116f, 1400f, 26f, 16, new Color(0.65f, 0.62f, 0.56f), font);
            var talks = SupportTalks.All;
            var roster = SupportRoster.Load();
            if (talks.Count == 0) Label(area, "台本がありません（Resources/Support/support_talks.json）", 150f, 170f, 1200f, 30f, 20, Color.white, font);
            for (int i = 0; i < talks.Count; i++)
            {
                var t = talks[i];
                string an = roster.Find(t.a)?.name ?? t.a, bn = roster.Find(t.b)?.name ?? t.b;
                var row = Node("Talk" + i, area);
                row.anchorMin = row.anchorMax = row.pivot = new Vector2(0f, 1f);
                row.anchoredPosition = new Vector2(150f, -(170f + i * 66f));
                row.sizeDelta = new Vector2(1100f, 56f);
                var bg = row.gameObject.AddComponent<Image>();
                bg.color = new Color(16f / 255f, 14f / 255f, 24f / 255f, Hub2Textures.Seen(0.72f));
                var btn = row.gameObject.AddComponent<Button>();
                var talk = t;
                btn.onClick.AddListener(() => Play(talk));
                Label(row, $"RANK {t.rank}", 20f, 0f, 120f, 56f, 18, new Color(0.89f, 0.69f, 0.29f), fontEn);
                Label(row, $"{an} × {bn}", 140f, 0f, 420f, 56f, 22, new Color(0.98f, 0.96f, 0.91f), font);
                Label(row, (t.draft ? "【仮】 " : "") + t.title + $"　（{t.lines?.Length ?? 0}行）", 560f, 0f, 540f, 56f, 18, new Color(0.8f, 0.78f, 0.72f), font);
            }
        }

        private void Play(SupportTalks.Talk t)
        {
            var dialogue = FindFirstObjectByType<DialogueView>();
            if (dialogue == null) return;
            list.gameObject.SetActive(false);
            dialogue.PlaySupport(t.ToBlock(), Mathf.Max(0, t.RankIndex), t.title, () => { if (list != null) list.gameObject.SetActive(true); });
        }

        private static RectTransform Node(string name, Transform parent)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            return rt;
        }

        private static Text Label(Transform parent, string text, float x, float y, float w, float h, int size, Color color, Font f)
        {
            var rt = Node("Text", parent);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = f;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = TextAnchor.MiddleLeft;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }
    }
}

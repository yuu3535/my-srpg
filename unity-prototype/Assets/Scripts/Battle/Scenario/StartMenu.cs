using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 最初の入口（原作者 2026-10-03: スマホで Unity版を遊んで確かめるため）。探索の場面（Explore3D）を開いたとき、
    /// 「プロローグから」（探索 → 訓練の戦闘）と「試験の戦闘（森の境）」（Battle3D の場面）を選ぶ画面を出す。
    /// 遊んでいるときだけ出す（確認の画像を撮るとき・テストのときは出さない）。画面はコードで組み立てる
    /// </summary>
    public static class StartMenu
    {
        private const string ExploreScene = "Explore3D";
        private const string TrialScene = "Battle3D";

        /// <summary>入口の画面を出している間は、探索を始めない（ExploreController.Start が見る）</summary>
        public static bool Holding { get; private set; }

        private static bool shownOnce;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Hook()
        {
            shownOnce = false;
            Holding = false;   // sceneLoaded（場面の Start より前に呼ばれる）で決める
            SceneManager.sceneLoaded -= OnSceneLoaded;
            SceneManager.sceneLoaded += OnSceneLoaded;
        }

        private static void OnSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            if (Application.isBatchMode) { Holding = false; return; }
            if (scene.name == ExploreScene && !shownOnce) { shownOnce = true; Holding = true; Show(); }
            else if (scene.name == TrialScene) { Holding = false; AddBackButton(); }
            else Holding = false;
        }

        private static Font FontOf() =>
            JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "游明朝", "MS PMincho", "Hiragino Mincho ProN" }, 16);

        private static Canvas NewCanvas(string name, int order)
        {
            var go = new GameObject(name, typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = order;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(844f, 390f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;
            if (EventSystem.current == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            return canvas;
        }

        private static RectTransform Rect(string name, Transform parent, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        private static Text Label(Transform parent, string text, Vector2 pos, Vector2 size, int fontSize, Color color, Font font)
        {
            var rt = Rect("Label", parent, new Vector2(0.5f, 0.5f), pos, size);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = font;
            t.text = text;
            t.fontSize = fontSize;
            t.color = color;
            t.alignment = TextAnchor.MiddleCenter;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;   // 大きい文字が欄の高さで消えないように
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        private static Button SilverButton(Transform parent, string title, string note, Vector2 pos, Font font, System.Action onClick)
        {
            var rt = Rect(title, parent, new Vector2(0.5f, 0.5f), pos, new Vector2(300f, 54f));
            rt.gameObject.AddComponent<Image>().color = HudPalette.Panel;
            var line = rt.gameObject.AddComponent<Outline>();
            line.effectColor = new Color(0.85f, 0.88f, 0.9f, 0.85f);
            line.effectDistance = new Vector2(1f, -1f);
            var button = rt.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.highlightedColor = new Color(1.2f, 1.2f, 1.2f, 1f);
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1f);
            button.colors = colors;
            button.onClick.AddListener(() => onClick());
            Label(rt, title, new Vector2(0f, 8f), new Vector2(290f, 26f), 19, HudPalette.Text, font);
            Label(rt, note, new Vector2(0f, -14f), new Vector2(290f, 16f), 11, HudPalette.Muted, font);
            return button;
        }

        private static void Show()
        {
            var font = FontOf();
            var canvas = NewCanvas("StartMenu", 500);
            var root = canvas.transform;
            var dim = Rect("Dim", root, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            dim.anchorMin = Vector2.zero;
            dim.anchorMax = Vector2.one;
            dim.gameObject.AddComponent<Image>().color = new Color(0.05f, 0.09f, 0.12f, 1f);
            Label(root, "自作SRPG", new Vector2(0f, 120f), new Vector2(500f, 40f), 30, HudPalette.Text, font);
            Label(root, "Unity版の試し（スマホ・ブラウザで遊べる形）", new Vector2(0f, 88f), new Vector2(500f, 20f), 12, HudPalette.Silver, font);
            SilverButton(root, "プロローグから", "探索 → 訓練の戦闘（人形 → ギュンター）", new Vector2(0f, 28f), font, () =>
            {
                Object.Destroy(canvas.gameObject);
                Holding = false;
                Object.FindFirstObjectByType<ExploreController>()?.Begin();
            });
            SilverButton(root, "試験の戦闘", "森の境（ブラウザ版の試験の戦闘と同じ）", new Vector2(0f, -38f), font, () =>
            {
                Holding = false;
                SceneManager.LoadScene(TrialScene);
            });
            Label(root, "戻るときは、ページを読み込み直してください", new Vector2(0f, -110f), new Vector2(500f, 18f), 11, HudPalette.Muted, font);
        }

        /// <summary>試験の戦闘の画面の左下に「最初へ」（入口の画面へ戻る）</summary>
        private static void AddBackButton()
        {
            var font = FontOf();
            var canvas = NewCanvas("BackToStart", 450);
            var rt = Rect("Back", canvas.transform, new Vector2(1f, 0f), new Vector2(-8f, 22f), new Vector2(64f, 18f));
            rt.pivot = new Vector2(1f, 0f);
            rt.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.85f);
            var button = rt.gameObject.AddComponent<Button>();
            button.onClick.AddListener(() => { shownOnce = false; SceneManager.LoadScene(ExploreScene); });
            var t = Label(rt, "最初へ", Vector2.zero, new Vector2(64f, 18f), 11, HudPalette.Silver, font);
            t.rectTransform.anchorMin = t.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        }
    }
}

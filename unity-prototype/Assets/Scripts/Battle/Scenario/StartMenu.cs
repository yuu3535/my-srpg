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
        private const string CorridorScene = "Corridor2D";   // 探索の2D横スクロールの試し（2026-10-03）

        /// <summary>入口の画面を出している間は、探索を始めない（ExploreController.Start が見る）</summary>
        public static bool Holding { get; private set; }

        private static bool shownOnce;
        private static string currentScene;

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
            currentScene = scene.name;
            if (Application.isBatchMode) { Holding = false; return; }
            if (SaveSystem.HasPending) { shownOnce = true; Holding = false; Menu.Hub2Menu.ResetBoot(); AddBackButton(); return; }   // ロード（続きから）で開いた（次にメニューを開くのは長い版）
            if (scene.name == ExploreScene && ExploreHandoff.Pending) { shownOnce = true; Holding = false; AddBackButton(); }   // 2Dの探索から来た
            else if (scene.name == ExploreScene && !shownOnce) { shownOnce = true; Holding = true; Show(); }
            else if (scene.name == TrialScene || scene.name == CorridorScene)
            {
                Holding = false;
                AddBackButton();
                if (scene.name == CorridorScene && Menu.SupportTalkDebug.Pending) Menu.SupportTalkDebug.Attach();   // 支援会話テスト（開発用）
            }
            else Holding = false;
        }

        internal static Font FontOf() =>
            JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "游明朝", "MS PMincho", "Hiragino Mincho ProN" }, 16);

        internal static Canvas NewCanvas(string name, int order)
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

        internal static RectTransform Rect(string name, Transform parent, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        internal static Text Label(Transform parent, string text, Vector2 pos, Vector2 size, int fontSize, Color color, Font font)
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

        internal static Button SilverButton(Transform parent, string title, string note, Vector2 pos, Font font, System.Action onClick)
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

        /// <summary>開発中だけ: 入口に「戦闘テスト」を出す（原作者 2026-11-13。公開の形にするときに false）</summary>
        public static bool ShowBattleTest = true;

        /// <summary>開発中だけ: 入口に「支援会話テスト」を出す（原作者 2026-11-13。公開の形にするときに false）</summary>
        public static bool ShowSupportTest = true;

        /// <summary>タイトル画面（Menu.TitleScreen。正本 docs/10-design/ui/title/title_spec.md。2026-11-13 から）</summary>
        private static void Show()
        {
            Menu.TitleScreen.ShowDev = ShowBattleTest || ShowSupportTest;
            Menu.TitleScreen.Open(new Menu.TitleScreen.Actions
            {
                // はじめから: 枠に新しいデータを作って、プロローグ（2Dの探索・自室）へ
                newGame = slot =>
                {
                    Holding = false;
                    if (Menu.TitleScreen.Instance != null) Object.Destroy(Menu.TitleScreen.Instance.gameObject);
                    if (!SaveSystem.NewGame(slot, out var msg)) Debug.LogWarning("[Title] " + msg);
                },
                // 続きから: いちばん最近のセーブを読む（あとで、ここで枠の一覧を出す。原作者 2026-11-13）
                continueAt = slot =>
                {
                    Holding = false;
                    if (Menu.TitleScreen.Instance != null) Object.Destroy(Menu.TitleScreen.Instance.gameObject);
                    if (!SaveSystem.LoadFrom(slot, out var msg)) Debug.LogWarning("[Title] " + msg);
                },
                battleTest = () =>
                {
                    Holding = false;
                    SceneManager.LoadScene(TrialScene);
                },
                supportTest = () =>
                {
                    Holding = false;
                    Party.Reset();
                    Menu.SupportTalkDebug.Pending = true;
                    SceneManager.LoadScene(CorridorScene);
                },
            });
        }

        /// <summary>入口の画面へ戻る</summary>
        internal static void BackToStart() { shownOnce = false; SceneManager.LoadScene(ExploreScene); }

        /// <summary>試験の戦闘の画面の左下に「最初へ」（入口の画面へ戻る）</summary>
        private static void AddBackButton()
        {
            var font = FontOf();
            var canvas = NewCanvas("BackToStart", 450);
            var rt = Rect("Back", canvas.transform, new Vector2(1f, 0f), new Vector2(-8f, 22f), new Vector2(64f, 18f));
            rt.pivot = new Vector2(1f, 0f);
            rt.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.85f);
            var button = rt.gameObject.AddComponent<Button>();
            button.onClick.AddListener(BackToStart);
            var t = Label(rt, "最初へ", Vector2.zero, new Vector2(64f, 18f), 11, HudPalette.Silver, font);
            t.rectTransform.anchorMin = t.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            if (currentScene == TrialScene) return;   // 試験の戦闘はセーブしない
            if (currentScene == CorridorScene)
            {
                // 2Dの探索は拠点メニュー Hub2（右上の MENU の星）からセーブ・設定を開く（2026-11-09）
                Menu.Hub2Menu.Attach();
                return;
            }
            // セーブ（仮の最小限。メニュー画面ができたら、そちらから開く。2026-10-08）
            var sv = Rect("Save", canvas.transform, new Vector2(1f, 0f), new Vector2(-78f, 22f), new Vector2(64f, 18f));
            sv.pivot = new Vector2(1f, 0f);
            sv.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.85f);
            sv.gameObject.AddComponent<Button>().onClick.AddListener(() => SaveMenu.Open(SaveMenu.Mode.Save));
            var st = Label(sv, "セーブ", Vector2.zero, new Vector2(64f, 18f), 11, HudPalette.Silver, font);
            st.rectTransform.anchorMin = st.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            // 設定（仮の最小限。2026-10-09）
            var cf = Rect("Settings", canvas.transform, new Vector2(1f, 0f), new Vector2(-148f, 22f), new Vector2(64f, 18f));
            cf.pivot = new Vector2(1f, 0f);
            cf.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.85f);
            cf.gameObject.AddComponent<Button>().onClick.AddListener(SettingsMenu.Open);
            var cft = Label(cf, "設定", Vector2.zero, new Vector2(64f, 18f), 11, HudPalette.Silver, font);
            cft.rectTransform.anchorMin = cft.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        }
    }
}

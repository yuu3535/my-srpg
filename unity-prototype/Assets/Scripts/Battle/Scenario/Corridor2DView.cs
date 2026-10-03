using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 探索の2D横スクロール（オルクス城の回廊）の試し（原作者 2026-10-03）。
    /// 層の重ね方は原作者が debug/corridor_layers.html で決めた値（Assets/Data/Corridors/*.json）。
    /// 座標はゲームの基準画面 844×390（ブラウザの道具と同じ）。層の横の位置 = 層の x − カメラ × 速さ。
    /// アルシェは画面の端の ◀ ▶（押している間）かキーボードの ← → で歩く。カメラはアルシェに付いていく。
    /// 会話・扉はまだない（次の段）
    /// </summary>
    public class Corridor2DView : MonoBehaviour
    {
        [Serializable]
        public class CorridorLayer
        {
            public string name, kind, file;
            public CorridorModule[] modules;   // kind "modules": 左から順に並べる絵（左の端・アーチ…・右の端）
            public float speed, x, height, bottom, overlap, opacity = 1f, top, tile, rows, shade;
            public bool repeat, mirror;
        }

        /// <summary>並べる絵の1つ。overlap＝左の絵と重ねる幅、dy＝上下のずれ（下へ正）。継ぎ目を合わせる（debug/corridor_layers.html で決める）</summary>
        [Serializable]
        public class CorridorModule
        {
            public string file;
            public float overlap, dy;
            public float dx;             // 左右のずれ（右へ正）。並び（次の絵の位置）は変えない
            public float scale = 1f;     // 大きさ（1＝層の高さ）。下の端をそろえて大きくする
            public bool front;           // ほかの絵より手前に出す（継ぎ目を隠す）
            public float shadeTop;       // 絵の上からこの高さまで、後ろに暗い天井の色を敷く（端の絵の上の透けた三角から空が見えないように）
        }

        /// <summary>出口（回廊の端の通路など）。近づくと下に「label」が出て、押すと scene へ（空ならまだつながっていない）</summary>
        [Serializable]
        public class CorridorExit
        {
            public float x;              // 負の値は右の端からの距離
            public string label, scene;
        }

        [Serializable]
        public class CorridorFile
        {
            public string corridor;
            public float heroFeetY = 352f, heroHeight = 96f, length = 2532f;
            public float walkMin = 40f, walkMax = -40f;   // 歩ける範囲（walkMax が負なら右の端からの距離）
            public float cameraMargin;                      // カメラが回廊の両端からこれだけ内側で止まる（端の外の空を見せない）
            public CorridorLayer[] layers;
            public CorridorExit[] exits;
        }

        [SerializeField] private TextAsset corridorJson;
        [SerializeField] private Texture2D[] textures;     // 層の画像（ファイル名で引く）
        [SerializeField] private Texture2D hero;           // アルシェの SD
        [SerializeField] private float walkSpeed = 220f;   // 1秒に歩く幅（844 の画面で）
        [SerializeField] private Camera targetCamera;

        private const float ScreenW = 844f, ScreenH = 390f;
        private static readonly Color CeilingShade = new Color(0.11f, 0.094f, 0.133f, 1f);   // 端の絵の壁の暗いところの色
        private CorridorFile data;
        private RectTransform root, heroRect;
        private readonly List<(CorridorLayer layer, RectTransform box, List<RawImage> tiles, float width)> built = new List<(CorridorLayer, RectTransform, List<RawImage>, float)>();
        private float playerX = 422f, cameraX;
        private int holding;            // −1 左 / 0 / 1 右（画面の ◀ ▶）
        private RectTransform exitButton;
        private Text exitLabel, toast;
        private CorridorExit nearExit;
        private readonly Dictionary<RawImage, Vector2> moduleHome = new Dictionary<RawImage, Vector2>();
        private float toastUntil;
        private bool facingLeft;
        private float walkTime;

        public float PlayerX { get => playerX; set { playerX = value; Apply(); } }
        public float Length => data?.length ?? 0f;

        private void Start() => Build();

        public void Build()
        {
            data = JsonUtility.FromJson<CorridorFile>(corridorJson.text);
            foreach (Transform child in transform) DestroyImmediate(child.gameObject);
            built.Clear();
            moduleHome.Clear();
            var canvasObject = new GameObject("Corridor", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            var canvas = canvasObject.GetComponent<Canvas>();
            // カメラの画面に描く（確認の画像を撮れるように）。カメラがなければ画面にそのまま
            var cam = targetCamera != null ? targetCamera : Camera.main;
            if (cam != null) { canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = cam; canvas.planeDistance = 1f; }
            else canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(ScreenW, ScreenH);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;
            // 844×390 の画面を真ん中に（横に長い画面では左右にも層を並べて埋める）
            root = NewRect("Screen", canvasObject.transform);
            root.anchorMin = root.anchorMax = root.pivot = new Vector2(0.5f, 0.5f);
            root.sizeDelta = new Vector2(ScreenW, ScreenH);
            var back = NewRect("Black", canvasObject.transform);
            back.anchorMin = Vector2.zero; back.anchorMax = Vector2.one; back.sizeDelta = Vector2.zero;
            back.gameObject.AddComponent<Image>().color = new Color(0.03f, 0.04f, 0.06f, 1f);
            back.SetAsFirstSibling();

            foreach (var layer in data.layers ?? Array.Empty<CorridorLayer>())
            {
                var box = NewRect(layer.name, root);
                box.anchorMin = Vector2.zero; box.anchorMax = Vector2.one; box.sizeDelta = Vector2.zero;
                var tiles = new List<RawImage>();
                if (layer.kind == "modules")
                {
                    // 左から順に並べる（くり返さない）。幅は高さに合わせ、重ね幅だけ詰める。回廊の長さはここで決まる
                    float cursor = 0f, end = 0f;
                    var fronts = new List<RawImage>();
                    var backs = new List<RawImage>();   // 天井の色は「手前」でもいちばん奥（となりの絵の上に出さない）
                    for (int m = 0; m < (layer.modules?.Length ?? 0); m++)
                    {
                        var mod = layer.modules[m];
                        var mt = Texture(mod.file);
                        if (mt == null) continue;
                        float mw = mt.width * (layer.height / mt.height);
                        if (m > 0) cursor -= mod.overlap;
                        float sc = mod.scale > 0f ? mod.scale : 1f;
                        // 大きさは下の端と横の真ん中をそろえて変える
                        float w2 = mw * sc, h2 = layer.height * sc;
                        float left = cursor + mod.dx - (w2 - mw) / 2f, top = layer.bottom - h2 + mod.dy;
                        if (mod.shadeTop > 0f)
                        {
                            var shade = Place(NewRect(mod.file + " 天井", box), left, top, w2, mod.shadeTop).gameObject.AddComponent<RawImage>();
                            shade.color = CeilingShade;
                            shade.raycastTarget = false;
                            tiles.Add(shade);
                            backs.Add(shade);
                        }
                        var img = Place(NewRect(mod.file, box), left, top, w2, h2).gameObject.AddComponent<RawImage>();
                        img.texture = mt;
                        img.raycastTarget = false;
                        tiles.Add(img);
                        if (mod.front) fronts.Add(img);
                        cursor += mw;
                        end = cursor;
                    }
                    data.length = Mathf.Max(ScreenW, end);
                    // 手前に出す絵を、ほかの絵の後に描く
                    foreach (var f in fronts) f.transform.SetAsLastSibling();
                    foreach (var b in backs) b.transform.SetAsFirstSibling();
                    built.Add((layer, box, tiles, 0f));
                    continue;
                }
                if (layer.kind == "floor")
                {
                    float h = Mathf.Max(1f, layer.bottom - layer.top);
                    int rows = Mathf.Max(1, Mathf.RoundToInt(layer.rows));
                    var floorTex = Texture(layer.file) ?? StripeTexture();
                    for (int r = 0; r < rows; r++)
                    {
                        var row = Place(NewRect("Row" + r, box), -ScreenW, layer.top + r * h / rows, ScreenW * 3f, h / rows + 0.5f).gameObject.AddComponent<RawImage>();
                        row.texture = floorTex;
                        row.raycastTarget = false;
                        tiles.Add(row);
                    }
                    var shade = Place(NewRect("Shade", box), -ScreenW, layer.top, ScreenW * 3f, h).gameObject.AddComponent<RawImage>();
                    shade.texture = ShadeTexture(layer.shade);
                    shade.raycastTarget = false;
                    built.Add((layer, box, tiles, Mathf.Max(8f, layer.tile)));
                    continue;
                }
                var tex = Texture(layer.file);
                if (tex == null) continue;
                float w = tex.width * (layer.height / tex.height);
                float step = Mathf.Max(8f, w - layer.overlap);
                // 横に長い画面でも端まで: 844 の画面の左右 1 枚分も並べる
                int count = layer.repeat ? Mathf.CeilToInt(ScreenW * 3f / step) + 2 : 1;
                for (int i = 0; i < count; i++)
                {
                    var img = NewRect(layer.name + i, box).gameObject.AddComponent<RawImage>();
                    img.texture = tex;
                    img.color = new Color(1f, 1f, 1f, layer.opacity);
                    img.raycastTarget = false;
                    if (layer.mirror && i % 2 == 1) img.uvRect = new Rect(1f, 0f, -1f, 1f);
                    tiles.Add(img);
                }
                built.Add((layer, box, tiles, w));
            }

            // アルシェ
            heroRect = NewRect("Hero", root);
            var heroImage = heroRect.gameObject.AddComponent<RawImage>();
            heroImage.texture = hero;
            heroImage.raycastTarget = false;
            float heroW = hero != null ? data.heroHeight * hero.width / hero.height : data.heroHeight * 0.56f;
            heroRect.anchorMin = heroRect.anchorMax = new Vector2(0f, 1f);
            heroRect.pivot = new Vector2(0.5f, 0f);
            heroRect.sizeDelta = new Vector2(heroW, data.heroHeight);

            // 画面の端の ◀ ▶（押している間歩く。探索の見本 2026-10-02 の形）
            WalkButton(canvasObject.transform, true);
            WalkButton(canvasObject.transform, false);
            BuildExitButton(canvasObject.transform);
            if (Application.isPlaying && EventSystem.current == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            Apply();
        }

        private void WalkButton(Transform parent, bool left)
        {
            var rt = NewRect(left ? "WalkLeft" : "WalkRight", parent);
            rt.anchorMin = rt.anchorMax = new Vector2(left ? 0f : 1f, 0.5f);
            rt.pivot = new Vector2(left ? 0f : 1f, 0.5f);
            rt.anchoredPosition = new Vector2(left ? 10f : -10f, 0f);
            rt.sizeDelta = new Vector2(56f, 96f);
            rt.gameObject.AddComponent<Image>().color = new Color(0.05f, 0.08f, 0.12f, 0.35f);
            var label = NewRect("Arrow", rt).gameObject.AddComponent<Text>();
            label.rectTransform.anchorMin = Vector2.zero; label.rectTransform.anchorMax = Vector2.one; label.rectTransform.sizeDelta = Vector2.zero;
            label.font = JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "MS PMincho" }, 30);
            label.text = left ? "◀" : "▶";
            label.fontSize = 30;
            label.alignment = TextAnchor.MiddleCenter;
            label.color = new Color(0.85f, 0.9f, 0.92f, 0.85f);
            label.raycastTarget = false;
            var trigger = rt.gameObject.AddComponent<EventTrigger>();
            void On(EventTriggerType type, Action act)
            {
                var entry = new EventTrigger.Entry { eventID = type };
                entry.callback.AddListener(_ => act());
                trigger.triggers.Add(entry);
            }
            On(EventTriggerType.PointerDown, () => holding = left ? -1 : 1);
            On(EventTriggerType.PointerUp, () => holding = 0);
            On(EventTriggerType.PointerExit, () => holding = 0);
        }

        private void Update()
        {
            if (data == null) return;
            int dir = holding;
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.leftArrowKey.isPressed || kb.aKey.isPressed) dir = -1;
                else if (kb.rightArrowKey.isPressed || kb.dKey.isPressed) dir = 1;
            }
            if (dir != 0)
            {
                playerX = Mathf.Clamp(playerX + dir * walkSpeed * Time.deltaTime, data.walkMin, data.walkMax > 0f ? data.walkMax : data.length + Mathf.Min(data.walkMax, -40f));   // 負の値は右の端からの距離
                facingLeft = dir < 0;
                walkTime += Time.deltaTime;
            }
            else walkTime = 0f;
            if (kb != null && (kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame) && nearExit != null) UseExit();
            Apply();
        }

        /// <summary>出口の札（画面の下の真ん中。近くにいるときだけ）と、短い知らせ</summary>
        private void BuildExitButton(Transform parent)
        {
            var font = JapaneseFont.Get(new[] { "Noto Serif JP", "Yu Mincho", "MS PMincho" }, 16);
            exitButton = NewRect("Exit", parent);
            exitButton.anchorMin = exitButton.anchorMax = exitButton.pivot = new Vector2(0.5f, 0f);
            exitButton.anchoredPosition = new Vector2(0f, 14f);
            exitButton.sizeDelta = new Vector2(220f, 34f);
            exitButton.gameObject.AddComponent<Image>().color = new Color(0.035f, 0.08f, 0.12f, 0.9f);
            var line = exitButton.gameObject.AddComponent<Outline>();
            line.effectColor = new Color(0.85f, 0.88f, 0.9f, 0.8f);
            line.effectDistance = new Vector2(1f, -1f);
            var exitBtn = exitButton.gameObject.AddComponent<Button>();
            exitBtn.transition = Selectable.Transition.None;
            exitBtn.onClick.AddListener(UseExit);
            exitLabel = NewRect("Label", exitButton).gameObject.AddComponent<Text>();
            exitLabel.rectTransform.anchorMin = Vector2.zero; exitLabel.rectTransform.anchorMax = Vector2.one; exitLabel.rectTransform.sizeDelta = Vector2.zero;
            exitLabel.font = font; exitLabel.fontSize = 16; exitLabel.alignment = TextAnchor.MiddleCenter;
            exitLabel.color = new Color(0.94f, 0.95f, 0.93f); exitLabel.raycastTarget = false;
            exitButton.gameObject.SetActive(false);
            toast = NewRect("Toast", parent).gameObject.AddComponent<Text>();
            toast.rectTransform.anchorMin = toast.rectTransform.anchorMax = toast.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            toast.rectTransform.anchoredPosition = new Vector2(0f, 60f);
            toast.rectTransform.sizeDelta = new Vector2(500f, 30f);
            toast.font = font; toast.fontSize = 15; toast.alignment = TextAnchor.MiddleCenter;
            toast.color = new Color(0.94f, 0.95f, 0.93f); toast.raycastTarget = false;
            var shadow = toast.gameObject.AddComponent<Shadow>();
            shadow.effectColor = new Color(0f, 0f, 0f, 0.85f);
            toast.gameObject.SetActive(false);
        }

        private void UseExit()
        {
            if (nearExit == null) return;
            if (!string.IsNullOrEmpty(nearExit.scene) && Application.isPlaying)
            {
                UnityEngine.SceneManagement.SceneManager.LoadScene(nearExit.scene);
                return;
            }
            toast.text = $"{nearExit.label}（まだつながっていません）";
            toast.gameObject.SetActive(true);
            toastUntil = Time.unscaledTime + 2f;
        }

        private float ExitX(CorridorExit e) => e.x < 0f ? data.length + e.x : e.x;

        /// <summary>確認の画像用: 出口の近くにいる形を見る</summary>
        public CorridorExit NearExit => nearExit;

        /// <summary>カメラと層の位置を今のアルシェの位置に合わせる</summary>
        private void Apply()
        {
            if (data == null || root == null) return;
            cameraX = Mathf.Clamp(playerX - ScreenW / 2f, data.cameraMargin, Mathf.Max(data.cameraMargin, data.length - ScreenW - data.cameraMargin));
            foreach (var (layer, box, tiles, width) in built)
            {
                float shift = layer.x - cameraX * layer.speed;
                if (layer.kind == "modules")
                {
                    // 組み立てたときの位置（Build で決めた）を、流れる分だけずらす
                    foreach (var t in tiles)
                    {
                        if (!moduleHome.TryGetValue(t, out var home)) moduleHome[t] = home = t.rectTransform.anchoredPosition;
                        t.rectTransform.anchoredPosition = home + new Vector2(shift, 0f);
                    }
                    continue;
                }
                if (layer.kind == "floor")
                {
                    // 床は素材の幅ごとにくり返す（RawImage の uv をずらす）
                    foreach (var row in tiles)
                    {
                        float span = row.rectTransform.sizeDelta.x;
                        row.uvRect = new Rect((-shift - ScreenW) / width, 0f, span / width, 1f);
                    }
                    continue;
                }
                float step = Mathf.Max(8f, width - layer.overlap);
                float start = shift;
                if (layer.repeat) { start = shift % step; if (start > 0f) start -= step; start -= Mathf.Ceil(ScreenW / step) * step; }
                for (int i = 0; i < tiles.Count; i++)
                    Place(tiles[i].rectTransform, start + i * step, layer.bottom - layer.height, width, layer.height);
            }
            nearExit = (data.exits ?? Array.Empty<CorridorExit>()).Where(e => Mathf.Abs(ExitX(e) - playerX) < 70f).OrderBy(e => Mathf.Abs(ExitX(e) - playerX)).FirstOrDefault();
            if (exitButton != null)
            {
                exitButton.gameObject.SetActive(nearExit != null);
                if (nearExit != null) exitLabel.text = nearExit.label;
            }
            if (toast != null && toast.gameObject.activeSelf && Application.isPlaying && Time.unscaledTime > toastUntil) toast.gameObject.SetActive(false);
            if (heroRect != null)
            {
                float bob = walkTime > 0f ? Mathf.Abs(Mathf.Sin(walkTime * 9f)) * 3f : 0f;   // 歩くときの小さな上下
                heroRect.anchoredPosition = new Vector2(playerX - cameraX, -data.heroFeetY + bob);
                heroRect.localScale = new Vector3(facingLeft ? -1f : 1f, 1f, 1f);
            }
        }

        private Texture2D Texture(string file)
        {
            if (string.IsNullOrEmpty(file) || textures == null) return null;
            string name = System.IO.Path.GetFileNameWithoutExtension(file);
            return textures.FirstOrDefault(t => t != null && t.name == name);
        }

        /// <summary>床の素材がまだないときの仮の縞（ブラウザの道具と同じ）</summary>
        private static Texture2D StripeTexture()
        {
            var tex = new Texture2D(60, 4, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat };
            for (int x = 0; x < 60; x++)
                for (int y = 0; y < 4; y++)
                    tex.SetPixel(x, y, x >= 58 ? new Color32(0x3d, 0x3a, 0x46, 255) : new Color32(0x5c, 0x58, 0x66, 255));
            tex.Apply();
            return tex;
        }

        /// <summary>床の奥を暗くする（上が暗く、下で消える）</summary>
        private static Texture2D ShadeTexture(float shade)
        {
            var tex = new Texture2D(1, 32, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < 32; y++) tex.SetPixel(0, y, new Color(10 / 255f, 14 / 255f, 22 / 255f, shade * y / 31f));
            tex.Apply();
            return tex;
        }

        private static RectTransform NewRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        private static RectTransform Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
            return rt;
        }
    }
}

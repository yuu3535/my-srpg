using UnityEngine;
using UnityEngine.UI;

namespace Srpg.Battle
{
    /// <summary>
    /// 探索の新しい画面（探索の仕様書 explore_spec.md・探索の札 E。2026-11-14）のための入口。
    /// 札・矢印・縁の光などは ExploreOverlay が描く。ここは「部屋の座標 → 画面の位置」・走る・縁の光を置く層を出すだけ
    /// </summary>
    public partial class Corridor2DView
    {
        /// <summary>新しい探索の画面を使う（古い ◀ ▶・下の札・◆の印を出さない）</summary>
        public bool Modern { get; set; }

        /// <summary>走る（矢印の長押し。1秒に 900px＝場所の座標で 450）</summary>
        public bool Running { get; set; }
        public const float RunSpeed = 450f;

        /// <summary>今のカメラの左の端（場所の座標）</summary>
        public float CameraX => cameraX;

        /// <summary>アルシェの足元の高さ（場所の座標）</summary>
        public float PlayerY => playerY < 0f ? (data?.heroFeetY ?? 0f) : playerY;

        public float FeetY => data?.heroFeetY ?? 0f;

        /// <summary>歩ける範囲の端にいるか</summary>
        public bool AtMin => data != null && playerX <= WalkMinX + 0.5f;
        public bool AtMax => data != null && playerX >= WalkMaxX - 0.5f;

        /// <summary>カメラがその向きの端まで来ているか（矢印は、その向きにまだ部屋が続くときだけ出す。仕様書 §6.2）</summary>
        public bool CamAtMin => data != null && cameraX <= CamLo + 0.5f;
        public bool CamAtMax => data != null && cameraX >= CamHi - 0.5f;
        private float CamLo => data.cameraMargin + ScreenW / 2f * (1f / Mathf.Max(0.1f, BaseZoom) - 1f);
        private float CamHi => Mathf.Max(CamLo, data.length - ScreenW - data.cameraMargin - ScreenW / 2f * (1f / Mathf.Max(0.1f, BaseZoom) - 1f));

        /// <summary>画面の ◀ ▶ と同じ: −1 左・0・1 右（ExploreOverlay の矢印から）</summary>
        public void Hold(int dir) => holding = dir;

        /// <summary>カメラと一緒に動く層（縁の光など）。家具の絵の手前・人の奥。組み立て直すと作り直される</summary>
        public RectTransform WorldLayer => worldLayer;
        private RectTransform worldLayer;

        private void BuildWorldLayer()
        {
            worldLayer = NewRect("部屋の上の層", root);
            worldLayer.anchorMin = worldLayer.anchorMax = worldLayer.pivot = new Vector2(0f, 1f);
            worldLayer.sizeDelta = Vector2.zero;
            if (heroRect != null) worldLayer.SetSiblingIndex(heroRect.GetSiblingIndex());
        }

        private void ApplyWorldLayer()
        {
            if (worldLayer != null) worldLayer.anchoredPosition = new Vector2(-cameraX, 0f);
        }

        /// <summary>場所の座標 (x, y) が、画面のどこに映っているか（画面の点。寄り・引きも入れて）</summary>
        public Vector2 ScreenOf(float x, float y)
        {
            if (root == null) return Vector2.zero;
            var local = new Vector3(x - cameraX - ScreenW / 2f, ScreenH / 2f - y, 0f);
            var world = root.TransformPoint(local);
            var canvas = root.GetComponentInParent<Canvas>();
            var cam = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null;
            return RectTransformUtility.WorldToScreenPoint(cam, world);
        }

        /// <summary>画面の点が、場所の座標のどこか（ScreenOf の逆）</summary>
        public Vector2 WorldOf(Vector2 screen)
        {
            if (root == null) return Vector2.zero;
            var canvas = root.GetComponentInParent<Canvas>();
            var cam = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay ? canvas.worldCamera : null;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(root, screen, cam, out var local);
            return new Vector2(local.x + ScreenW / 2f + cameraX, ScreenH / 2f - local.y);
        }
    }
}

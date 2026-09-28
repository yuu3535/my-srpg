using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 屋内・城の場所の断面の見せ方（マップ担当の所見 2026-09-28）: カメラ側の辺に立つ高い壁・柱を低く切り、部屋の中を見せる。
    /// 奥の辺の壁は高いまま。盤面を回すとカメラ側の辺が変わるので、向きが変わるたびに切る壁を選び直す。
    /// 半透明にするだけだと、部屋の壁がいつも半透明になるので、切る方を基本にする。真上から見るときは切らない
    /// </summary>
    public partial class Board3DView
    {
        private const float CutHeight = 0.25f;      // 切った壁の天面の高さ
        private const float CutThreshold = 1.0f;    // これより高いマス（壁・柱）を切る対象にする
        private float lastCutYaw = float.NaN;
        private bool lastCutTop;

        /// <summary>その壁のマスが今の向きで切られているか（確認用）</summary>
        public bool IsCut(Vector2Int cell) =>
            tiles.TryGetValue(cell, out var tile) && tile != null && tile.transform.localScale.y < 0.99f;

        /// <summary>カメラの向きに合わせて、カメラ側の壁を切る・戻す（向きが変わったときだけ計算する）</summary>
        private void UpdateCutaway()
        {
            if (map == null || !map.FromLayoutFile || targetCamera == null) return;
            var forward = targetCamera.transform.forward;
            bool top = pitch > 80f;
            float yawNow = Mathf.Atan2(forward.x, forward.z) * Mathf.Rad2Deg;
            if (!float.IsNaN(lastCutYaw) && Mathf.Abs(Mathf.DeltaAngle(yawNow, lastCutYaw)) < 1f && top == lastCutTop) return;
            lastCutYaw = yawNow;
            lastCutTop = top;
            var ground = new Vector2(forward.x, forward.z).normalized;
            foreach (var pair in tiles)
            {
                var cell = pair.Key;
                var tile = pair.Value;
                if (tile == null || map.IsVoid(cell)) continue;
                float full = map.TopHeight(cell);
                if (full < CutThreshold) continue;
                bool cut = false;
                if (!top)
                {
                    // 斜めも見る（角の壁は斜めにしか床と接していない）
                    for (int dy = -1; dy <= 1 && !cut; dy++)
                    for (int dx = -1; dx <= 1 && !cut; dx++)
                    {
                        if (dx == 0 && dy == 0) continue;
                        var n = cell + new Vector2Int(dx, dy);
                        if (!map.InBounds(n) || map.IsVoid(n) || map.TopHeight(n) >= CutThreshold) continue;
                        // マスの +x は世界の +x、マスの +y（南）は世界の −z。床のマスが壁より奥（カメラの向き）にあれば、この壁は手前
                        var dir = new Vector2(dx, -dy).normalized;
                        if (Vector2.Dot(dir, ground) > 0.3f) cut = true;
                    }
                    // 外側の層の壁: カメラの向きに2マス先まで見て、その先に通れる床があれば手前の壁（廊下の扉の脇の壁など）
                    if (!cut)
                    {
                        var step = new Vector2Int(Mathf.Abs(ground.x) > 0.38f ? (int)Mathf.Sign(ground.x) : 0, Mathf.Abs(ground.y) > 0.38f ? -(int)Mathf.Sign(ground.y) : 0);
                        for (int k = 1; k <= 2 && !cut; k++)
                        {
                            var n = cell + step * k;
                            if (map.InBounds(n) && TerrainRules.CanEnter(map.TerrainAt(n), false)) cut = true;
                        }
                    }
                }
                // タイルは天面が原点で下へ伸びる形。天面を CutHeight に下げ、下の端は同じ所に残す
                float scale = cut ? (CutHeight + TileHeight) / (full + TileHeight) : 1f;
                var p = tile.transform.localPosition;
                tile.transform.localPosition = new Vector3(p.x, cut ? CutHeight : full, p.z);
                tile.transform.localScale = new Vector3(1f, scale, 1f);
            }
        }
    }
}

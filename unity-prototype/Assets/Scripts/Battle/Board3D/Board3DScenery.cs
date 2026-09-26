using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 戦えるマスのまわり（8マス）に置く、見た目だけの地形（原作者 2026-09-27: 寄りの画面を基本にし、盤面の外を透明にしない）。
    /// 寄りの画面の端まで景色で埋めて、盤面が闇に浮いた島に見えないようにする。
    /// - 盤面の辺から出ている道（石畳・土道・水堀）は、そのまま外へ続ける
    /// - すぐ外の1マスは低い下草と茂み（盤面の端のキャラを隠さない）
    /// - その外は、外へ行くほど高くなる茂みと木、奥には岩の崖
    /// - 手前（基本の向きのカメラの側）は低く保つ
    /// 押しても選べない（当たり判定を付けない）。配置はマスの位置から決めるので、同じマップなら毎回同じ
    /// </summary>
    public static class Board3DScenery
    {
        public const int DefaultMargin = 8;   // 寄りの画面で、盤面の端に寄っても景色の外が見えない幅（斜めのときは画面の角まで）

        public static void Surround(Board3DMap map, int margin = DefaultMargin)
        {
            for (int r = -margin; r < map.Rows + margin; r++)
            for (int c = -margin; c < map.Columns + margin; c++)
            {
                var cell = new Vector2Int(c, r);
                if (map.InBounds(cell)) continue;
                int dx = c < 0 ? -c : c >= map.Columns ? c - map.Columns + 1 : 0;
                int dy = r < 0 ? -r : r >= map.Rows ? r - map.Rows + 1 : 0;
                int d = Mathf.Max(dx, dy);
                float h = Hash(c, r);

                // 道の続き: 上下の辺の道は上下へ、左右の辺の道・水堀は左右へ、まっすぐ延ばす
                if (dx == 0)
                {
                    char edge = map.TerrainAt(new Vector2Int(c, r < 0 ? 0 : map.Rows - 1));
                    if (edge == 's' || edge == 'd') { map.SetScenery(cell, edge, 0f); continue; }
                }
                if (dy == 0)
                {
                    char edge = map.TerrainAt(new Vector2Int(c < 0 ? 0 : map.Columns - 1, r));
                    if (edge == 's' || edge == 'd') { map.SetScenery(cell, edge, 0f); continue; }
                    if (edge == '~') { map.SetScenery(cell, '~', map.TopHeight(new Vector2Int(Mathf.Clamp(c, 0, map.Columns - 1), r))); continue; }
                }

                bool front = r >= map.Rows;
                bool side = !front && r >= 0;   // 左右（基本の向きでは斜め手前にも来る）
                if (d == 1)
                {
                    // すぐ外: 低い下草。ところどころ低い茂み
                    bool bush = h < 0.3f;
                    map.SetScenery(cell, bush ? 't' : 'g', bush ? 0.25f : 0f);
                    continue;
                }
                float height = front
                    ? 0.08f + 0.12f * h + Mathf.Min(d - 2, 4) * 0.06f
                    : 0.3f + 0.12f * h + Mathf.Min(d - 2, 4) * 0.15f;
                char type = !front && d >= 3 && h > 0.7f ? 'c' : (h > 0.55f && d == 2 ? 'g' : 't');
                map.SetScenery(cell, type, height);
                // 木は3マス目から。奥は多め、左右・手前は少なめ（盤面の端を隠さない）
                float treeChance = front ? 0.12f : side ? 0.36f : 0.46f;
                if (type == 't' && d >= 3 && h < treeChance) map.SceneryTrees.Add(cell);
            }
        }

        /// <summary>マスの位置から決まる 0〜1 の値（毎回同じ配置にするため）</summary>
        public static float Hash(int c, int r)
        {
            unchecked
            {
                int n = c * 73856093 ^ r * 19349663 ^ 0x5bd1e995;
                n = (n << 13) ^ n;
                return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483648f;
            }
        }
    }
}

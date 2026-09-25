using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 斜め見下ろし（アイソメトリック・横2:縦1）のマス目と、画面上の位置の変換。
    /// 1マスの菱形は横 1 ワールド単位（マップ絵の 128px）、縦 0.5。
    /// マス(0,0)の菱形の上の頂点がワールドの原点。列(x)が増えると右下、行(y)が増えると左下へ並ぶ
    /// （ブラウザ版の斜め見下ろし表示・マップ絵の下絵と同じ向き）。
    /// </summary>
    public static class IsoGrid
    {
        public const float TileWidth = 1f;
        public const float TileHeight = 0.5f;

        /// <summary>マス(col,row)の菱形の中心</summary>
        public static Vector2 CellCenter(int col, int row)
        {
            return new Vector2((col - row) * TileWidth * 0.5f, -(col + row) * TileHeight * 0.5f - TileHeight * 0.5f);
        }

        /// <summary>画面上の位置が乗っているマス（盤面の外でも計算上のマスを返す）</summary>
        public static Vector2Int WorldToCell(Vector2 world)
        {
            float u = world.x / (TileWidth * 0.5f);     // col - row
            float v = -world.y / (TileHeight * 0.5f);   // col + row
            return new Vector2Int(Mathf.FloorToInt((u + v) * 0.5f), Mathf.FloorToInt((v - u) * 0.5f));
        }

        /// <summary>奥（col+row が小さい）ほど後ろに描く</summary>
        public static int SortingOrder(int col, int row)
        {
            return (col + row) * 10;
        }

        public static bool InBounds(Vector2Int cell, int cols, int rows)
        {
            return cell.x >= 0 && cell.y >= 0 && cell.x < cols && cell.y < rows;
        }
    }
}

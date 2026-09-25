using System;

namespace Srpg.Battle
{
    /// <summary>
    /// ブラウザ版から書き出した戦闘データ（tools/export_unity_battle.js が作る JSON）。
    /// データの正本はブラウザ版。Unity側では読むだけで書き換えない。
    /// </summary>
    [Serializable]
    public class BattleDataFile
    {
        public string battleId;
        public int cols;
        public int rows;
        public TileData[] tiles;
        public IsoData iso;
        public UnitData[] units;
    }

    [Serializable]
    public class TileData
    {
        public int x;
        public int y;
        public string type;   // wall（通れない）/ void（マスがない）
    }

    /// <summary>斜め見下ろしのマップ絵。tileW: 絵の上の菱形1マスの横幅(px)、origin: マス(0,0)の菱形の上の頂点(px)</summary>
    [Serializable]
    public class IsoData
    {
        public string image;
        public int tileW;
        public int originX;
        public int originY;
        public int width;
        public int height;
    }

    [Serializable]
    public class UnitData
    {
        public string id;
        public string name;
        public string side;   // ally / enemy
        public int x;
        public int y;
        public int move;
        public int attackRange;
        public string token;
    }
}

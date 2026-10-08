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
        public MapItemData[] mapItems;   // 拾える消耗品
        public string timeOfDay;         // 3Dの盤面の時間帯（Board3DMood: day / dusk）
        public string title;             // 戦況の画面の見出し（なければ「テスト戦闘」）
        public string chapter;           // 左上の Chapter（例: Prologue）
        public string location;          // 左上の戦場名（戦う場所・戦闘の名前）
        public string victoryText;       // 勝利条件の文（なければ「すべての敵を撃破する」）
        public string defeatText;        // 敗北条件の文（なければ「味方の全滅」）
        public bool mercy;               // 手加減（訓練）: 味方のHPは1より下がらない（プロローグの訓練。原作者 2026-09-28）
    }

    /// <summary>消耗品（ブラウザ版の mapItems の item。type: heal なら value だけHPを回復）</summary>
    [Serializable]
    public class ItemData
    {
        public string id;
        public string name;
        public string type;
        public int value;
    }

    [Serializable]
    public class MapItemData
    {
        public int x;
        public int y;
        public ItemData item;
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
        public bool flying;   // 飛行（水堀・遮蔽物・石の基礎・茂みを通り抜けられる。止まれるマスは TerrainRules）
        public ItemData[] items;   // 最初から持っている消耗品（なければ空。原作者 2026-09-28: 落ちている物を拾うより、味方どうしの交換で渡す）
        public bool boss;          // 倒したときの経験値を足す（成長 2026-10-09）
        public bool reserve;       // 控え: 最初は戦いに出ない。ほかの敵を全部倒すと出てくる（プロローグの訓練のギュンター。原作者 2026-10-02）
        public int[] wait;         // 控えの待つ位置 [x, y]（戦う範囲の外で見守る。なければ空＝盤面にいない）。出るときは positions の位置へ
        public string enter;       // 控えの入り方: "teleport"＝転移で一瞬で現れる（ギュンター）。空なら歩いて入る
        public bool passive;       // 自分からは動かない・攻撃しない（反撃はする。訓練人形）
    }
}

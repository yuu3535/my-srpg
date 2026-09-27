using System;
using Srpg.Battle.Plan;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 戦闘の画面の表示と、攻撃の選択肢（tools/export_unity_battle_ui.mjs がブラウザ版から書き出す battle_*_ui.json）。
    /// 表示の正本はブラウザ版（兵種名・因果Lv・武器の値・立ち絵の切り抜き・戦技と魔法の一覧）
    /// </summary>
    [Serializable]
    public class UvRect
    {
        public float x, y, w, h;
        public Rect ToRect() => new Rect(x, y, w, h);
    }

    /// <summary>コマンドの一覧の1行（戦技・魔法）。index は options の番号（使えなければ −1）</summary>
    [Serializable]
    public class UiListEntry
    {
        public string label, sub, mpCost;
        public int index = -1;          // 攻撃（options の番号）
        public int supportIndex = -1;   // 補助（supports の番号）
        public int specialIndex = -1;   // 専用戦技（specials の番号）
        public string summonUnitId;     // 召喚の戦技: 呼ぶ召喚獣（なければ空）
        public int summonDelay;         // 召喚獣が出るまでのターン（使ったターン＋summonDelay の味方の番の始まり）
    }

    [Serializable]
    public class UiUnit
    {
        public string id, name, side, levelLabel, className, moveLabel;
        public int maxMp;
        public int move;
        public bool summon;   // 召喚獣（戦闘の始まりには出ていない）
        public string weaponName, weaponType, weaponPower, weaponRange, weaponHit, weaponCrit;
        public string portrait;
        public UvRect cardUv, bustUv, rosterUv;
        public string weaponItemId;              // 持っている武器（武器の攻撃で持ち替える先）
        public BattleOption[] options;           // 味方が選べる攻撃（距離はまだ見ていない）
        public BattleOption[] enemyOptions;      // 敵として選ぶ攻撃（ブラウザ版 trialEnemyAttackOptions）
        public UiListEntry[] artList, magicList; // コマンド「戦技」「魔法」の一覧（使えないものも出す）
        public BattleOption[] supports;          // 補助の魔法（回復・結界・加速・治癒の魔核。kind = "support"）
        public SpecialArt[] specials;            // 専用戦技（月詠・生命吸収）
    }

    /// <summary>専用戦技: radius マス以内の敵のHPを percent% 削る（drain なら削った分だけ自分のHP・MPを回復）。1戦闘に1回</summary>
    [Serializable]
    public class SpecialArt
    {
        public string name, desc;
        public int radius, percent;
        public bool drain;
    }

    [Serializable]
    public class UiDataFile
    {
        public string battleId;
        public UiUnit[] units;
    }
}

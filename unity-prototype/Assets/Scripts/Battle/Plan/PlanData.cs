using System;
using System.Collections.Generic;

namespace Srpg.Battle.Plan
{
    // ブラウザ版の交戦の計画（battlePlan.js）に渡すスナップショットと同じ形。
    // tools/export_unity_battle_plan.mjs がブラウザ版の trialPlanSnapshot() をそのまま書き出す
    // （unity-prototype/Assets/Data/Battles/battle_trial_adopted_plan.json）。正本はブラウザ版。

    [Serializable]
    public class PlanStats
    {
        public int hp, atk, def, mag, res, tec, spd, cha;
    }

    [Serializable]
    public class PlanStatus
    {
        public string type;
        public int value;
        public int duration;
        public bool holdOwnPhase;
        public string name;

        public PlanStatus Clone() => (PlanStatus)MemberwiseClone();
    }

    /// <summary>魔導書の魔法・魔法の戦技の魔法データ（spells.js の必要な所だけ）</summary>
    [Serializable]
    public class PlanSpell
    {
        public string id;
        public string name;
        public string targetType;
        public string mpCost;
        public string effectType;
        public string statusEffect;
    }

    [Serializable]
    public class PlanUnit
    {
        public string id;
        public string name;
        public string side;
        public int x, y;
        public int hp, maxHp, mp;
        public PlanStats stats;
        public int siz;
        public int courage;
        public int luck;
        public List<string> abilityNames = new List<string>();
        public List<PlanStatus> statusEffects = new List<PlanStatus>();
        public string equippedItem;
        public PlanSpell grimoireSpell;
        public int criticalBonus;
        public int criticalAvoidanceBonus;
        public bool canCounterBase;
        public bool prayerUsed;

        /// <summary>装備中の魔導書の魔法があるか（JSON では「なし」が空の魔法になるため）</summary>
        public bool HasGrimoireSpell => grimoireSpell != null && !string.IsNullOrEmpty(grimoireSpell.id);

        public bool Has(string ability) => abilityNames != null && abilityNames.Contains(ability);

        /// <summary>計画用の写し（能力の一覧と状態異常も写す）</summary>
        public PlanUnit Clone()
        {
            var copy = (PlanUnit)MemberwiseClone();
            copy.abilityNames = new List<string>(abilityNames ?? new List<string>());
            copy.statusEffects = new List<PlanStatus>();
            foreach (var effect in statusEffects ?? new List<PlanStatus>()) copy.statusEffects.Add(effect.Clone());
            return copy;
        }
    }

    [Serializable]
    public class PlanItem
    {
        public string id;
        public string name;
        public string kind;   // weapon / grimoire
        public int power;
        public int range;
    }

    [Serializable]
    public class PlanStateFile
    {
        public string battleId;
        public PlanUnit[] units;
        public PlanItem[] items;
    }

    /// <summary>攻撃の行動（battlePlan.js の action）。kind: weapon / grimoire / magicArt</summary>
    public class PlanAction
    {
        public string kind = "weapon";
        public string artName;
        public PlanSpell spell;
        public bool isCounter;
        public bool isFollowUp;
        public bool freeCast;

        public PlanAction With(bool? isCounter = null, bool? isFollowUp = null, string artName = "\0")
        {
            var copy = (PlanAction)MemberwiseClone();
            if (isCounter.HasValue) copy.isCounter = isCounter.Value;
            if (isFollowUp.HasValue) copy.isFollowUp = isFollowUp.Value;
            if (artName != "\0") copy.artName = artName;
            return copy;
        }

        public static PlanAction ForEquipped(PlanUnit unit) =>
            unit.HasGrimoireSpell ? new PlanAction { kind = "grimoire", spell = unit.grimoireSpell } : new PlanAction { kind = "weapon" };
    }

    /// <summary>計画の1段（1撃、または反撃できるかの判定）</summary>
    public class PlanStep
    {
        public string type;          // strike / counterCheck
        public string role;          // attack / counter / followUp / counterFollowUp / area
        public string actorId, targetId;
        public string kind;
        public string spellId;
        public int hitRate, damage, critRate, critDamage;
        public bool autoHit;
        public int? hitRoll, critRoll;
        public bool hit, crit;
        public int dealt;
        public int targetHpAfter;
        public int? mpCost, actorMpAfter;
        public int? quickCastRoll, quickCastChance;
        public bool quickCastActive;
        public int barrierAbsorbed;
        public bool barrierBroken;
        public string status;        // burn / accuracyDown / knockback
        public int? statusDuration;
        public int? artSealRoll, artSealChance;
        public bool artSealActive;
        public bool? prayerSaved;
        public int? reflectDamage;
        public int reflectActorHpAfter;
        public List<string> notes = new List<string>();
        // counterCheck
        public bool ok;
        public string reason = "";
        public string label = "";
        public int? sealRoll, sealChance;
        public bool sealActive;
    }

    public class PlanResult
    {
        public List<PlanStep> steps = new List<PlanStep>();
        public PlanUnit attacker;
        public PlanUnit defender;
    }
}

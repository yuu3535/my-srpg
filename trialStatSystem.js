// =====================================================================
//  trialStatSystem.js ― 採用版ステータス試験用の計算（純粋処理）
//
//  試験ブランチ trial/adopted-stats 専用。DOM・戦闘状態に触れない。
//  出典:
//    採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md v1.5（換算・成長・上限）
//    docs/90-worklogs/WORK_MEMO_2026-09-24.md §12（ダメージ式・武器威力）
//    docs/90-worklogs/WORK_MEMO_2026-09-24.md §15（必殺率・倍率の重複）
//    docs/10-design/battle/TRPG_TO_SRPG_STAT_CONVERSION.md §7.2（命中式）
//  第1段階では兵種補正・兵種スキル・Dualを含めない。
// =====================================================================

// 基本8ステータスのキー（採用版の並び）
const TRIAL_STAT_KEYS = Object.freeze(["hp", "atk", "def", "mag", "res", "tec", "spd", "cha"]);

// 仮の武器威力（WORK_MEMO §12）
const TRIAL_WEAPON_POWER = Object.freeze({ low: 3, mid: 6, high: 10 });

// 追撃に必要な速さ差（WORK_MEMO_2026-09-24 §1 の候補）
const TRIAL_FOLLOW_UP_SPEED_GAP = 5;

// TRPGレベル → 試験で使う因果Lv（原作者指定 2026-09-24）
const TRIAL_CAUSE_LEVEL_BY_TRPG_LEVEL = Object.freeze({ 1: 1, 2: 10, 3: 20, 4: 25, 5: 30 });

// 試験用の計算を適用する戦闘の目印（battleDefinitions.js の trialRules）
const TRIAL_RULES_ID = "adopted-stats-v1";

/*
 * 試験用プロフィール
 *   base   : 因果Lv1基礎値（HPは試験用の案②＝TRPG Lv1 HP x 1）
 *   growth : 個人成長率(%)。幸運・勇気補正は trialGrowthBonus で別に加える
 *   caps   : 能力上限（HP上限は採用版どおり x 2 の式）
 *   siz    : 命中式の体格補正用
 *   trpgLevel : 試験で使う因果Lvの決定元
 *   sourceCharacterId : 表示（画像）と持ち物（魔法・技能・秘伝など）を借りる
 *               characters.js の id。省略時はゲーム側のユニットのまま
 *   abilityLevel : スキル・戦技の習得だけに使う因果Lv（能力値は causeLevel / trpgLevel のまま）。
 *               身支度で入れ替えを試せるよう、味方4人は枠の数より多く習得する Lv45 相当にしている（原作者依頼 2026-09-25）
 *
 *   敵3体（森の番人・ディラン・ヘレル）の個人成長率は採用版に無いため、試験用の仮値。
 */
const TRIAL_PROFILES = Object.freeze({
    ringholm: {
        name: "リングホルム", race: "ヒト", trpgLevel: 5, abilityLevel: 45,
        base:   { hp: 12, atk: 16, def: 13, mag: 16, res: 14, tec: 7,  spd: 12, cha: 16 },
        growth: { hp: 45, atk: 75, def: 45, mag: 65, res: 65, tec: 75, spd: 70, cha: 60 },
        caps:   { hp: 104, atk: 94, def: 94, mag: 110, res: 106, tec: 96, spd: 91, cha: 112 },
        luck: 35, courage: 90, siz: 10,
    },
    arshe: {
        // ゲーム側の arshe（TRPG Lv4）を、採用版の幼アルシェの値で因果Lv25として扱う。
        // 画像・魔法・技能などの表示と持ち物も幼アルシェ（young_arshe）のものを使う
        name: "アルシェ", race: "ヒト", trpgLevel: 4, sourceCharacterId: "young_arshe", abilityLevel: 45,
        base:   { hp: 13, atk: 14, def: 13, mag: 18, res: 15, tec: 9,  spd: 10, cha: 15 },
        growth: { hp: 70, atk: 60, def: 55, mag: 55, res: 50, tec: 70, spd: 70, cha: 60 },
        caps:   { hp: 122, atk: 90, def: 108, mag: 104, res: 106, tec: 87, spd: 71, cha: 102 },
        luck: 90, courage: 90, siz: 13,
    },
    young_karima: {
        // 幼カリマ（TRPG Lv1）は因果Lv1だと検証にならないため、原作者指示
        // 「弱すぎる場合は因果Lvを上げる」に従い、アルシェと同じ因果Lv25で扱う
        name: "カリマ", race: "ヒト", trpgLevel: 1, causeLevel: 25, abilityLevel: 45,
        base:   { hp: 12, atk: 14, def: 13, mag: 18, res: 15, tec: 9,  spd: 11, cha: 15 },
        growth: { hp: 55, atk: 50, def: 45, mag: 65, res: 70, tec: 70, spd: 70, cha: 65 },
        caps:   { hp: 122, atk: 86, def: 108, mag: 106, res: 100, tec: 86, spd: 96, cha: 101 },
        luck: 90, courage: 90, siz: 13,
    },
    albas: {
        name: "アルバス", race: "魔物", trpgLevel: 5, abilityLevel: 45,
        base:   { hp: 18, atk: 12, def: 13, mag: 24, res: 22, tec: 12, spd: 9,  cha: 17 },
        growth: { hp: 65, atk: 40, def: 50, mag: 80, res: 75, tec: 80, spd: 55, cha: 70 },
        caps:   { hp: 104, atk: 80, def: 89, mag: 110, res: 108, tec: 98, spd: 108, cha: 115 },
        luck: 65, courage: 65, siz: 15,
    },
    forest_guard: {
        // TRPGシートなし。characters.js の値（TRPG Lv2相当）をLv1基礎値として換算した一般兵
        name: "森の番人", race: "ヒト", trpgLevel: 2,
        base:   { hp: 14, atk: 18, def: 16, mag: 12, res: 15, tec: 8,  spd: 9,  cha: 10 },
        growth: { hp: 60, atk: 55, def: 50, mag: 15, res: 30, tec: 45, spd: 45, cha: 25 },
        caps:   { hp: 99, atk: 99, def: 99, mag: 99, res: 99, tec: 99, spd: 99, cha: 99 },
        luck: 40, courage: 50, siz: 14,
    },
    dylan: {
        // 竜人。SIZ増加後（SIZ25、HP23）を標準戦闘状態として換算。物理最高峰
        name: "ディラン", race: "竜人", trpgLevel: 4,
        base:   { hp: 23, atk: 24, def: 24, mag: 11, res: 15, tec: 9,  spd: 11, cha: 10 },
        growth: { hp: 65, atk: 80, def: 60, mag: 20, res: 35, tec: 50, spd: 50, cha: 25 },
        caps:   { hp: 130, atk: 110, def: 105, mag: 108, res: 61, tec: 97, spd: 94, cha: 107 },
        luck: 25, courage: 60, siz: 25,
    },
    herel: {
        // 星飼い。隕石・重力を使う魔法型
        name: "ヘレル", race: "ヒト", trpgLevel: 4,
        base:   { hp: 13, atk: 12, def: 12, mag: 15, res: 14, tec: 6,  spd: 9,  cha: 13 },
        growth: { hp: 45, atk: 25, def: 35, mag: 70, res: 60, tec: 60, spd: 50, cha: 50 },
        caps:   { hp: 100, atk: 70, def: 86, mag: 82, res: 81, tec: 76, spd: 76, cha: 89 },
        luck: 90, courage: 70, siz: 13,
    },
});

/*
 * スキル・戦技・兵種のデータは abilityData.js（兵種表CSVから自動生成）を正本として使う。
 *   兵種: 各キャラ兵種適正.csv の「◎（加入時の最初の兵種）」
 *   兵種スキル: 兵種スキル.csv ／ 個人スキル・因果スキル・戦技: 因果スキル_戦技.csv
 *   兵種Lvは未実装のため、試験では TRIAL_CLASS_LEVEL とする
 */
const TRIAL_ABILITY_DATA = typeof ABILITY_DATA !== "undefined"
    ? ABILITY_DATA
    : (typeof require === "function" ? require("./abilityData.js").ABILITY_DATA : null);

const TRIAL_CLASS_LEVEL = 1;

// 試験用ユニット → 兵種表CSVのキャラクター名
const TRIAL_ABILITY_SOURCE = Object.freeze({
    ringholm: "リングホルム",
    arshe: "アルシェ",
    albas: "アルバス",
    young_karima: "カリマ",
});

// 専用兵種を持つ4人。因果Lv50スキルは因果スキル枠ではなく、専用兵種の兵種固有枠へ入る（SKILL_LOADOUT_RULES §5）
const TRIAL_EXCLUSIVE_CLASS_OWNERS = new Set(["アルシェ", "リングホルム", "アルバス", "カリマ"]);

/** 兵種スキル表を [習得条件, 名前, 説明, 種類, 能力値上昇] の並びにする（空欄の習得枠は除く） */
const TRIAL_CLASS_SKILLS = Object.freeze(Object.fromEntries(
    Object.entries(TRIAL_ABILITY_DATA?.classLines || {}).map(([slot, line]) => [
        slot,
        line.skills
            .filter(Boolean)
            .map(skill => [
                skill.need === "master" ? "マスター" : `兵種Lv${skill.need}`,
                skill.name,
                skill.desc,
                skill.kind,
                skill.statBonus,
            ]),
    ])
));

function trialInitialClassFor(characterName) {
    const classes = TRIAL_ABILITY_DATA?.characterClasses?.[characterName] || [];
    const initial = classes.find(cls => cls.initial);
    return initial ? { name: initial.name, line: initial.slot } : null;
}

// 敵3体は兵種表に載っていないため仮の兵種
const TRIAL_UNIT_CLASS = Object.freeze({
    ...Object.fromEntries(Object.entries(TRIAL_ABILITY_SOURCE)
        .map(([unitId, name]) => [unitId, trialInitialClassFor(name) || { name: "未設定", line: null }])),
    forest_guard: { name: "戦士（仮）", line: "戦列下級" },
    dylan:        { name: "未設定",     line: null },
    herel:        { name: "未設定",     line: null },
});

// 採用済みのセット枠。試験画面では「装備中の枠」を見るだけとし、
// 習得一覧や付け替え操作は拠点の育成画面へ分離する。
const TRIAL_LOADOUT_SLOT_COUNTS = Object.freeze({
    classSkills: 4,
    classUnique: 1,
    causeSkills: 3,
    combatArts: 4,
});

const TRIAL_PERSONAL_SKILLS = Object.freeze(Object.fromEntries(
    Object.entries(TRIAL_ABILITY_SOURCE).map(([unitId, name]) => {
        const personal = TRIAL_ABILITY_DATA?.causeTable?.[name]?.personal;
        if (!personal) return [unitId, null];
        return [unitId, {
            name: personal.name,
            desc: personal.desc,
        }];
    })
));

/**
 * 因果Lvで習得する能力。type は表示と枠分けに使う。
 *   skill: 因果スキル枠 / art: 戦技枠（artKind に physicalArt・magicArt など）/ exclusive: 兵種固有枠へ入るLv50スキル
 */
const TRIAL_CAUSE_ABILITIES = Object.freeze(Object.fromEntries(
    Object.entries(TRIAL_ABILITY_SOURCE).map(([unitId, name]) => {
        const abilities = TRIAL_ABILITY_DATA?.causeTable?.[name]?.abilities || [];
        return [unitId, Object.freeze(abilities.map(ability => ({
            level: ability.level,
            type: ability.kind !== "skill" ? "art"
                : (ability.level === 50 && TRIAL_EXCLUSIVE_CLASS_OWNERS.has(name)) ? "exclusive"
                : "skill",
            artKind: ability.kind !== "skill" ? ability.kind : null,
            name: ability.name,
            desc: ability.desc,
            statBonus: ability.statBonus || null,
        })))];
    })
));

// 魔法戦技 → 既存の魔法データ（spells.js）の対応（たたき台・未採用）。
// 魔法コマンドは「セットした魔法戦技」と「装備した魔導書」の魔法を選ぶ入口（原作者方針 2026-09-25）。
// 万雷は対応する魔法がないため、まだ魔法コマンドに出さない。
const TRIAL_MAGIC_ART_SPELLS = Object.freeze({
    "破壊": "破壊",
    "落雷": "落雷",
    "封印": "封印",
    "結界": "結界",
    "虚像": "虚像",
    "加速": "加速",
    "転移": "転移",
    "回復": "治癒",
    "悪夢": "悪夢",
    "召喚「ヒトダマ」": "ヒトダマ",
    "万雷": "落雷",   // 落雷の魔法データを使い、直線3マスの敵を巻き込む（game.js の万雷の処理）
});

// 物理の戦技のうち、試験の戦闘で効果を実装済みのもの（game.js の [trial] 戦技フック）
const TRIAL_IMPLEMENTED_PHYSICAL_ARTS = new Set(["両断", "復讐", "大振り", "破天", "奇襲", "円舞"]);

// 専用戦技（月詠・生命吸収）: 周囲の敵のHPを割合で削る。戦技コマンドから使う（1戦闘に1回。仮の制限）
const TRIAL_SPECIAL_ARTS = Object.freeze({
    "月詠":     { radius: 5, percent: 20, drain: false },
    "生命吸収": { radius: 6, percent: 10, drain: true },
});

/** セット中の専用戦技 */
function trialSpecialArtsFor(unitId, causeLevel, selection = null) {
    return trialSkillLoadoutFor(unitId, causeLevel, TRIAL_CLASS_LEVEL, selection).combatArts
        .filter(art => art && TRIAL_SPECIAL_ARTS[art.name])
        .map(art => ({ name: art.name, desc: art.desc, ...TRIAL_SPECIAL_ARTS[art.name] }));
}

// ── 試験用の武器・魔導書（持ち物） ──
// 1人が持てる数は TRIAL_ITEM_CAPACITY まで。装備できるのは1つ（武器か魔導書）。
// 魔導書は魔法の扱いで、射程は TRIAL_GRIMOIRE_RANGE（1〜2マス。原作者指定 2026-09-25）。
// どのキャラに何を持たせるかは原作者の仮置きの許可による（Claude Code が配置）。
const TRIAL_ITEMS = Object.freeze({
    trial_sword: { name: "仮の剣", kind: "weapon", power: TRIAL_WEAPON_POWER.mid, range: 1 },
    // アルバスが見た目で持つ剣。アルバス専用の武器ではなく、持ち物にしまったり、ほかの味方に装備させたりできる
    albas_sword: { name: "アルバスの剣", kind: "weapon", power: TRIAL_WEAPON_POWER.mid, range: 1 },
    fire_book:   { name: "火の魔導書",   kind: "grimoire", spell: "火" },   // 黒の一族（火魔法強化）に合わせた
    heal_book:   { name: "治癒の魔導書", kind: "grimoire", spell: "治癒" },
    // ヘレル（魔法型の敵）の仮の魔導書。隕石を単体の攻撃魔法として使う
    star_book:   { name: "星の魔導書",   kind: "grimoire", spell: "隕石", effectType: "magicDamage" },
});

const TRIAL_ITEM_CAPACITY = 5;

// 戦闘開始時の持ち物と装備（身支度で変えられる。変えた内容はパーティ状態に残る）
const TRIAL_STARTING_GEAR = Object.freeze({
    ringholm:     { items: ["trial_sword", "fire_book"], equipped: "trial_sword" },
    arshe:        { items: ["trial_sword", "fire_book"], equipped: "trial_sword" },
    young_karima: { items: ["trial_sword", "heal_book"], equipped: "trial_sword" },
    albas:        { items: [], equipped: null },   // 剣はフレーバー。共有の持ち物に入っている
    forest_guard: { items: ["trial_sword"], equipped: "trial_sword" },
    dylan:        { items: ["trial_sword"], equipped: "trial_sword" },
    herel:        { items: ["star_book"], equipped: "star_book" },
});

// パーティ共有の持ち物（誰も持っていない武器・魔導書）
const TRIAL_STARTING_STOCK = Object.freeze(["albas_sword"]);

function trialStartingGear(unitId) {
    const gear = TRIAL_STARTING_GEAR[unitId];
    return gear ? { items: [...gear.items], equipped: gear.equipped } : { items: [], equipped: null };
}

function trialItemKind(itemId) {
    return TRIAL_ITEMS[itemId]?.kind || null;
}

/** 持ち物の中の魔導書（魔法コマンドに出す） */
function trialCarriedGrimoires(gear) {
    return (gear?.items || []).filter(id => trialItemKind(id) === "grimoire");
}

/** 持ち物の中の最初の武器（通常攻撃で持ち替える先）。なければ null */
function trialCarriedWeapon(gear) {
    return (gear?.items || []).find(id => trialItemKind(id) === "weapon") || null;
}

/** 装備する（持っているものだけ） */
function trialGearEquip(gear, itemId) {
    if (itemId !== null && !(gear?.items || []).includes(itemId)) return { gear, changed: false };
    return { gear: { items: [...gear.items], equipped: itemId }, changed: gear.equipped !== itemId };
}

/**
 * 持ち物の受け渡し。from・to はユニットのid か "stock"（共有の持ち物）。
 * 装備中のものを渡すと、残りの最初の持ち物を装備する（なければ装備なし）。
 * 返り値: { gears, stock, ok, reason }
 */
function trialGearTransfer(gears, stock, from, to, itemId) {
    const nextGears = Object.fromEntries(Object.entries(gears || {}).map(([id, g]) => [id, { items: [...g.items], equipped: g.equipped }]));
    const nextStock = [...(stock || [])];
    const take = owner => {
        const list = owner === "stock" ? nextStock : nextGears[owner]?.items;
        const index = list ? list.indexOf(itemId) : -1;
        if (index < 0) return false;
        list.splice(index, 1);
        return true;
    };
    if (from === to) return { gears, stock, ok: false, reason: "same" };
    if (to !== "stock" && !nextGears[to]) return { gears, stock, ok: false, reason: "unknown" };
    if (to !== "stock" && nextGears[to].items.length >= TRIAL_ITEM_CAPACITY) return { gears, stock, ok: false, reason: "full" };
    if (!take(from)) return { gears, stock, ok: false, reason: "missing" };
    if (to === "stock") nextStock.push(itemId);
    else nextGears[to].items.push(itemId);
    if (from !== "stock" && nextGears[from].equipped === itemId) {
        nextGears[from].equipped = nextGears[from].items[0] || null;
    }
    return { gears: nextGears, stock: nextStock, ok: true, reason: "" };
}

// 魔導書は魔法の扱い。射程は1〜2マス（原作者指定 2026-09-25）
const TRIAL_GRIMOIRE_RANGE = Object.freeze({ min: 1, max: 2 });

/**
 * 反撃できるか（総合相談での整理・原作者回答 2026-09-25）。
 *   攻撃の種類（物理・魔法）ではなく、防御側が「今装備している」武器・魔導書の射程で決める。
 *   反撃のために装備を自動で持ち替えない。
 *   input: { equipped: "weapon" | "grimoire", weaponRange, grimoire: { spell, damaging } | null, mp, distance }
 *   返り値: { canCounter, kind, reason }
 */
function trialCounterPlan(input) {
    const distance = Number(input.distance);
    if (!input.equipped) return { canCounter: false, kind: null, reason: "装備なし" };
    if (input.equipped === "grimoire" && input.grimoire) {
        if (!input.grimoire.damaging) return { canCounter: false, kind: "grimoire", reason: "攻撃できない魔導書" };
        if (distance < TRIAL_GRIMOIRE_RANGE.min || distance > TRIAL_GRIMOIRE_RANGE.max) {
            return { canCounter: false, kind: "grimoire", reason: "射程外" };
        }
        if (Number(input.mp || 0) <= 0) return { canCounter: false, kind: "grimoire", reason: "MP不足" };
        return { canCounter: true, kind: "grimoire", reason: "" };
    }
    const weaponRange = Math.max(1, Number(input.weaponRange || 1));
    if (distance < 1 || distance > weaponRange) return { canCounter: false, kind: "weapon", reason: "射程外" };
    return { canCounter: true, kind: "weapon", reason: "" };
}

/** 戦技を魔法コマンド側・攻撃コマンド側のどちらに出すか */
function trialArtCommand(art) {
    if (!art) return null;
    if (art.artKind === "magicArt" || art.name === "鎌風") return "magic";
    if (art.artKind === "exclusiveArt") return "special";   // 月詠・生命吸収（範囲の割合ダメージ。未実装）
    return "attack";
}

/**
 * 試験用ユニットの魔法コマンドの中身（セット中の魔法戦技 → 持っている魔導書の順）
 *   grimoireIds: 持ち物の中の魔導書の id（trialCarriedGrimoires）
 */
function trialMagicMenuFor(unitId, causeLevel, selection = null, grimoireIds = []) {
    const loadout = trialSkillLoadoutFor(unitId, causeLevel, TRIAL_CLASS_LEVEL, selection);
    const menu = loadout.combatArts
        .filter(art => art && trialArtCommand(art) === "magic" && TRIAL_MAGIC_ART_SPELLS[art.name])
        .map(art => ({ name: art.name, spell: TRIAL_MAGIC_ART_SPELLS[art.name], source: "戦技" }));
    for (const itemId of grimoireIds) {
        const item = TRIAL_ITEMS[itemId];
        if (item?.kind === "grimoire") menu.push({ name: item.name, spell: item.spell, source: "魔導書", itemId });
    }
    return menu;
}

/** 攻撃コマンドに出す物理の戦技（implemented=false は効果未実装で選べない） */
function trialPhysicalArtsFor(unitId, causeLevel, selection = null) {
    return trialSkillLoadoutFor(unitId, causeLevel, TRIAL_CLASS_LEVEL, selection).combatArts
        .filter(art => art && trialArtCommand(art) === "attack")
        .map(art => ({ name: art.name, desc: art.desc, implemented: TRIAL_IMPLEMENTED_PHYSICAL_ARTS.has(art.name) }));
}

function trialFillLoadoutSlots(items, count) {
    return Array.from({ length: count }, (_, index) => items[index] || null);
}

// セットを入れ替えられる区分（兵種固有枠は現在兵種で決まるため入れ替え対象外）
const TRIAL_SELECTABLE_CATEGORIES = Object.freeze(["classSkills", "causeSkills", "combatArts"]);

/** 習得済みの能力（セット前の一覧）。区分ごとに習得順 */
function trialLearnedAbilitiesFor(unitId, causeLevel, classLevel = TRIAL_CLASS_LEVEL) {
    const cls = TRIAL_UNIT_CLASS[unitId] || { line: null };
    const classLearned = (cls.line ? TRIAL_CLASS_SKILLS[cls.line] || [] : [])
        .filter(([need]) => need !== "マスター" && classLevel >= Number(need.replace("兵種Lv", "")))
        .map(([need, name, desc, kind, statBonus]) => ({ name, desc, source: need, kind, statBonus }));
    const causeLearned = (TRIAL_CAUSE_ABILITIES[unitId] || [])
        .filter(ability => ability.level <= Number(causeLevel || 1));
    return {
        classSkills: classLearned.filter(skill => skill.kind !== "art"),
        causeSkills: causeLearned.filter(ability => ability.type === "skill"),
        combatArts: causeLearned.filter(ability => ability.type === "art"),
        exclusive: causeLearned.find(ability => ability.type === "exclusive") || null,
    };
}

/**
 * 試験画面・試験戦闘のセット内容。
 *   selection: { classSkills: [名前], causeSkills: [名前], combatArts: [名前] }（身支度で選んだもの）。
 *   区分の指定がなければ、習得順に空き枠へ入れる。習得していない名前は無視する。
 */
function trialSkillLoadoutFor(unitId, causeLevel, classLevel = TRIAL_CLASS_LEVEL, selection = null) {
    const cls = TRIAL_UNIT_CLASS[unitId] || { line: null };
    const learned = trialLearnedAbilitiesFor(unitId, causeLevel, classLevel);
    const pick = category => {
        const names = selection?.[category];
        if (!Array.isArray(names)) return learned[category];
        return names
            .map(name => learned[category].find(item => item.name === name))
            .filter(Boolean);
    };
    // 専用兵種のLv50スキルは、専用兵種が現在兵種のときだけ兵種固有枠に置ける（試験では最初の兵種のため置かない）
    const inExclusiveClass = cls.line === "専用兵種";
    return {
        personal: TRIAL_PERSONAL_SKILLS[unitId] || null,
        classSkills: trialFillLoadoutSlots(pick("classSkills"), TRIAL_LOADOUT_SLOT_COUNTS.classSkills),
        classUnique: trialFillLoadoutSlots(
            learned.exclusive && inExclusiveClass ? [learned.exclusive] : [],
            TRIAL_LOADOUT_SLOT_COUNTS.classUnique
        ),
        causeSkills: trialFillLoadoutSlots(pick("causeSkills"), TRIAL_LOADOUT_SLOT_COUNTS.causeSkills),
        combatArts: trialFillLoadoutSlots(pick("combatArts"), TRIAL_LOADOUT_SLOT_COUNTS.combatArts),
    };
}

/** 今のセット内容を selection の形（名前の配列）にする */
function trialSelectionFromLoadout(loadout) {
    return Object.fromEntries(TRIAL_SELECTABLE_CATEGORIES.map(category => [
        category,
        (loadout[category] || []).filter(Boolean).map(item => item.name),
    ]));
}

/**
 * 身支度でのセットの付け外し。付けている能力なら外し、外れている能力なら空き枠に付ける。
 * 返り値: { selection, changed, reason }。枠がいっぱいのときは changed=false, reason="full"
 */
function trialToggleLoadoutSelection(unitId, causeLevel, selection, category, name, classLevel = TRIAL_CLASS_LEVEL) {
    if (!TRIAL_SELECTABLE_CATEGORIES.includes(category)) return { selection, changed: false, reason: "locked" };
    const learned = trialLearnedAbilitiesFor(unitId, causeLevel, classLevel);
    if (!learned[category].some(item => item.name === name)) return { selection, changed: false, reason: "unknown" };
    const current = trialSelectionFromLoadout(trialSkillLoadoutFor(unitId, causeLevel, classLevel, selection));
    const names = current[category];
    if (names.includes(name)) {
        return { selection: { ...current, [category]: names.filter(n => n !== name) }, changed: true, reason: "removed" };
    }
    if (names.length >= TRIAL_LOADOUT_SLOT_COUNTS[category]) {
        return { selection: current, changed: false, reason: "full" };
    }
    return { selection: { ...current, [category]: [...names, name] }, changed: true, reason: "added" };
}

/** セット中の能力の名前（個人スキルを含む）。戦闘効果の判定に使う */
function trialAbilityNamesFor(unitId, causeLevel, selection = null) {
    const loadout = trialSkillLoadoutFor(unitId, causeLevel, TRIAL_CLASS_LEVEL, selection);
    return [
        loadout.personal,
        ...loadout.classSkills,
        ...loadout.classUnique,
        ...loadout.causeSkills,
        ...loadout.combatArts,
    ].filter(Boolean).map(item => item.name);
}

/** セット中のスキルの無条件の能力値上昇（「技・魅力+10」など）を合計する */
function trialLoadoutStatBonus(unitId, causeLevel, selection = null) {
    const loadout = trialSkillLoadoutFor(unitId, causeLevel, TRIAL_CLASS_LEVEL, selection);
    const total = Object.fromEntries(TRIAL_STAT_KEYS.map(key => [key, 0]));
    for (const item of [...loadout.classSkills, ...loadout.classUnique, ...loadout.causeSkills]) {
        for (const [key, value] of Object.entries(item?.statBonus || {})) total[key] += value;
    }
    return total;
}

// ── 試験戦闘のスキル効果（純粋な判定。game.js の [trial] から呼ぶ） ──

const TRIAL_CLAN_ELEMENTS = Object.freeze({
    "黒の一族": "火", "白の一族": "氷", "黄の一族": "土", "翠の一族": "風",
});

function trialDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * 周囲に効く能力（死神・王威）による補正。
 *   units: { id, side, x, y, hp, abilityNames: string[] } の配列
 *   返り値 accuracy: 攻撃側の命中率に足す値 / critGuard: 防御側の必殺耐性に足す値
 *   死神の「速さ−5」は未実装
 */
function trialAuraModifiers(attacker, defender, units) {
    const result = { accuracy: 0, critGuard: 0, notes: [] };
    const living = (units || []).filter(u => u && u.hp > 0);
    const owners = name => living.filter(u => (u.abilityNames || []).includes(name));
    const who = owner => owner.name || owner.id;
    for (const owner of owners("死神")) {
        if (owner.side !== attacker.side && trialDistance(owner, attacker) <= 4) {
            result.accuracy -= 10; result.notes.push(`${who(owner)}の死神:命中-10`);
        }
        if (owner.side !== defender.side && trialDistance(owner, defender) <= 4) {
            result.accuracy += 10; result.notes.push(`${who(owner)}の死神:相手の回避-10`);
        }
    }
    for (const owner of owners("王威")) {
        if (owner.side === attacker.side && owner.id !== attacker.id && trialDistance(owner, attacker) <= 4) {
            result.accuracy += 10; result.notes.push(`${who(owner)}の王威:命中+10`);
        }
        if (owner.side === defender.side && owner.id !== defender.id && trialDistance(owner, defender) <= 4) {
            result.accuracy -= 10; result.critGuard += 10; result.notes.push(`${who(owner)}の王威:相手の回避・必殺耐性+10`);
        }
    }
    return result;
}

/**
 * 攻撃ごとの能力補正（野望・一族スキル）。殺気は既存の passiveSkills.js で処理する。
 *   options: { isCounter, isMagic, spellId }
 */
function trialAttackModifiers(attackerNames, defenderNames, options = {}) {
    const result = { accuracy: 0, critical: 0, damageMultiplier: 1, notes: [] };
    const has = (names, name) => (names || []).includes(name);
    if (has(attackerNames, "野望") && !options.isCounter) {
        result.accuracy += 10; result.critical += 10; result.notes.push("野望:命中+10・必殺+10");
    }
    // 野望の「相手の命中−10」: アルバスから仕掛けた戦闘で、相手の反撃の命中を下げる
    if (has(defenderNames, "野望") && options.isCounter) {
        result.accuracy -= 10; result.notes.push("野望:相手の命中-10");
    }
    if (options.isMagic) {
        for (const [clan, element] of Object.entries(TRIAL_CLAN_ELEMENTS)) {
            if (has(attackerNames, clan) && options.spellId === element) {
                result.accuracy += 20; result.damageMultiplier *= 1.5; result.notes.push(`${clan}:命中+20・1.5倍`);
            }
        }
    }
    return result;
}

/** 確率で発動するスキルの発動率（%） */
function trialAbilityChance(name, stats, extra = {}) {
    if (name === "野望") return Math.min(100, stats.cha * 2);                       // 反撃封じ
    if (name === "カウンター") return Math.floor((Number(extra.maxHp || stats.hp) + stats.def) / 4);
    if (name === "祈り") return Math.min(100, Number(extra.luck || 0));
    if (name === "詠唱破棄") return Math.floor((stats.mag + stats.res) / 4);         // 因果スキル版
    return 0;
}

/**
 * ステータス画面に出す戦闘値。
 *   命中率 = 命中値 - 相手の回避値（5〜100%）
 *   必殺率 = 必殺値 - 相手の必殺耐性
 *   追撃   = 速さの差が TRIAL_FOLLOW_UP_SPEED_GAP 以上
 */
function trialDerivedValues(stats, siz, currentCourage) {
    const courage = Math.max(0, Math.min(100, Number(currentCourage || 0)));
    const sizeMod = trialSizeEvasionModifier(siz);
    return {
        hit: Math.round(60 + stats.tec * 2.5),
        evade: Math.round(stats.spd * 2.5 + sizeMod),
        crit: stats.tec + Math.floor(courage / 5),
        critGuard: stats.cha,
        followUp: stats.spd - TRIAL_FOLLOW_UP_SPEED_GAP,
        followedBy: stats.spd + TRIAL_FOLLOW_UP_SPEED_GAP,
        counter: courage,
        sizeMod,
    };
}

/** 幸運・勇気の成長率補正（採用版§6.1）。最大勇気を使う */
function trialGrowthBonus(profile) {
    return Math.floor((Number(profile.luck || 0) + Number(profile.courage || 0)) / 40);
}

/** スキル・戦技の習得に使う因果Lv。abilityLevel の指定がなければ能力値と同じ因果Lv */
function trialAbilityLevelFor(profile) {
    if (Number.isInteger(profile.abilityLevel)) return profile.abilityLevel;
    return trialCauseLevelFor(profile);
}

/** 試験用の因果Lv。causeLevel の指定があれば優先し、なければTRPGレベルの対応表で求める */
function trialCauseLevelFor(profile) {
    if (Number.isInteger(profile.causeLevel)) return profile.causeLevel;
    return TRIAL_CAUSE_LEVEL_BY_TRPG_LEVEL[profile.trpgLevel] ?? 1;
}

/**
 * 因果Lv時点の本人ステータス（期待値を四捨五入、上限適用）。
 * 確率成長か固定成長かは未決のため、試験では成長率どおりの期待値を使う。
 */
function trialStatsAt(profile, level) {
    const bonus = trialGrowthBonus(profile);
    const gained = Math.max(0, Number(level || 1) - 1);
    const stats = {};
    for (const key of TRIAL_STAT_KEYS) {
        const rate = (Number(profile.growth[key] || 0) + bonus) / 100;
        const value = profile.base[key] + rate * gained;
        stats[key] = Math.round(Math.min(profile.caps[key], value));
    }
    return stats;
}

/** 体格回避補正（検討資料§7.2）: 正なら避けやすく、負なら狙われやすい */
function trialSizeEvasionModifier(siz) {
    return Math.max(-10, Math.min(5, 11 - Number(siz || 11)));
}

/** 命中率（検討資料§7.2）: 60 + (技 - 速さ) x 2.5 - 体格回避補正、5〜100% */
function trialHitRate(attackerStats, defenderStats, defenderSiz, modifier = 0) {
    const rate = 60
        + (attackerStats.tec - defenderStats.spd) * 2.5
        - trialSizeEvasionModifier(defenderSiz)
        + Number(modifier || 0);
    return Math.max(5, Math.min(100, Math.round(rate)));
}

/** ダメージ（WORK_MEMO §12）: max(1, round(武器威力 + (攻撃値 - 守備値) / 2)) */
function trialDamage(attackValue, defenseValue, weaponPower = TRIAL_WEAPON_POWER.mid) {
    return Math.max(1, Math.round(Number(weaponPower) + (Number(attackValue) - Number(defenseValue)) / 2));
}

/**
 * 物理ダメージ: max(1, round(武器威力 + 威力補正 + (力 - 防御) / 2))
 * 戦技などの威力補正は能力差の括弧の外に足す（括弧の中だと半分しか効かない）
 */
function trialPhysicalDamage(attack, defense, weaponPower = TRIAL_WEAPON_POWER.mid, powerBonus = 0) {
    return trialDamage(attack, defense, Number(weaponPower) + Number(powerBonus || 0));
}

/** 必殺率（WORK_MEMO §15）: 技 + floor(現在の勇気 / 5) - 相手の魅力 + 補正、0〜100% */
function trialCriticalRate(attackerStats, currentCourage, defenderStats, modifier = 0) {
    const rate = attackerStats.tec
        + Math.floor(Math.max(0, Number(currentCourage || 0)) / 5)
        - defenderStats.cha
        + Number(modifier || 0);
    return Math.max(0, Math.min(100, Math.floor(rate)));
}

/** 追撃の判定: 速さの差が TRIAL_FOLLOW_UP_SPEED_GAP 以上 */
function trialCanFollowUp(attackerStats, defenderStats) {
    return attackerStats.spd - defenderStats.spd >= TRIAL_FOLLOW_UP_SPEED_GAP;
}

if (typeof module !== "undefined") {
    module.exports = {
        TRIAL_STAT_KEYS,
        TRIAL_WEAPON_POWER,
        TRIAL_FOLLOW_UP_SPEED_GAP,
        TRIAL_CAUSE_LEVEL_BY_TRPG_LEVEL,
        TRIAL_RULES_ID,
        TRIAL_PROFILES,
        TRIAL_CLASS_LEVEL,
        TRIAL_CLASS_SKILLS,
        TRIAL_UNIT_CLASS,
        TRIAL_LOADOUT_SLOT_COUNTS,
        TRIAL_PERSONAL_SKILLS,
        TRIAL_CAUSE_ABILITIES,
        trialSkillLoadoutFor,
        TRIAL_MAGIC_ART_SPELLS,
        TRIAL_ITEMS,
        TRIAL_ITEM_CAPACITY,
        TRIAL_STARTING_GEAR,
        TRIAL_STARTING_STOCK,
        trialStartingGear,
        trialItemKind,
        trialCarriedGrimoires,
        trialCarriedWeapon,
        trialGearEquip,
        trialGearTransfer,
        trialMagicMenuFor,
        TRIAL_ABILITY_SOURCE,
        TRIAL_GRIMOIRE_RANGE,
        trialCounterPlan,
        TRIAL_SELECTABLE_CATEGORIES,
        trialLearnedAbilitiesFor,
        trialSelectionFromLoadout,
        trialToggleLoadoutSelection,
        TRIAL_IMPLEMENTED_PHYSICAL_ARTS,
        trialArtCommand,
        trialPhysicalArtsFor,
        TRIAL_SPECIAL_ARTS,
        trialSpecialArtsFor,
        trialAbilityNamesFor,
        trialLoadoutStatBonus,
        trialAuraModifiers,
        trialAttackModifiers,
        trialAbilityChance,
        trialDerivedValues,
        trialGrowthBonus,
        trialCauseLevelFor,
        trialAbilityLevelFor,
        trialStatsAt,
        trialSizeEvasionModifier,
        trialHitRate,
        trialDamage,
        trialPhysicalDamage,
        trialCriticalRate,
        trialCanFollowUp,
    };
}

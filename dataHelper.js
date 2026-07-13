// ============================================================
//  dataHelper.js  ―  キャラクターとデータの紐づけユーティリティ
//
//  使い方例：
//    getMagicData("ringholm", "火")
//    → { name:"火", successValue:9, damage:"1d6+MB", ... }
//
//    getSkillData("ringholm", "武道")
//    → { name:"武道", successValue:9, effect:"..." }
//
//    getCharacterSheet("ringholm")
//    → キャラの全魔法・特技をデータ込みで返す
// ============================================================

/**
 * キャラクターの魔法データを取得
 * @param {object} char - characters オブジェクト内の1キャラ
 * @param {string} magicName - 魔法名
 * @returns {object|null}
 */
function getMagicData(char, magicName) {
  if (!char.magics || !(magicName in char.magics)) return null;
  const base = MAGICS[magicName];
  if (!base) {
    console.warn(`magics.js に "${magicName}" が未定義です`);
    return null;
  }
  return {
    ...base,
    successValue: char.magics[magicName],
  };
}

/**
 * キャラクターの特技データを取得
 * @param {object} char - characters オブジェクト内の1キャラ
 * @param {string} skillName - 特技名
 * @returns {object|null}
 */
function getSkillData(char, skillName) {
  if (!char.skills || !(skillName in char.skills)) return null;
  const base = SKILLS[skillName];
  if (!base) {
    console.warn(`skills.js に "${skillName}" が未定義です`);
    return null;
  }
  return {
    ...base,
    successValue: char.skills[skillName],
  };
}

/**
 * キャラクターの全魔法・全特技をデータ込みで返す
 * @param {object} char - characters オブジェクト内の1キャラ
 * @returns {{ magics: object[], skills: object[] }}
 */
function getCharacterSheet(char) {
  const magics = Object.keys(char.magics || {}).map((name) =>
    getMagicData(char, name)
  ).filter(Boolean);

  const skills = Object.keys(char.skills || {}).map((name) =>
    getSkillData(char, name)
  ).filter(Boolean);

  return { magics, skills };
}

// ============================================================
//  characters.js 側のデータ形式（参考）
//
//  magics: { 火: 9, カウンター: 9, 虚像: 9 }
//  skills: { 武道: 9, 剣: 9, 戦闘指揮: 8 }
//
//  ※ 従来の magicCommands / specialCommands 配列は
//    こちらの形式に移行するか、変換関数で対応してください。
// ============================================================

/**
 * 旧形式（"1d10<=9 【火】"）から新形式に変換するヘルパー
 * characters.js の移行用
 * @param {string[]} commandArray - 旧形式の配列
 * @returns {object} { 魔法名: 成功値 }
 */
function parseCommandArray(commandArray) {
  const result = {};
  commandArray.forEach((str) => {
    // "1d10<=9 【火】" → name="火", value=9
    const match = str.match(/<=(\d+)\s*【(.+?)】/);
    if (match) {
      result[match[2]] = parseInt(match[1], 10);
    }
  });
  return result;
}

// ============================================================
//  戦闘ルールv2: TRPG正典ステータス → SRPG戦闘ステータス
// ============================================================

/**
 * Lv1初期値 + レベルアップ上昇値の形式を現在値に解決する。
 * 旧形式の数値ステータスもそのまま返す。
 * @param {number|{base:number,gains:number[]}} stat
 * @param {number} level
 * @returns {number}
 */
function statAt(stat, level = 1) {
  if (typeof stat === "number") return stat;
  if (!stat || typeof stat.base !== "number") return 0;
  const gains = Array.isArray(stat.gains) ? stat.gains : [];
  const capped = Math.max(0, level - 1);
  return stat.base + gains.slice(0, capped).reduce((sum, value) => sum + Number(value || 0), 0);
}

function fixedDiceValue(formula) {
  if (!formula || formula === "0" || formula === 0) return 0;
  let expr = String(formula).replace(/(\d+)d(\d+)/g, (_, n, m) =>
    String(Math.floor(parseInt(n, 10) * (parseInt(m, 10) + 1) / 2))
  );
  try {
    const safe = expr.replace(/[^0-9+\-*/().]/g, "");
    return safe ? Math.max(0, Math.floor(new Function("return " + safe)())) : 0;
  } catch (e) {
    return 0;
  }
}

function stripBonusToken(formula, token) {
  return String(formula || "")
    .replace(new RegExp(`\\+?\\s*${token}`, "g"), "")
    .replace(new RegExp(`${token}\\s*\\+?`, "g"), "")
    .trim();
}

/**
 * v2戦闘計算用の派生ステータスを返す。
 * equipmentArmor/equipmentWard は今後の装備実装用の任意補正。
 * @param {object} unit
 */
function calcBattleStats(unit) {
  const level = unit?.level || 1;
  const str = statAt(unit?.str, level);
  const con = statAt(unit?.con, level);
  const dex = statAt(unit?.dex, level);
  const pow = statAt(unit?.pow, level);
  const edu = statAt(unit?.edu, level);
  const int = statAt(unit?.int, level);
  const siz = statAt(unit?.siz, level);
  const hp = statAt(unit?.maxHp ?? unit?.hp, level) || unit?.maxHp || unit?.hp || 1;
  const courage = statAt(unit?.courage, level);
  const luck = statAt(unit?.luck, level);

  return {
    raw: { str, con, dex, pow, edu, int, siz, courage, luck },
    hp,
    mp: pow,
    power: Math.floor(str / 3),
    magic: Math.floor(pow / 3),
    technique: Math.floor(dex / 3),
    armor: Math.floor(con / 8) + (unit?.equipmentArmor || 0),
    ward: Math.floor((pow + int) / 16) + (unit?.equipmentWard || 0),
    valor: Math.floor(courage / 10),
    luckTokens: Math.floor(luck / 10),
  };
}

function getWeaponPower(unit) {
  if (typeof unit?.weaponPower === "number") return unit.weaponPower;
  if (unit?.weaponFormula) return fixedDiceValue(unit.weaponFormula);
  return 3;
}

function getSpellPower(spell) {
  const basePart = stripBonusToken(spell?.powerFormula || "1d6+MB", "MB") || "1d6";
  return fixedDiceValue(basePart);
}

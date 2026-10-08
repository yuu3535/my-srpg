// =====================================================================
//  成長の元データ（因果Lv1基礎値・個人成長率・能力上限・幸運・勇気・因果Lv）を、Unity版に書き出す（2026-10-09）。
//
//  使い方: node tools/export_unity_growth.mjs
//  正本はブラウザ版の trialStatSystem.js（TRIAL_PROFILES・TRIAL_BATTLE_SETUPS）。採用版
//  `採用版md/SRPG_CHARACTER_STAT_GROWTH_STANDARD.md` の値を写したもの。
//
//  出力: unity-prototype/Assets/Resources/Growth/growth_profiles.json
//    profiles: キャラごとの base / growth / caps / luck / courage / causeLevel（ふだんの因果Lv）
//    battleLevels: 戦闘ごとの因果Lvの上書き（例: プロローグの訓練ではカリマも因果Lv1）
// =====================================================================
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const trial = require(join(ROOT, "trialStatSystem.js"));

const KEYS = ["hp", "atk", "def", "mag", "res", "tec", "spd", "cha"];
const stats = (o = {}) => Object.fromEntries(KEYS.map(k => [k, Number(o[k] ?? 0)]));

const profiles = Object.entries(trial.TRIAL_PROFILES).map(([id, p]) => ({
    id,
    name: p.name,
    base: stats(p.base),
    growth: stats(p.growth),
    caps: stats(p.caps),
    luck: Number(p.luck ?? 0),
    courage: Number(p.courage ?? 0),
    causeLevel: trial.trialCauseLevelFor(p),
}));

const battleLevels = [];
for (const [battleId, setup] of Object.entries(trial.TRIAL_BATTLE_SETUPS)) {
    for (const id of Object.keys(setup.profiles ?? {})) {
        const p = trial.trialProfileFor(id, battleId);
        if (p) battleLevels.push({ battleId, id, causeLevel: trial.trialCauseLevelFor(p) });
    }
}

const out = join(ROOT, "unity-prototype/Assets/Resources/Growth/growth_profiles.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ source: "trialStatSystem.js", profiles, battleLevels }, null, 2) + "\n", "utf8");
console.log(`書き出した: ${out}（${profiles.length}人・戦闘ごとの上書き ${battleLevels.length}）`);

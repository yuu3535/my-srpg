// =====================================================================
//  ブラウザ版の戦闘の状態と、交戦の計画（battlePlan.js）の答え合わせ用の結果を、Unity版に書き出す。
//
//  使い方（静的サーバーで index.html を開ける状態にしてから）:
//    node tools/export_unity_battle_plan.mjs [ポート番号（既定 8931）] [戦闘の id（既定 battle_trial_adopted）]
//
//  画面なしの Edge でブラウザ版を開き、テスト戦闘（battle_trial_adopted）を始めて、
//  ブラウザ版の関数（trialPlanSnapshot・bpForecast・bpPlanExchange・bpFixedRolls）をそのまま呼ぶ。
//  計算の正本はブラウザ版のまま。Unity版は、この結果と同じになるかをテストで確かめる。
//
//  出力:
//    unity-prototype/Assets/Data/Battles/battle_trial_adopted_plan.json
//      … キャラごとの戦闘の状態（能力値・スキル・装備・魔導書の魔法）と、持ち物の一覧
//    unity-prototype/Assets/Tests/EditMode/Fixtures/battle_plan_cases.json
//      … 答え合わせ: 全ての味方×敵の組み合わせ（距離1・2、双方向）の戦闘予測と、乱数を決めて振った交戦
// =====================================================================
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT_SERVER = Number(process.argv[2] || 8931);
const BATTLE_ID = process.argv[3] || "battle_trial_adopted";   // 戦闘（既定はテスト戦闘。プロローグの訓練は battle_prologue_training）
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT_DEBUG = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "srpg-edge-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT_DEBUG}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

let pages = [];
for (let i = 0; i < 40 && !pages.length; i++) {
    await sleep(250);
    try { pages = (await (await fetch(`http://127.0.0.1:${PORT_DEBUG}/json/list`)).json()).filter(p => p.type === "page"); } catch {}
}
if (!pages.length) throw new Error("Edge に接続できない");
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener("message", ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expr => {
    const res = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
    return res.result?.result?.value;
};

await send("Page.enable");
await send("Page.navigate", { url: `http://localhost:${PORT_SERVER}/index.html?t=${Date.now()}` });
await sleep(2500);

// ブラウザの中で実行する（ブラウザ版の関数をそのまま使う）
const result = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    launchDebugBattle(${JSON.stringify(BATTLE_ID)}, "test");
    await wait(1200);
    [...document.querySelectorAll("*")].find(e => e.children.length <= 2 && e.textContent.trim() === "戦闘開始")?.click();
    await wait(1500);

    // 召喚獣（ヒトダマ）も書き出す: 空いているマス (0,7) に仮に置いて、ほかのキャラと同じように扱う（戦闘には出ていない）
    const summoner = battleUnits.find(u => u.id === "ringholm");
    if (summoner && typeof trialCreateSummonUnit === "function" && !battleUnits.some(u => u.id === "hitodama"))
        battleUnits.push(trialCreateSummonUnit("hitodama", summoner, 0, 7));
    const units = battleUnits.filter(u => u.trialStats).map(trialPlanSnapshot);
    // 魔法武器（kind grimoire＝杖）は威力・命中補正・耐久を持つ（採用版 v1.3〜1.4）。物理武器も命中補正を持つ
    const items = Object.entries(TRIAL_ITEMS).map(([id, item]) => ({ id, name: item.name, kind: item.kind, power: item.power ?? 0, range: item.range ?? 0, hit: item.hit ?? 0, durability: item.durability ?? 0 }));

    // 攻撃の行動: 装備が武器なら武器、魔導書なら魔導書の魔法
    const actionFor = u => u.grimoireSpell ? { kind: "grimoire", spell: u.grimoireSpell } : { kind: "weapon" };
    // Unity の JSON 読み込みは「値なし」と 0 を区別できないので、値なしは −1（真偽は −1/0/1）にする
    const n = v => (v === null || v === undefined ? -1 : v);
    const b = v => (v === null || v === undefined ? -1 : v ? 1 : 0);
    const summarize = step => step && step.type === "strike" ? {
        role: step.role, kind: step.kind, hitRate: step.hitRate, damage: step.damage, critRate: step.critRate, critDamage: step.critDamage,
        hit: step.hit, hitRoll: n(step.hitRoll), crit: !!step.crit, critRoll: n(step.critRoll), dealt: step.dealt, targetHpAfter: step.targetHpAfter,
        mpCost: n(step.mpCost), actorMpAfter: n(step.actorMpAfter),
        durabilityCost: n(step.durabilityCost), actorDurabilityAfter: n(step.actorDurabilityAfter),
        reflectDamage: step.reflect ? step.reflect.damage : -1, prayerSaved: b(step.prayer ? step.prayer.saved : null),
        status: step.status ? step.status.type : "",
    } : step && step.type === "counterCheck" ? {
        role: "counterCheck", ok: step.ok, reason: step.reason || "", sealChance: step.seal ? step.seal.chance : -1, sealActive: b(step.seal ? step.seal.active : null),
    } : null;

    const cases = [];
    const rollSets = [
        { name: "forecast" },
        { name: "allHit", percents: [1, 100, 1, 100, 1, 100, 1, 100, 1, 100], dice: [3, 3, 3, 3] },
        { name: "mixed", percents: [40, 5, 60, 90, 30, 2, 70, 50, 20, 80], dice: [2, 5, 1, 4] },
        { name: "allMiss", percents: [100, 100, 100, 100, 100, 100, 100, 100], dice: [6, 6, 6] },
    ];
    for (const a of units) for (const d of units) {
        if (a.side === d.side) continue;
        for (const distance of [1, 2]) {
            const attacker = { ...a, x: 5, y: 4 };
            const defender = { ...d, x: 5 + distance, y: 4 };
            // 周囲の能力（死神・王威）の判定に使う位置: 実際の配置のまま。攻撃側・防御側だけ動かす
            const env = { units: units.map(u => u.id === a.id ? attacker : u.id === d.id ? defender : u), passiveBattle: false };
            const action = actionFor(a);
            for (const set of rollSets) {
                const rolls = set.name === "forecast" ? bpForecastRolls() : bpFixedRolls(set.percents, set.dice);
                const plan = bpPlanExchange(attacker, defender, action, env, rolls);
                cases.push({
                    attackerId: a.id, defenderId: d.id, distance, rolls: set.name,
                    percents: set.percents || [], dice: set.dice || [],
                    steps: plan.steps.map(summarize),
                    attackerHpAfter: plan.attacker.hp, attackerMpAfter: plan.attacker.mp,
                    defenderHpAfter: plan.defender.hp, defenderMpAfter: plan.defender.mp,
                });
            }
        }
    }
    // 物理の戦技（1撃目だけに乗る）: アルシェの両断、リングホルムの復讐（HPを減らして）
    const arts = [["arshe", "両断", null], ["ringholm", "復讐", 10], ["arshe", "大振り", null], ["ringholm", "奇襲", null]];
    for (const [id, art, hp] of arts) {
        for (const d of units.filter(u => u.side === "enemy")) {
            const a = units.find(u => u.id === id);
            if (!a) continue;   // その戦闘にいないキャラ（テスト戦闘以外）
            const attacker = { ...a, x: 5, y: 4, hp: hp ?? a.hp };
            const defender = { ...d, x: 6, y: 4 };
            const env = { units: units.map(u => u.id === a.id ? attacker : u.id === d.id ? defender : u), passiveBattle: false };
            const plan = bpPlanExchange(attacker, defender, { kind: "weapon", artName: art }, env, bpForecastRolls());
            cases.push({
                attackerId: id, defenderId: d.id, distance: 1, rolls: "forecast", artName: art, attackerHp: hp ?? a.hp,
                percents: [], dice: [], steps: plan.steps.map(summarize),
                attackerHpAfter: plan.attacker.hp, attackerMpAfter: plan.attacker.mp,
                defenderHpAfter: plan.defender.hp, defenderMpAfter: plan.defender.mp,
            });
        }
    }
    // 攻撃の選択肢（戦技・魔法の戦技・魔導書）: 味方と敵の全員の選択肢で、届く距離の相手へ（持ち替えも予測と同じにする）
    const planSpell = sp => sp ? {
        id: sp.id || "", name: sp.name || "", targetType: sp.targetType || "", mpCost: String(sp.mpCost ?? ""),
        effectType: sp.effectType || "", statusEffect: sp.statusEffect || "",
    } : null;
    const attackable = spell => spell && spell.targetType === "enemy" && TRIAL_DAMAGING_SPELL_TYPES.has(spell.effectType)
        && spell.trialArtName !== "万雷" && typeof spell.range === "number";
    for (const unit of battleUnits.filter(u => u.trialStats)) {
        const weaponId = trialCarriedWeapon(trialGearOf(unit));
        const options = [];
        if (weaponId) {
            trialUnitPhysicalArts(unit)
                .filter(art => art.implemented && art.name !== "円舞")
                .forEach(art => options.push({ kind: "weapon", artName: art.name, range: Math.max(1, Number(TRIAL_ITEMS[weaponId]?.range || 1)) }));
        }
        getLandscapeMagicEntries(unit).forEach(({ spell }) => {
            if (attackable(spell)) options.push({ kind: spell.trialItemId ? "grimoire" : spell.trialCore ? "core" : "magicArt", artName: spell.trialArtName || "", spell, range: spell.range });
        });
        const a = units.find(u => u.id === unit.id);
        for (const option of options) {
            for (const d of units.filter(u => u.side !== a.side)) {
                for (const distance of [...new Set([1, Math.min(2, option.range)])]) {
                    const attacker = { ...a, x: 5, y: 4 };
                    // 予測と同じ持ち替え（trialPlanPrediction）
                    if (option.kind === "grimoire") { attacker.equippedItem = option.spell.trialItemId; attacker.grimoireSpell = trialGrimoireSpell(option.spell.trialItemId); }
                    else if (option.kind === "weapon" && trialItemKind(attacker.equippedItem) !== "weapon") attacker.equippedItem = weaponId ?? attacker.equippedItem;
                    const defender = { ...d, x: 5 + distance, y: 4 };
                    const env = { units: units.map(u => u.id === a.id ? attacker : u.id === d.id ? defender : u), passiveBattle: false };
                    const action = option.kind === "weapon" ? { kind: "weapon", artName: option.artName } : trialPlanAction(true, option.spell, null);
                    for (const set of [rollSets[0], rollSets[2]]) {
                        const rolls = set.name === "forecast" ? bpForecastRolls() : bpFixedRolls(set.percents, set.dice);
                        const plan = bpPlanExchange(attacker, defender, action, env, rolls);
                        cases.push({
                            attackerId: a.id, defenderId: d.id, distance, rolls: set.name, attackerHp: a.hp,
                            optionKind: option.kind, artName: option.artName || "", spell: planSpell(option.spell),
                            itemId: option.spell?.trialItemId || "", equipSpell: option.kind === "grimoire" ? planSpell(trialGrimoireSpell(option.spell.trialItemId)) : null,
                            weaponItemId: weaponId || "",
                            percents: set.percents || [], dice: set.dice || [], steps: plan.steps.map(summarize),
                            attackerHpAfter: plan.attacker.hp, attackerMpAfter: plan.attacker.mp,
                            defenderHpAfter: plan.defender.hp, defenderMpAfter: plan.defender.mp,
                        });
                    }
                }
            }
        }
    }
    // 範囲の攻撃（円舞・万雷。bpPlanArea）: 2人を巻き込む
    const foes = units.filter(u => u.side === "enemy");
    const areaActions = [
        { attackerId: "ringholm", action: { kind: "weapon" }, label: "円舞", place: [[6, 4], [4, 4]] },
        { attackerId: "arshe", action: trialPlanAction(true, { ...SPELLS_DATA["落雷"], trialArtName: "万雷", name: "万雷" }, null), label: "万雷", place: [[6, 4], [7, 4]] },
    ];
    for (const area of areaActions) {
        const a = units.find(u => u.id === area.attackerId);
        if (!a) continue;
        for (let i = 0; i < foes.length; i++) for (let j = 0; j < foes.length; j++) {
            if (i === j) continue;
            const attacker = { ...a, x: 5, y: 4 };
            const targets = [{ ...foes[i], x: area.place[0][0], y: area.place[0][1] }, { ...foes[j], x: area.place[1][0], y: area.place[1][1] }];
            const env = { units: units.map(u => u.id === a.id ? attacker : targets.find(t => t.id === u.id) || u), passiveBattle: false };
            for (const set of [rollSets[0], rollSets[2]]) {
                const rolls = set.name === "forecast" ? bpForecastRolls() : bpFixedRolls(set.percents, set.dice);
                const plan = bpPlanArea(attacker, targets, area.action, env, rolls);
                cases.push({
                    attackerId: a.id, defenderId: targets[0].id, distance: 1, rolls: set.name, attackerHp: a.hp,
                    area: area.label, areaTargets: targets.map(t => ({ id: t.id, x: t.x, y: t.y })),
                    optionKind: area.action.kind, artName: area.action.artName || "", spell: planSpell(area.action.spell), itemId: "", equipSpell: null, weaponItemId: "",
                    percents: set.percents || [], dice: set.dice || [], steps: plan.steps.map(summarize),
                    attackerHpAfter: plan.attacker.hp, attackerMpAfter: plan.attacker.mp,
                    defenderHpAfter: plan.targets[0].hp, defenderMpAfter: plan.targets[0].mp,
                });
            }
        }
    }

    // 虚像・封印の命中率（getMagicHitResult。攻撃の命中とは足す補正が違う）: 今の配置のまま
    const hits = [];
    for (const unit of battleUnits.filter(u => u.trialStats && u.hp > 0)) {
        const spells = getLandscapeMagicEntries(unit).map(e => e.spell).filter(sp => sp && ["虚像", "封印"].includes(sp.trialArtName));
        for (const sp of spells) {
            for (const foe of battleUnits.filter(u => u.trialStats && u.hp > 0 && u.side !== unit.side)) {
                hits.push({ casterId: unit.id, targetId: foe.id, spell: planSpell(sp), rate: getMagicHitResult(unit, foe, sp, 5, { roll: false }).rate });
            }
        }
    }
    // 専用戦技（bpPlanDrain）: 全員を相手に、月詠（20%）と生命吸収（10%・吸収）
    const drains = [];
    for (const a of units.filter(u => u.side === "ally")) {
        for (const [percent, drain] of [[20, false], [10, true]]) {
            const foes = units.filter(u => u.side !== a.side);
            const hurt = { ...a, hp: Math.max(1, a.hp - 10), mp: Math.max(0, a.mp - 10), maxMp: a.mp };
            const plan = bpPlanDrain(hurt, foes, percent, drain);
            drains.push({ attackerId: a.id, attackerHp: hurt.hp, attackerMp: hurt.mp, targetIds: foes.map(f => f.id), percent, drain,
                damages: plan.hits.map(h => h.damage), targetHpAfter: plan.hits.map(h => h.targetHpAfter), healed: plan.healed,
                attackerHpAfter: plan.attackerHpAfter, attackerMpAfter: plan.attackerMpAfter });
        }
    }
    // Unity の JSON は「値なし」を表せないので、魔法武器の耐久は値なし（満タン扱い）を −1 にして書き出す
    return { units: units.map(u => ({ ...u, staffDurability: n(u.staffDurability) })), items, cases, hits, drains };
})()`);

const dataFile = join(ROOT, "unity-prototype", "Assets", "Data", "Battles", `${BATTLE_ID}_plan.json`);
const fixtureFile = join(ROOT, "unity-prototype", "Assets", "Tests", "EditMode", "Fixtures", "battle_plan_cases.json");
mkdirSync(dirname(dataFile), { recursive: true });
mkdirSync(dirname(fixtureFile), { recursive: true });
writeFileSync(dataFile, JSON.stringify({ battleId: BATTLE_ID, units: result.units, items: result.items }, null, 2) + "\n", "utf8");
// 答え合わせの一覧はテスト戦闘のものだけ（ほかの戦闘では書き換えない）
if (BATTLE_ID === "battle_trial_adopted") writeFileSync(fixtureFile, JSON.stringify({ cases: result.cases, hits: result.hits, drains: result.drains }, null, 1) + "\n", "utf8");
console.log(`書き出し: 戦闘の状態 ${result.units.length}人・持ち物 ${result.items.length}種、答え合わせ ${result.cases.length}件・命中 ${result.hits.length}件`);

ws.close();
edge.kill();
process.exit(0);

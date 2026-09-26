// =====================================================================
//  ブラウザ版の戦闘の状態と、交戦の計画（battlePlan.js）の答え合わせ用の結果を、Unity版に書き出す。
//
//  使い方（静的サーバーで index.html を開ける状態にしてから）:
//    node tools/export_unity_battle_plan.mjs [ポート番号（既定 8931）]
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
    launchDebugBattle("battle_trial_adopted", "test");
    await wait(1200);
    [...document.querySelectorAll("*")].find(e => e.children.length <= 2 && e.textContent.trim() === "戦闘開始")?.click();
    await wait(1500);

    const units = battleUnits.filter(u => u.trialStats).map(trialPlanSnapshot);
    const items = Object.entries(TRIAL_ITEMS).map(([id, item]) => ({ id, name: item.name, kind: item.kind, power: item.power ?? 0, range: item.range ?? 0 }));

    // 攻撃の行動: 装備が武器なら武器、魔導書なら魔導書の魔法
    const actionFor = u => u.grimoireSpell ? { kind: "grimoire", spell: u.grimoireSpell } : { kind: "weapon" };
    // Unity の JSON 読み込みは「値なし」と 0 を区別できないので、値なしは −1（真偽は −1/0/1）にする
    const n = v => (v === null || v === undefined ? -1 : v);
    const b = v => (v === null || v === undefined ? -1 : v ? 1 : 0);
    const summarize = step => step && step.type === "strike" ? {
        role: step.role, kind: step.kind, hitRate: step.hitRate, damage: step.damage, critRate: step.critRate, critDamage: step.critDamage,
        hit: step.hit, hitRoll: n(step.hitRoll), crit: !!step.crit, critRoll: n(step.critRoll), dealt: step.dealt, targetHpAfter: step.targetHpAfter,
        mpCost: n(step.mpCost), actorMpAfter: n(step.actorMpAfter),
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
    return { units, items, cases };
})()`);

const dataFile = join(ROOT, "unity-prototype", "Assets", "Data", "Battles", "battle_trial_adopted_plan.json");
const fixtureFile = join(ROOT, "unity-prototype", "Assets", "Tests", "EditMode", "Fixtures", "battle_plan_cases.json");
mkdirSync(dirname(dataFile), { recursive: true });
mkdirSync(dirname(fixtureFile), { recursive: true });
writeFileSync(dataFile, JSON.stringify({ battleId: "battle_trial_adopted", units: result.units, items: result.items }, null, 2) + "\n", "utf8");
writeFileSync(fixtureFile, JSON.stringify({ cases: result.cases }, null, 1) + "\n", "utf8");
console.log(`書き出し: 戦闘の状態 ${result.units.length}人・持ち物 ${result.items.length}種、答え合わせ ${result.cases.length}件`);

ws.close();
edge.kill();
process.exit(0);

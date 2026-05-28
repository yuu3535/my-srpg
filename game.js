// ============================================================
//  game.js  ―  自作SRPG メインロジック
//  シナリオモード / バトルモード統合
// ============================================================

// =============================================
// DOM 参照
// =============================================
const nameText           = document.getElementById("nameText");
const messageText        = document.getElementById("messageText");
const logTextList        = document.getElementById("logTextList");
const unitLayer          = document.getElementById("unitLayer");
const battleBoard        = document.getElementById("battleBoard");
const battleGrid         = document.getElementById("battleGrid");
const commandHeader      = document.getElementById("commandHeader");
const commandInfo        = document.getElementById("commandInfo");
const commandList        = document.getElementById("commandList");
const scenarioModeButton = document.getElementById("scenarioModeButton");
const battleModeButton   = document.getElementById("battleModeButton");
const fullscreenButton   = document.getElementById("fullscreenButton");
const statusModalOverlay = document.getElementById("statusModalOverlay");
const statusModalTitle   = document.getElementById("statusModalTitle");
const statusModalBody    = document.getElementById("statusModalBody");
const closeStatusModal   = document.getElementById("closeStatusModal");
const statusTabs         = document.querySelectorAll(".statusTab");
const phaseLabel         = document.getElementById("phaseLabel");
const turnLabel          = document.getElementById("turnLabel");
// 新UIパーツ（縦画面デュアルレイヤー）
const radialMenu         = document.getElementById("radialMenu");
const logPanel           = document.getElementById("logPanel");
const topTabs            = document.querySelectorAll(".topTab");
const topLayerDialogue   = document.getElementById("topLayerDialogue");
const topLayerBattle     = document.getElementById("topLayerBattle");
const scenarioCharLayer  = document.getElementById("scenarioCharLayer");
const topPanelBg         = document.getElementById("topPanelBg");
const dialogueBox        = document.getElementById("dialogueBox");
const topPanel           = document.getElementById("topPanel");
const bgImage            = document.getElementById("bgImage");

// =============================================
// 定数
// =============================================
const GRID_COLS = 10;
const GRID_ROWS = 10;

// 攻撃ボタンの命中ロールに使うスキル優先順（魔導はパッシブなので除外）
const ATTACK_SKILL_PRIORITY = [
    "武器", "爪", "ブレス", "キック", "こぶし", "尾撃", "噛む", "暗器", "投擲"
];

// 特技メニューに表示する戦闘ユーティリティスキル
const BATTLE_UTILITY_SKILLS = new Set([
    "応急手当", "医学", "戦闘指揮", "目星", "集中", "挑発", "庇う"
]);

// 回避スキル名
const EVADE_SKILL_NAME = "回避";

// =============================================
// ゲームモード状態
// =============================================
let gameMode = "scenario";

// =============================================
// バトル状態
// =============================================
// =============================================
// シナリオ状態
// =============================================
let scenarioActive    = false;  // シナリオ再生中か
let currentChapter    = null;   // 現在の章データ
let currentSceneIdx   = 0;      // 現在のシーンインデックス
let fromScenario      = false;  // バトルがシナリオ経由か
let scenarioCharacters = [];    // 現在ステージに立つキャラ [文字列 or {name,image}]

// =============================================
// バトル状態
// =============================================
let battleUnits     = [];   // CHARACTERS_DATA のディープコピー（生データ）
let selectedUnit        = null;
let actionState         = null; // null | "moving" | "attacking" | "throwing" | "magic"
let selectedSpell       = null;
let selectedAttackSkill = null;
let turnPhase       = "ally"; // "ally" | "enemy"
let turnCount       = 1;
let battleOver      = false;
let statusTargetId  = null; // ステータスモーダル表示対象
let currentStatusTab = "basic";

// =============================================
// ダイス
// =============================================
/**
 * "NdM"・"NdM+X"・"NdM/2" 等を評価してランダムな合計値を返す
 * MBやDB等の変数が含まれている場合は事前に数値に置換してから渡す
 */
function rollDice(formula) {
    if (!formula || formula === "0" || formula === 0) return 0;
    const str = String(formula);

    // "NdM" を展開して数値に置き換える
    let expr = str.replace(/(\d+)d(\d+)/g, (_, n, m) => {
        let total = 0;
        const count = parseInt(n);
        const sides = parseInt(m);
        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        return total;
    });

    // 残った演算子（+,-,*,/）だけで計算（安全な評価）
    try {
        // 数字・演算子・括弧以外を除去してから評価
        const safe = expr.replace(/[^0-9+\-*/().]/g, "");
        if (!safe) return 0;
        // eslint-disable-next-line no-new-func
        return Math.max(0, Math.floor(new Function("return " + safe)()));
    } catch (e) {
        return 0;
    }
}

/**
 * "1d6+MB" のようなダメージ式を評価する
 * MB・DB は事前に rollDice() した数値を渡す
 */
function evalDamage(formula, mb, db) {
    if (!formula) return 0;
    return rollDice(
        formula.replace(/MB/g, mb).replace(/DB/g, db)
    );
}

// =============================================
// グリッド構築
// =============================================
function createGrid() {
    battleGrid.innerHTML = "";
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const cell = document.createElement("div");
            cell.className = "gridCell";
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener("click", () => onCellClick(row, col));
            battleGrid.appendChild(cell);
        }
    }
}

function getCell(row, col) {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
    return battleGrid.children[row * GRID_COLS + col];
}

function clearHighlights() {
    for (const cell of battleGrid.children) {
        cell.classList.remove("highlightMove", "highlightAttack");
    }
}

// =============================================
// ユニット描画
// =============================================
function renderUnits() {
    unitLayer.innerHTML = "";
    for (const unit of battleUnits) {
        if (unit.hp <= 0) continue;

        const el = document.createElement("div");
        el.className = `battleUnit ${unit.side === "ally" ? "allyUnit" : "enemyUnit"}`;
        el.id = `unit_${unit.id}`;
        el.dataset.id = unit.id;

        if (unit.tokenImage) {
            const img = document.createElement("img");
            img.src = unit.tokenImage;
            img.alt = unit.name;
            el.appendChild(img);
        } else {
            const label = document.createElement("span");
            label.className = "unitLabel";
            label.textContent = unit.char || unit.name.slice(0, 1);
            el.appendChild(label);
        }

        // HPバー
        const hpBar  = document.createElement("div");
        hpBar.className = "unitHpBar";
        const hpFill = document.createElement("div");
        hpFill.className = "unitHpFill";
        const hpPct = unit.hp / unit.maxHp;
        hpFill.style.width = `${hpPct * 100}%`;
        if (hpPct <= 0.25)      hpFill.classList.add("critical");
        else if (hpPct <= 0.5)  hpFill.classList.add("low");
        hpBar.appendChild(hpFill);
        el.appendChild(hpBar);

        // 位置（x=col, y=row）
        el.style.left = `${unit.x * 10}%`;
        el.style.top  = `${unit.y * 10}%`;

        if (unit.moved && unit.acted) el.classList.add("unitDone");

        el.addEventListener("click", (e) => {
            e.stopPropagation();
            onUnitClick(unit);
        });

        unitLayer.appendChild(el);
    }
}

// =============================================
// クリックハンドラ
// =============================================
function onUnitClick(unit) {
    if (gameMode !== "battle" || battleOver) return;

    // ── 攻撃対象選択中 ──
    if (actionState === "attacking" && selectedUnit) {
        if (unit.side !== selectedUnit.side && unit.hp > 0) {
            const dist = Math.abs(selectedUnit.x - unit.x) + Math.abs(selectedUnit.y - unit.y);
            if (dist <= selectedUnit.attackRange) {
                clearHighlights();
                executeAttack(selectedUnit, unit);
            } else {
                showMessage("SYSTEM", `${unit.name}は射程外です。`);
            }
        }
        return;
    }

    // ── 投擲対象選択中 ──
    if (actionState === "throwing" && selectedUnit) {
        if (unit.side !== selectedUnit.side && unit.hp > 0) {
            const dx = unit.x - selectedUnit.x;
            const dy = unit.y - selectedUnit.y;
            // 直線4マス以内か判定（縦か横のみ）
            const inLine = (dx === 0 || dy === 0) && Math.abs(dx) + Math.abs(dy) <= 4;
            if (inLine) {
                clearHighlights();
                executeThrow(selectedUnit, unit);
            } else {
                showMessage("SYSTEM", `${unit.name}は投擲射程外です（直線4マス以内）。`);
            }
        }
        return;
    }

    // ── 魔法対象選択中 ──
    if (actionState === "magic" && selectedUnit && selectedSpell) {
        const spell = selectedSpell;
        const caster = selectedUnit;
        const isAlly = unit.side === caster.side;

        if ((spell.targetType === "enemy" && isAlly) ||
            (spell.targetType === "ally"  && !isAlly)) {
            showMessage("SYSTEM", "対象が無効です。");
            return;
        }
        if (typeof spell.range === "number") {
            const dist = Math.abs(caster.x - unit.x) + Math.abs(caster.y - unit.y);
            if (dist > spell.range) {
                showMessage("SYSTEM", `${unit.name}は射程外です。`);
                return;
            }
        }
        clearHighlights();
        executeMagic(caster, spell, unit);
        return;
    }

    // ── 通常選択 ──
    if (turnPhase === "ally" && unit.side === "ally" && unit.hp > 0) {
        if (unit.moved && unit.acted) {
            showMessage("SYSTEM", `${unit.name}はすでに行動済みです。`);
            return;
        }
        selectUnit(unit);
    } else if (unit.side === "enemy" && unit.hp > 0) {
        showMessage("SYSTEM", `【${unit.name}】 HP: ${unit.hp}/${unit.maxHp}  MP: ${unit.mp}/${unit.maxMp}`);
    }
}

function onCellClick(row, col) {
    if (gameMode !== "battle" || battleOver) return;
    if (actionState !== "moving" || !selectedUnit) return;

    const cell = getCell(row, col);
    if (!cell || !cell.classList.contains("highlightMove")) return;

    const occupant = battleUnits.find(u => u.hp > 0 && u.x === col && u.y === row);
    if (occupant) {
        showMessage("SYSTEM", "そのマスには別のユニットがいます。");
        return;
    }
    moveUnit(selectedUnit, row, col);
}

// =============================================
// ラジアルメニュー
// =============================================
/** ラジアルメニューをユニット位置に初期化（位置セット＋クリア） */
function initRadialAtUnit(unit) {
    const GRID_INSET = 44;
    const INNER_PX   = 390 - GRID_INSET * 2;
    const CELL_PX    = INNER_PX / GRID_COLS;
    const TOP_H      = 237;
    radialMenu.innerHTML = "";
    radialMenu.classList.remove("hidden");
    radialMenu.style.left = `${GRID_INSET + (unit.x + 0.5) * CELL_PX}px`;
    radialMenu.style.top  = `${TOP_H + GRID_INSET + (unit.y + 0.5) * CELL_PX}px`;
}

/** アイテム配列をラジアルボタンとして配置する */
function buildRadialButtons(items, radius, onClick) {
    const n = items.length;
    const startAngle = -Math.PI / 2;
    items.forEach((item, i) => {
        const angle = startAngle + (i / n) * 2 * Math.PI;
        const tx    = Math.cos(angle) * radius;
        const ty    = Math.sin(angle) * radius;
        const btn   = document.createElement("button");
        btn.className = "radialBtn";
        btn.innerHTML = item.html;
        btn.style.transform = `translate(calc(${tx}px - 50%), calc(${ty}px - 50%))`;
        btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(item); });
        radialMenu.appendChild(btn);
    });
}

/** ラジアル中央ラベル */
function addRadialCenter(text) {
    const center = document.createElement("div");
    center.className   = "radialCenter";
    center.textContent = text;
    radialMenu.appendChild(center);
}

function showRadialMenu(unit) {
    initRadialAtUnit(unit);

    const cmds = [];
    if (!unit.moved) cmds.push({ label: "移動", sub: "MOVE" });
    if (!unit.acted) {
        cmds.push({ label: "攻撃", sub: "ATK" });
        cmds.push({ label: "魔法", sub: "MAG" });
        const hasUtility = Object.keys(unit.skills || {}).some(s => BATTLE_UTILITY_SKILLS.has(s));
        if (hasUtility) cmds.push({ label: "特技", sub: "SKL" });
    }
    cmds.push({ label: "ステータス", sub: "ST" });
    cmds.push({ label: "待機", sub: "WAIT" });
    cmds.push({ label: "戻る", sub: "←" });

    const radius = Math.max(46, cmds.length * 9);
    buildRadialButtons(
        cmds.map(({ label, sub }) => ({ label, html: `${label}<span class="radialBtnSub">${sub}</span>` })),
        radius,
        ({ label }) => handleBattleCommand(unit, label)
    );
}

/** 攻撃スキル選択ラジアル（2段目） */
function showAttackRadial(unit) {
    initRadialAtUnit(unit);

    const atkSkills = ATTACK_SKILL_PRIORITY
        .filter(name => name in (unit.skills || {}))
        .map(name => ({ label: name, val: unit.skills[name] }));
    const items = [
        ...atkSkills.map(({ label, val }) => ({
            label,
            html: `${label}<span class="radialBtnSub">${val}</span>`,
            isBack: false,
        })),
        { label: "戻る", html: `戻る<span class="radialBtnSub">BACK</span>`, isBack: true },
    ];

    const radius = Math.max(46, items.length * 9);
    buildRadialButtons(items, radius, (item) => {
        if (item.isBack) { renderBattleCommands(unit); return; }
        selectedAttackSkill = item.label;
        hideRadialMenu();
        if (item.label === "投擲") {
            const throwTargets = battleUnits.filter(u => {
                if (u.side === unit.side || u.hp <= 0) return false;
                const dx = u.x - unit.x, dy = u.y - unit.y;
                return (dx === 0) !== (dy === 0) && Math.abs(dx) + Math.abs(dy) <= 4;
            });
            if (throwTargets.length === 0) {
                showMessage("SYSTEM", "投擲射程内に敵がいません");
                renderBattleCommands(unit);
                return;
            }
            actionState = "throwing";
            highlightThrowRange(unit);
            showMessage("SYSTEM", `${unit.name}の投擲対象を選択（直線4マス）`);
        } else {
            const atkTargets = battleUnits.filter(u =>
                u.side !== unit.side && u.hp > 0 &&
                Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= unit.attackRange
            );
            if (atkTargets.length === 0) {
                showMessage("SYSTEM", "攻撃射程内に敵がいません");
                renderBattleCommands(unit);
                return;
            }
            actionState = "attacking";
            highlightAttackRange(unit);
            showMessage("SYSTEM", `${unit.name}の攻撃対象を選択（${item.label}）`);
        }
        addLog(`・${unit.name}は${item.label}で攻撃を選択`);
    });
}


/** 魔法選択ラジアル（2段目） */
function showMagicRadial(unit) {
    initRadialAtUnit(unit);

    const spellEntries = Object.entries(unit.spells || {})
        .filter(([id]) => SPELLS_DATA[id]);
    const items = [
        ...spellEntries.map(([id, val]) => {
            const sp = SPELLS_DATA[id];
            return { id, val, spellData: sp, html: `${sp.name}<span class="radialBtnSub">${val}</span>`, isBack: false };
        }),
        { id: null, val: null, html: `戻る<span class="radialBtnSub">BACK</span>`, isBack: true },
    ];

    const radius = Math.max(50, items.length * 10);
    buildRadialButtons(items, radius, (item) => {
        if (item.isBack) { renderBattleCommands(unit); return; }

        // 射程がある呪文は対象がいるか確認
        if (typeof item.spellData.range === "number") {
            const sp = item.spellData;
            const inRange = battleUnits.filter(u => {
                if (u.hp <= 0) return false;
                const dist = Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y);
                if (dist === 0 || dist > sp.range) return false;
                return sp.targetType === "enemy"
                    ? u.side !== unit.side
                    : u.side === unit.side;
            });
            if (inRange.length === 0) {
                const label = sp.targetType === "enemy" ? "敵" : "味方";
                showMessage("SYSTEM", `射程内に${label}がいません`);
                showMagicRadial(unit);
                return;
            }
        }

        selectedSpell = item.spellData;
        actionState   = "magic";
        hideRadialMenu();
        clearHighlights();
        if (typeof item.spellData.range === "number") {
            for (let dy = -item.spellData.range; dy <= item.spellData.range; dy++) {
                for (let dx = -item.spellData.range; dx <= item.spellData.range; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) > item.spellData.range) continue;
                    if (dx === 0 && dy === 0) continue;
                    const cell = getCell(unit.y + dy, unit.x + dx);
                    if (cell) cell.classList.add("highlightAttack");
                }
            }
        }
        showMessage(unit.name, `${item.spellData.name}の対象を選んでください。`);
        addLog(`・${unit.name}は ${item.spellData.name} を詠唱中...`);
    });
}


function hideRadialMenu() {
    radialMenu.classList.add("hidden");
    radialMenu.innerHTML = "";
}

// =============================================
// ユニット選択 / 選択解除
// =============================================
function selectUnit(unit) {
    if (selectedUnit) {
        const prev = document.getElementById(`unit_${selectedUnit.id}`);
        if (prev) prev.classList.remove("unitSelected");
    }
    selectedUnit  = unit;
    actionState   = null;
    selectedSpell = null;
    clearHighlights();

    const el = document.getElementById(`unit_${unit.id}`);
    if (el) el.classList.add("unitSelected");

    renderBattleCommands(unit);
    showMessage("SYSTEM", `${unit.name}の行動を選択してください。`);
}

function deselectUnit() {
    if (selectedUnit) {
        const el = document.getElementById(`unit_${selectedUnit.id}`);
        if (el) el.classList.remove("unitSelected");
    }
    selectedUnit        = null;
    actionState         = null;
    selectedSpell       = null;
    selectedAttackSkill = null;
    clearHighlights();
    hideRadialMenu();
    renderIdlePanel();
}

// =============================================
// 移動
// =============================================
/** BFS で移動可能マスを列挙（enemy は通過不可） */
function getMoveRange(unit) {
    const reachable = [];
    const visited   = new Set();
    const queue     = [{ x: unit.x, y: unit.y, remaining: unit.move }];
    visited.add(`${unit.x},${unit.y}`);

    while (queue.length > 0) {
        const { x, y, remaining } = queue.shift();
        if (!(x === unit.x && y === unit.y)) {
            reachable.push({ col: x, row: y });
        }
        if (remaining <= 0) continue;

        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            // 敵ユニットは通過不可
            const occ = battleUnits.find(u => u.hp > 0 && u.x === nx && u.y === ny);
            if (occ && occ.side !== unit.side) continue;
            visited.add(key);
            queue.push({ x: nx, y: ny, remaining: remaining - 1 });
        }
    }
    return reachable;
}

function highlightMoveRange(unit) {
    clearHighlights();
    for (const { col, row } of getMoveRange(unit)) {
        const cell = getCell(row, col);
        if (cell) cell.classList.add("highlightMove");
    }
}

function moveUnit(unit, row, col) {
    addLog(`・${unit.name} (${unit.x},${unit.y})→(${col},${row}) に移動`);
    unit.x = col;
    unit.y = row;
    unit.moved = true;
    clearHighlights();
    actionState = null;
    renderUnits();

    // 移動後まだ行動していなければコマンドを再表示
    if (!unit.acted) {
        selectUnit(unit);
    } else {
        endUnitTurn(unit);
    }
}

// =============================================
// 攻撃
// =============================================
function highlightAttackRange(unit) {
    clearHighlights();
    const range = unit.attackRange;
    for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > range) continue;
            if (dx === 0 && dy === 0) continue;
            const nx = unit.x + dx, ny = unit.y + dy;
            if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
            const cell = getCell(ny, nx);
            if (cell) cell.classList.add("highlightAttack");
        }
    }
}

/** 投擲射程のハイライト：上下左右の直線4マス以内 */
function highlightThrowRange(unit) {
    clearHighlights();
    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
        for (let i = 1; i <= 4; i++) {
            const nx = unit.x + dx * i;
            const ny = unit.y + dy * i;
            if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) break;
            const cell = getCell(ny, nx);
            if (cell) cell.classList.add("highlightAttack");
            // 途中にユニットがいても貫通しない
            if (battleUnits.some(u => u.hp > 0 && u.x === nx && u.y === ny)) break;
        }
    }
}

/** 物理攻撃スキル値とスキル名を取得 */
function getAttackSkillVal(unit) {
    for (const name of ATTACK_SKILL_PRIORITY) {
        if (name in unit.skills) return { val: unit.skills[name], name };
    }
    // 部分一致フォールバック（"武器：剣" 等）
    for (const [key, val] of Object.entries(unit.skills)) {
        if (ATTACK_SKILL_PRIORITY.some(n => key.includes(n))) return { val, name: key };
    }
    return { val: 5, name: "攻撃" };
}

/** 回避スキル値を取得 */
function getEvadeSkillVal(unit) {
    return unit.skills[EVADE_SKILL_NAME] ?? 0;
}

/**
 * 対抗表による成功率を返す（1d100 <= 戻り値 で成功）
 * 成功率 = 50 + (能動 - 受動) × 5
 * 差が±10以上は自動成功(100) / 自動失敗(0)
 */
function getOpposedRate(activeStat, passiveStat) {
    const diff = activeStat - passiveStat;
    if (diff >= 10) return 100;
    if (diff <= -10) return 0;
    return 50 + diff * 5;
}

/**
 * 命中後の物理ダメージ適用（武道×2・カウンター・装甲・気絶・反撃を処理）
 */
function resolvePhysicalHit(attacker, target, atkSkillName) {
    // カウンター状態：同じダメージを両者に与える
    if ((target.statusEffects || []).some(e => e.type === "counter")) {
        let baseDmg = Math.floor(Math.random() * 6) + 1;
        const db    = rollDice(attacker.physicalBonus);
        if ("武道" in (attacker.skills || {})) {
            const r = Math.floor(Math.random() * 10) + 1;
            if (r <= attacker.skills["武道"]) { baseDmg *= 2; addLog(`  武道発動（${r}/${attacker.skills["武道"]}）！基本ダメージ2倍`); }
        }
        const rawDmg = baseDmg + db;
        // 攻撃側も同じダメージ
        attacker.hp = Math.max(0, attacker.hp - rawDmg);
        // 防御側（カウンター持ち）も同じダメージ
        target.hp   = Math.max(0, target.hp - rawDmg);
        addLog(`  カウンター発動！${rawDmg}ダメージ → ${target.name} HP ${target.hp}/${target.maxHp} / ${attacker.name} HP ${attacker.hp}/${attacker.maxHp}`);
        showMessage("SYSTEM", `${target.name}のカウンター！お互いに ${rawDmg} ダメージ！`);
        renderUnits();
        if (target.hp   <= 0) addLog(`  ${target.name}は倒れた！`);
        if (attacker.hp <= 0) addLog(`  ${attacker.name}は倒れた！`);
        return;
    }

    // 通常ダメージ計算
    let baseDmg = Math.floor(Math.random() * 6) + 1;
    const db    = rollDice(attacker.physicalBonus);

    // 武道：スキルロール成功で基本ダメージ2倍（魔導と対称）
    let budoNote = "";
    if ("武道" in (attacker.skills || {})) {
        const budoVal  = attacker.skills["武道"];
        const budoRoll = Math.floor(Math.random() * 10) + 1;
        if (budoRoll <= budoVal) {
            budoNote = `（武道発動:${budoRoll}/${budoVal} ${baseDmg}→${baseDmg * 2}）`;
            baseDmg *= 2;
        }
    }
    const rawDmg = baseDmg + db;

    // 装甲（barrier）チェック：ダメージを軽減、装甲は壊れない
    const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
    let actualDmg = rawDmg;
    let barrierNote = "";
    if (barrier && barrier.value > 0) {
        const absorbed = Math.min(barrier.value, rawDmg);
        actualDmg = rawDmg - absorbed;
        barrierNote = `（装甲${absorbed}吸収）`;
    }

    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - actualDmg);
    addLog(`  命中！${actualDmg}ダメージ${budoNote}${barrierNote}（基本:${baseDmg} + DB:${db}）→ ${target.name} HP ${target.hp}/${target.maxHp}`);
    showMessage("SYSTEM", `${attacker.name}の攻撃命中！${target.name}に ${actualDmg} ダメージ！`);

    // 気絶チェック：HPが一気に2以下に減った場合 CON×5% 失敗で戦闘不能
    if (hpBefore > 2 && target.hp <= 2 && target.hp > 0) {
        const conRate  = (target.con || 10) * 5;
        const conCheck = Math.floor(Math.random() * 100) + 1;
        if (conCheck > conRate) {
            target.hp = 0;
            addLog(`  ${target.name}は気絶した！（CON×5%:${conRate}% 失敗:${conCheck}）`);
        } else {
            addLog(`  ${target.name}は踏みとどまった（CON×5%:${conRate}%）`);
        }
    }

    renderUnits();
    if (target.hp <= 0) addLog(`  ${target.name}は倒れた！`);

    // 反撃チェック：勇気% 成功で半ダメージ反撃
    if (target.hp > 0) {
        const courageRoll = Math.floor(Math.random() * 100) + 1;
        if (courageRoll <= (target.courage || 50)) {
            const { val: ctrAtk, name: ctrName } = getAttackSkillVal(target);
            const ctrEvade = getEvadeSkillVal(attacker);
            const ctrRate  = getOpposedRate(ctrAtk, ctrEvade);
            const ctrRoll  = Math.floor(Math.random() * 100) + 1;
            const ctrHit   = ctrRoll <= ctrRate;
            showMessage(target.name, "反撃！");
            addLog(`  反撃！${target.name}【${ctrName}${ctrAtk} vs 回避${ctrEvade}】 ${ctrRoll}/${ctrRate}% → ${ctrHit ? "命中" : "失敗"}`);
            if (ctrHit) {
                let ctrBase = Math.floor(Math.random() * 6) + 1;
                const ctrDb = rollDice(target.physicalBonus);
                if ("武道" in (target.skills || {})) {
                    const r = Math.floor(Math.random() * 10) + 1;
                    if (r <= target.skills["武道"]) { ctrBase *= 2; addLog(`    武道発動（${r}/${target.skills["武道"]}）！`); }
                }
                const ctrDmg = Math.max(1, Math.floor((ctrBase + ctrDb) / 2));
                attacker.hp  = Math.max(0, attacker.hp - ctrDmg);
                addLog(`    ${ctrDmg}ダメージ（半分）→ ${attacker.name} HP ${attacker.hp}/${attacker.maxHp}`);
                renderUnits();
                if (attacker.hp <= 0) addLog(`    ${attacker.name}は倒れた！`);
            }
        }
    }
}

function executeAttack(attacker, target) {
    // スタン中は攻撃不可
    if ((attacker.statusEffects || []).some(e => e.type === "stun")) {
        addLog(`・${attacker.name}はスタン中のため攻撃できない`);
        showMessage("SYSTEM", `${attacker.name}はスタン中！`);
        endUnitTurn(attacker);
        return;
    }

    let atkSkillName, atkStat;
    if (selectedAttackSkill && selectedAttackSkill in (attacker.skills || {})) {
        atkSkillName = selectedAttackSkill;
        atkStat      = attacker.skills[selectedAttackSkill];
    } else {
        ({ val: atkStat, name: atkSkillName } = getAttackSkillVal(attacker));
    }
    selectedAttackSkill = null;

    // スタン中の相手は回避不可
    const targetStunned = (target.statusEffects || []).some(e => e.type === "stun");
    const evadeStat = targetStunned ? 0 : getEvadeSkillVal(target);
    const rate      = targetStunned ? 100 : getOpposedRate(atkStat, evadeStat);
    const roll      = Math.floor(Math.random() * 100) + 1;
    const isHit     = roll <= rate;

    const rollNote = targetStunned ? "スタン中：自動命中" : `${roll}/${rate}%`;
    addLog(`・${attacker.name} → ${target.name} 【${atkSkillName}${atkStat} vs 回避${evadeStat}】 ${rollNote} → ${isHit ? "命中" : "失敗"}`);

    if (!isHit) {
        showMessage("SYSTEM", `${attacker.name}の攻撃は外れた！`);
        endUnitTurn(attacker);
        return;
    }

    resolvePhysicalHit(attacker, target, atkSkillName);
    endUnitTurn(attacker);
    checkVictoryCondition();
}

function executeThrow(attacker, target) {
    const throwStat = attacker.skills["投擲"] ?? 5;
    const targetStunned = (target.statusEffects || []).some(e => e.type === "stun");
    const evadeStat = targetStunned ? 0 : getEvadeSkillVal(target);
    const rate  = targetStunned ? 100 : getOpposedRate(throwStat, evadeStat);
    const roll  = Math.floor(Math.random() * 100) + 1;
    const isHit = roll <= rate;

    const rollNote = targetStunned ? "スタン中：自動命中" : `${roll}/${rate}%`;
    addLog(`・${attacker.name} 投擲 → ${target.name} 【投擲${throwStat} vs 回避${evadeStat}】 ${rollNote} → ${isHit ? "命中" : "失敗"}`);

    if (!isHit) {
        showMessage("SYSTEM", `${attacker.name}の投擲は外れた！`);
        endUnitTurn(attacker);
        return;
    }

    resolvePhysicalHit(attacker, target, "投擲");
    endUnitTurn(attacker);
    checkVictoryCondition();
}

// =============================================
// 魔法
// =============================================
function renderMagicCommands(unit) {
    hideRadialMenu();
    commandHeader.textContent = "魔法";
    commandInfo.textContent   = `MP: ${unit.mp}/${unit.maxMp}`;
    commandList.innerHTML     = "";

    for (const spellId of Object.keys(unit.spells || {})) {
        const spellData  = SPELLS_DATA[spellId];
        if (!spellData) continue;
        const successVal = unit.spells[spellId];

        const btn = document.createElement("button");
        btn.className   = "commandItem";
        btn.textContent = `${spellData.name}（${successVal}）`;
        btn.addEventListener("click", () => {
            selectedSpell = spellData;
            actionState   = "magic";
            clearHighlights();

            // 射程ハイライト
            if (typeof spellData.range === "number") {
                for (let dy = -spellData.range; dy <= spellData.range; dy++) {
                    for (let dx = -spellData.range; dx <= spellData.range; dx++) {
                        if (Math.abs(dx) + Math.abs(dy) > spellData.range) continue;
                        if (dx === 0 && dy === 0) continue;
                        const nx = unit.x + dx, ny = unit.y + dy;
                        const cell = getCell(ny, nx);
                        if (cell) cell.classList.add("highlightAttack");
                    }
                }
            }
            showMessage(unit.name, `${spellData.name}の対象を選んでください。`);
            addLog(`・${unit.name}は ${spellData.name} を詠唱中...`);
        });
        commandList.appendChild(btn);
    }

    const backBtn = document.createElement("button");
    backBtn.className   = "commandItem";
    backBtn.textContent = "戻る";
    backBtn.addEventListener("click", () => {
        actionState   = null;
        selectedSpell = null;
        clearHighlights();
        renderBattleCommands(unit);
    });
    commandList.appendChild(backBtn);
}

function executeMagic(caster, spell, target) {
    const successVal = caster.spells[spell.id] ?? 5;
    const roll       = Math.floor(Math.random() * 10) + 1;
    const success    = roll <= successVal;

    // MPコスト
    const mpCost = rollDice(spell.mpCost || "1d6");
    caster.mp    = Math.max(0, caster.mp - mpCost);
    addLog(`・${caster.name}が ${spell.name} 使用（${roll} vs ${successVal}）  MP-${mpCost}`);

    if (!success) {
        addLog("  失敗！");
        showMessage("SYSTEM", `${caster.name}の${spell.name}は失敗した！`);
        endUnitTurn(caster);
        return;
    }

    const mb = rollDice(caster.magicBonus);

    // 魔導チェック：成功で魔法基本ダメージ2倍
    let magicBoost = false;
    if ("魔導" in (caster.skills || {})) {
        const madouVal  = caster.skills["魔導"];
        const madouRoll = Math.floor(Math.random() * 10) + 1;
        if (madouRoll <= madouVal) {
            magicBoost = true;
            addLog(`  魔導発動（${madouRoll}/${madouVal}）！魔法基本ダメージ2倍！`);
        }
    }

    switch (spell.effectType) {
        case "magicDamage": {
            // powerFormula からMB部分を除いたベース式を取得
            const basePart = (spell.powerFormula || "1d6+MB")
                .replace(/\+?\s*MB/g, "").replace(/MB\s*\+?/g, "").trim() || "1d6";
            let baseDmg = rollDice(basePart);
            let boostNote = "";
            if (magicBoost) {
                boostNote = `（魔導:${baseDmg}→${baseDmg * 2}）`;
                baseDmg *= 2;
            }

            // 装甲チェック（魔法でも軽減、ただし破壊魔法は別処理）
            const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
            let rawDmg = baseDmg + mb;
            let barrierNote = "";
            if (barrier && barrier.value > 0) {
                const absorbed = Math.min(barrier.value, rawDmg);
                rawDmg -= absorbed;
                barrierNote = `（装甲${absorbed}吸収）`;
            }

            const hpBefore = target.hp;
            target.hp = Math.max(0, target.hp - rawDmg);
            addLog(`  命中！${rawDmg}ダメージ${boostNote}${barrierNote}（base:${baseDmg} + MB:${mb}）→ ${target.name} HP ${target.hp}/${target.maxHp}`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}命中！${target.name}に ${rawDmg} ダメージ！`);

            // 気絶チェック
            if (hpBefore > 2 && target.hp <= 2 && target.hp > 0) {
                const conRate  = (target.con || 10) * 5;
                const conCheck = Math.floor(Math.random() * 100) + 1;
                if (conCheck > conRate) {
                    target.hp = 0;
                    addLog(`  ${target.name}は気絶した！（CON×5%:${conRate}% 失敗:${conCheck}）`);
                }
            }

            // スペル固有の状態異常付与（10ダメ以上 + 幸運%成功）
            const dmgForCheck = baseDmg + mb; // 装甲前のダメージで判定
            if (dmgForCheck >= 10 && spell.statusEffect) {
                const luckRate = caster.luck || 50;
                const luckRoll = Math.floor(Math.random() * 100) + 1;
                if (luckRoll <= luckRate) {
                    target.statusEffects = target.statusEffects || [];
                    if (spell.statusEffect === "burn") {
                        const dur = rollDice("1d6");
                        target.statusEffects.push({ type: "burn", duration: dur });
                        addLog(`  火傷状態！（${dur}ターン）`);
                    } else if (spell.statusEffect === "slow") {
                        target.statusEffects.push({ type: "accuracyDown", value: -1, duration: 3 });
                        addLog(`  ${target.name}の命中-1（氷：3ターン）`);
                    } else if (spell.statusEffect === "knockback") {
                        addLog(`  ${target.name}が吹き飛ばされた！（風）`);
                    }
                }
            }

            if (target.hp <= 0) addLog(`  ${target.name}は倒れた！`);
            break;
        }
        case "heal": {
            const healAmt = Math.floor(Math.random() * 6) + 1 + mb;
            target.hp = Math.min(target.maxHp, target.hp + healAmt);
            addLog(`  ${target.name}を ${healAmt} 回復（HP ${target.hp}/${target.maxHp}）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}のHP+${healAmt}`);
            break;
        }
        case "barrier": {
            const val = rollDice(spell.powerFormula || "2d4");
            const dur = rollDice(spell.durationFormula || "1d3");
            target.statusEffects = target.statusEffects || [];
            target.statusEffects.push({ type: "barrier", value: val, duration: dur });
            addLog(`  ${target.name}に装甲+${val}（${dur}ターン）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}に結界（装甲+${val}）`);
            break;
        }
        case "accuracyDown": {
            const dur = rollDice(spell.durationFormula || "1d3");
            target.statusEffects = target.statusEffects || [];
            target.statusEffects.push({ type: "accuracyDown", value: spell.effectValue || -2, duration: dur });
            addLog(`  ${target.name}の命中-${Math.abs(spell.effectValue || 2)}（${dur}ターン）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}の命中低下！`);
            break;
        }
        case "extraAction": {
            target.moved = false;
            target.acted = false;
            const el = document.getElementById(`unit_${target.id}`);
            if (el) el.classList.remove("unitDone");
            addLog(`  ${target.name}が加速！再行動可能`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}が再行動！`);
            break;
        }
        case "break": {
            target.statusEffects = (target.statusEffects || []).filter(e => e.type !== "barrier");
            addLog(`  ${target.name}の結界を破壊！`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}の結界を破壊！`);
            break;
        }
        case "stun": {
            const dur = rollDice(spell.durationFormula || "1d3");
            target.statusEffects = target.statusEffects || [];
            target.statusEffects.push({ type: "stun", duration: dur });
            addLog(`  ${target.name}を ${dur} ターンスタン！`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}を封印（${dur}T）！`);
            break;
        }
        case "counter": {
            const dur = rollDice(spell.durationFormula || "2d3");
            caster.statusEffects = caster.statusEffects || [];
            caster.statusEffects.push({ type: "counter", duration: dur });
            addLog(`  ${caster.name}にカウンター状態（${dur}ターン）`);
            showMessage("SYSTEM", `${caster.name}のカウンター発動！${dur}ターン間、受けたダメージを跳ね返す！`);
            break;
        }
        case "nightmare": {
            const reduction = rollDice(spell.effectValue || "1d6");
            // 勇気の代わりにMPを削る（SRPG内での表現）
            target.mp = Math.max(0, target.mp - reduction);
            addLog(`  ${target.name}のMPを ${reduction} 削った（悪夢）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}のMP-${reduction}！`);
            break;
        }
        case "areaDamage": {
            // 縦方向3マス以内の敵全体に攻撃
            const mbForArea = rollDice(caster.magicBonus);
            const targets = battleUnits.filter(u =>
                u.side !== caster.side && u.hp > 0 &&
                Math.abs(u.y - caster.y) <= (spell.range || 3) &&
                Math.abs(u.x - caster.x) <= 1
            );
            if (targets.length === 0) {
                addLog("  範囲内に敵がいない");
                showMessage("SYSTEM", `${spell.name}が着弾したが対象がいない！`);
            } else {
                for (const t of targets) {
                    const dmg = rollDice(`1d12+${mbForArea}`);
                    t.hp = Math.max(0, t.hp - dmg);
                    addLog(`  ${t.name}に ${dmg} ダメージ`);
                    if (t.hp <= 0) addLog(`  ${t.name}は倒れた！`);
                }
                showMessage("SYSTEM", `${caster.name}の${spell.name}！${targets.length}体を攻撃！`);
            }
            break;
        }
        case "gravityField": {
            const dur = rollDice(spell.durationFormula || "1d6");
            // 全ユニットにgravityField状態を付与
            for (const u of battleUnits) {
                if (u.id !== caster.id && u.hp > 0) {
                    u.statusEffects = u.statusEffects || [];
                    u.statusEffects.push({ type: "gravityField", value: spell.effectValue || 1, duration: dur });
                }
            }
            addLog(`  重力場展開！${dur}ターン間、全ユニットに毎ターン固定1ダメージ`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！フィールドが重力場になった（${dur}T）！`);
            break;
        }
        case "support": {
            target.statusEffects = target.statusEffects || [];
            target.statusEffects.push({ type: "support", value: 1, duration: 3 });
            addLog(`  ${target.name}の判定値+1（3ターン）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}の判定値+1！`);
            break;
        }
        case "summon":
        case "teleport":
        case "transform":
        case "flight":
        case "clone":
        case "transfer":
            addLog(`  ${spell.name}：${spell.description}`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}成功！（${spell.description}）`);
            break;

        default:
            addLog(`  効果：${spell.description || spell.effectType}`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}成功！`);
    }

    renderUnits();
    endUnitTurn(caster);
    checkVictoryCondition();
}

// =============================================
// 特技
// =============================================
function renderSkillCommands(unit) {
    hideRadialMenu();
    commandHeader.textContent = "特技";
    commandInfo.textContent   = "";
    commandList.innerHTML     = "";

    const utilityEntries = Object.entries(unit.skills || {})
        .filter(([name]) => BATTLE_UTILITY_SKILLS.has(name));

    if (utilityEntries.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:0.5em 0.9em; color:var(--text-dim); font-size:12px;";
        empty.textContent = "使える特技がない";
        commandList.appendChild(empty);
    }

    for (const [skillName, val] of utilityEntries) {
        const btn = document.createElement("button");
        btn.className   = "commandItem";
        btn.textContent = `${skillName}（${val}）`;
        btn.addEventListener("click", () => executeSkill(unit, skillName, val, skillName));
        commandList.appendChild(btn);
    }

    const backBtn = document.createElement("button");
    backBtn.className   = "commandItem";
    backBtn.textContent = "戻る";
    backBtn.addEventListener("click", () => {
        actionState = null;
        clearHighlights();
        renderBattleCommands(unit);
    });
    commandList.appendChild(backBtn);
}

function executeSkill(unit, skillId, successVal, displayName) {
    const roll    = Math.floor(Math.random() * 10) + 1;
    const success = roll <= successVal;
    addLog(`・${unit.name}が ${displayName} 使用（${roll} vs ${successVal}）`);

    if (!success) {
        addLog("  失敗！");
        showMessage("SYSTEM", `${unit.name}の${displayName}は失敗した！`);
    } else {
        addLog("  成功！");
        if (skillId === "応急手当" || skillId === "医学") {
            const heal = Math.floor(Math.random() * 3) + 1;
            unit.hp = Math.min(unit.maxHp, unit.hp + heal);
            addLog(`  ${skillId}：HP+${heal}（${unit.hp}/${unit.maxHp}）`);
            showMessage("SYSTEM", `${unit.name}が${skillId}！HP+${heal}`);
            renderUnits();
        } else if (skillId === "戦闘指揮") {
            addLog("  戦闘指揮成功！味方全員の命中+1（このターン）");
            showMessage(unit.name, "戦闘指揮成功！味方の命中+1");
        } else {
            showMessage(unit.name, `${displayName}成功！`);
        }
    }
    endUnitTurn(unit);
}

// =============================================
// ターン管理
// =============================================
function endUnitTurn(unit) {
    unit.moved = true;
    unit.acted = true;

    const el = document.getElementById(`unit_${unit.id}`);
    if (el) {
        el.classList.add("unitDone");
        el.classList.remove("unitSelected");
    }
    selectedUnit        = null;
    actionState         = null;
    selectedSpell       = null;
    selectedAttackSkill = null;
    clearHighlights();
    renderUnits();

    if (turnPhase !== "ally") return;

    const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
    const allDone     = aliveAllies.every(u => u.moved && u.acted);

    if (allDone) {
        setTimeout(startEnemyPhase, 700);
    } else {
        renderAllyPhasePanel();
        showMessage("SYSTEM", "次のユニットを選択してください。");
    }
}

function startAllyPhase() {
    turnPhase  = "ally";
    battleOver = false;
    turnCount++;
    addLog(`\n── ターン ${turnCount} 開始 ──`);
    addLog("　味方フェーズ");
    showMessage("SYSTEM", `ターン ${turnCount}：味方フェーズ`);
    showPhaseBanner("味方フェーズ");
    updatePhaseHeader();

    for (const u of battleUnits) {
        if (u.side === "ally" && u.hp > 0) {
            u.moved = false;
            u.acted = false;
        }
    }
    tickStatusEffects("ally");
    renderUnits();
    renderAllyPhasePanel();
}

function startEnemyPhase() {
    if (battleOver) return;
    hideRadialMenu();
    turnPhase = "enemy";
    addLog("　敵フェーズ");
    showMessage("SYSTEM", "敵フェーズ");
    showPhaseBanner("敵フェーズ");
    updatePhaseHeader();

    for (const u of battleUnits) {
        if (u.side === "enemy" && u.hp > 0) {
            u.moved = false;
            u.acted = false;
        }
    }
    tickStatusEffects("enemy");

    const enemies = battleUnits.filter(u => u.side === "enemy" && u.hp > 0);
    let delay = 600;
    for (const enemy of enemies) {
        setTimeout(() => {
            if (!battleOver) enemyAction(enemy);
        }, delay);
        delay += 1000;
    }
    setTimeout(() => {
        if (!battleOver) startAllyPhase();
    }, delay + 300);
}

function tickStatusEffects(side) {
    for (const u of battleUnits) {
        if (u.side !== side || u.hp <= 0 || !u.statusEffects) continue;
        const nextEffects = [];
        for (const e of u.statusEffects) {
            if (e.type === "burn") {
                const dmg = rollDice("1d3");
                u.hp = Math.max(0, u.hp - dmg);
                addLog(`  ${u.name}は火傷で ${dmg} ダメージ（HP ${u.hp}/${u.maxHp}）`);
            } else if (e.type === "gravityField") {
                u.hp = Math.max(0, u.hp - (e.value || 1));
                addLog(`  ${u.name}は重力場で ${e.value || 1} ダメージ`);
            } else if (e.type === "stun") {
                const conRate  = (u.con || 10) * 3;
                const conCheck = Math.floor(Math.random() * 100) + 1;
                if (conCheck <= conRate) {
                    addLog(`  ${u.name}はスタンから回復（CON×3%:${conRate}%）`);
                    continue;
                }
            }
            e.duration--;
            if (e.duration <= 0) {
                addLog(`  ${u.name}の【${e.type}】効果が切れた`);
            } else {
                nextEffects.push(e);
            }
        }
        u.statusEffects = nextEffects;
        if (u.hp <= 0) addLog(`  ${u.name}は倒れた！`);
    }
    renderUnits();
}

// =============================================
// 敵AI
// =============================================
function enemyAction(enemy) {
    if (enemy.hp <= 0) return;

    // スタン中は行動不可
    if ((enemy.statusEffects || []).some(e => e.type === "stun")) {
        addLog(`・${enemy.name}はスタン中のため行動できない`);
        enemy.moved = true;
        enemy.acted = true;
        return;
    }

    const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
    if (aliveAllies.length === 0) return;

    // 最近接の味方を探す
    const target = aliveAllies.reduce((best, u) => {
        const d  = Math.abs(u.x - enemy.x) + Math.abs(u.y - enemy.y);
        const bd = Math.abs(best.x - enemy.x) + Math.abs(best.y - enemy.y);
        return d < bd ? u : best;
    });

    // 攻撃射程外なら移動
    const distNow = Math.abs(target.x - enemy.x) + Math.abs(target.y - enemy.y);
    if (distNow > enemy.attackRange) {
        const moveRange = getMoveRange(enemy);
        if (moveRange.length > 0) {
            const best = moveRange.reduce((b, c) => {
                const d  = Math.abs(c.col - target.x) + Math.abs(c.row - target.y);
                const bd = Math.abs(b.col - target.x) + Math.abs(b.row - target.y);
                return d < bd ? c : b;
            });
            // 現在より近づく場合のみ移動
            if (Math.abs(best.col - target.x) + Math.abs(best.row - target.y) < distNow) {
                enemy.x = best.col;
                enemy.y = best.row;
                enemy.moved = true;
                addLog(`・${enemy.name}が移動した`);
                renderUnits();
            }
        }
    }

    // 攻撃射程内なら攻撃
    const distAfter = Math.abs(target.x - enemy.x) + Math.abs(target.y - enemy.y);
    if (distAfter <= enemy.attackRange) {
        const { val: atkStat, name: atkSkillName } = getAttackSkillVal(enemy);
        const targetStunned = (target.statusEffects || []).some(e => e.type === "stun");
        const evadeStat = targetStunned ? 0 : getEvadeSkillVal(target);
        const rate      = targetStunned ? 100 : getOpposedRate(atkStat, evadeStat);
        const roll      = Math.floor(Math.random() * 100) + 1;
        const isHit     = roll <= rate;
        const rollNote  = targetStunned ? "スタン中：自動命中" : `${roll}/${rate}%`;
        addLog(`・${enemy.name} → ${target.name} 【${atkSkillName}${atkStat} vs 回避${evadeStat}】 ${rollNote} → ${isHit ? "命中" : "失敗"}`);

        if (isHit) {
            resolvePhysicalHit(enemy, target, atkSkillName);
            checkVictoryCondition();
        }
    }
    enemy.moved = true;
    enemy.acted = true;
}

// =============================================
// 勝敗判定
// =============================================
function checkVictoryCondition() {
    const aliveEnemies = battleUnits.filter(u => u.side === "enemy" && u.hp > 0);
    const aliveAllies  = battleUnits.filter(u => u.side === "ally"  && u.hp > 0);

    if (aliveEnemies.length === 0) {
        battleOver = true;
        addLog("\n=== 勝利！ ===");
        showMessage("SYSTEM", "全ての敵を倒した！勝利！");
        commandHeader.textContent = "VICTORY";
        commandInfo.textContent   = "";
        commandList.innerHTML     = "";
        showPhaseBanner("勝利！");
        // シナリオ経由のバトルなら2秒後にシナリオへ戻る
        if (fromScenario) setTimeout(resumeScenarioAfterBattle, 2000);
        return;
    }
    if (aliveAllies.length === 0) {
        battleOver = true;
        addLog("\n=== 敗北... ===");
        showMessage("SYSTEM", "全員が倒れた…敗北。");
        commandHeader.textContent = "GAME OVER";
        commandInfo.textContent   = "";
        commandList.innerHTML     = "";
        showPhaseBanner("GAME OVER");
    }
}

// =============================================
// コマンドパネル
// =============================================
function renderAllyPhasePanel() {
    commandHeader.textContent = "味方フェーズ";
    commandInfo.textContent   = `ターン ${turnCount}`;
    commandList.innerHTML     = "";

    for (const unit of battleUnits.filter(u => u.side === "ally" && u.hp > 0)) {
        const done = unit.moved && unit.acted;
        const btn  = document.createElement("button");
        btn.className   = `commandItem${done ? " commandDone" : ""}`;
        btn.textContent = `${unit.name}${done ? "（済）" : ""}`;
        btn.addEventListener("click", () => {
            if (!done) selectUnit(unit);
        });
        commandList.appendChild(btn);
    }
}

function renderBattleCommands(unit) {
    commandHeader.textContent = unit.name;
    commandInfo.textContent   = `Lv ${unit.level}`;
    commandList.innerHTML     = "";

    // ユニット情報カード
    const hpPct   = unit.hp / unit.maxHp;
    const mpPct   = unit.mp / unit.maxMp;
    const hpClass = hpPct <= 0.25 ? "critical" : hpPct <= 0.5 ? "low" : "";

    const atkLabel = (() => {
        for (const n of ATTACK_SKILL_PRIORITY) {
            if (n in (unit.skills || {})) return `${n} ${unit.skills[n]}`;
        }
        return "―";
    })();
    const magLabel = (() => {
        const entries = Object.entries(unit.spells || {}).filter(([id]) => SPELLS_DATA[id]);
        if (!entries.length) return "―";
        const best = entries.reduce((a, b) => b[1] > a[1] ? b : a);
        return `${SPELLS_DATA[best[0]].name} ${best[1]}`;
    })();

    const bgSize = unit.portraitBgSize || "280%";
    const bgPos  = unit.portraitBgPos  || "top center";
    const imgTag = unit.portraitImage
        ? `<div class="portrait-wrapper" style="background-image:url('${unit.portraitImage}');background-size:${bgSize};background-position:${bgPos}"></div>`
        : unit.tokenImage
            ? `<img class="unit-icon" src="${unit.tokenImage}" alt="${unit.name}">`
            : "";

    const card = document.createElement("div");
    card.id = "unitInfoCard";
    card.innerHTML = `
        ${imgTag}
        <div id="unitInfoStats">
            <div class="unitInfoRow">
                <span class="unitInfoLabel">HP</span>
                <div class="unitInfoBarWrap"><div class="unitInfoBarFill hp ${hpClass}" style="width:${hpPct*100}%"></div></div>
                <span class="unitInfoValue">${unit.hp}/${unit.maxHp}</span>
            </div>
            <div class="unitInfoRow">
                <span class="unitInfoLabel">MP</span>
                <div class="unitInfoBarWrap"><div class="unitInfoBarFill mp" style="width:${mpPct*100}%"></div></div>
                <span class="unitInfoValue">${unit.mp}/${unit.maxMp}</span>
            </div>
            <div class="unitInfoDivider"></div>
            <div class="unitInfoSubRow">
                <div class="unitInfoSubItem">
                    <span class="unitInfoSubLabel">物</span>
                    <span class="unitInfoSubValue">${atkLabel} / ${unit.physicalBonus}</span>
                </div>
                <div class="unitInfoSubItem">
                    <span class="unitInfoSubLabel">魔</span>
                    <span class="unitInfoSubValue">${magLabel} / ${unit.magicBonus}</span>
                </div>
            </div>
        </div>
    `;
    commandList.appendChild(card);

    showRadialMenu(unit);
}

function renderIdlePanel() {
    commandHeader.textContent = "command";
    commandInfo.textContent   = "";
    commandList.innerHTML     = "";
}

function handleBattleCommand(unit, label) {
    switch (label) {
        case "移動":
            if (unit.moved) { showMessage("SYSTEM", "すでに移動済みです。"); return; }
            actionState = "moving";
            hideRadialMenu();
            highlightMoveRange(unit);
            showMessage("SYSTEM", `${unit.name}の移動先を選択してください。`);
            addLog(`・${unit.name}は移動を選択`);
            break;
        case "攻撃":
            showAttackRadial(unit);
            addLog(`・${unit.name}は攻撃を選択`);
            break;
        case "魔法":
            showMagicRadial(unit);
            addLog(`・${unit.name}は魔法を選択`);
            break;
        case "特技":
            actionState = null;
            clearHighlights();
            renderSkillCommands(unit);
            addLog(`・${unit.name}は特技を選択`);
            break;
        case "ステータス":
            clearHighlights();
            openStatusModal(unit.id);
            break;
        case "待機":
            hideRadialMenu();
            clearHighlights();
            showMessage("SYSTEM", `${unit.name}は待機した。`);
            addLog(`・${unit.name}は待機`);
            endUnitTurn(unit);
            break;
        case "戻る":
            deselectUnit();
            break;
    }
}

// =============================================
// ステータスモーダル（CHARACTERS_DATA 対応）
// =============================================
function openStatusModal(unitId) {
    statusTargetId = unitId;
    currentStatusTab = "basic";
    statusModalOverlay.classList.remove("hidden");
    renderStatusTab(currentStatusTab);
}

function closeStatus() {
    statusModalOverlay.classList.add("hidden");
}

function renderStatusTab(tabName) {
    currentStatusTab = tabName;
    // バトル中は live データ、それ以外は CHARACTERS_DATA から取得
    const unit = battleUnits.length > 0
        ? (battleUnits.find(u => u.id === statusTargetId) || CHARACTERS_DATA.find(c => c.id === statusTargetId))
        : CHARACTERS_DATA.find(c => c.id === statusTargetId);
    if (!unit) return;

    statusTabs.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    statusModalTitle.textContent = `${unit.name} ― ステータス`;

    if (tabName === "basic") {
        statusModalBody.innerHTML = `
        <div class="statusSection">
          <h3>基本情報</h3>
          <div class="statusGrid">
            <div>Name：${unit.name}</div>
            <div>種族：${unit.race || "―"}</div>
            <div>一族：${unit.clan || "―"}</div>
            <div>所属：${unit.side === "ally" ? "味方" : "敵"}</div>
            <div>Lv：${unit.level}</div>
            <div>HP：${unit.hp}/${unit.maxHp}</div>
            <div>MP：${unit.mp}/${unit.maxMp}</div>
          </div>
        </div>
        <div class="statusSection">
          <h3>能力値</h3>
          <div class="statusGrid">
            <div>STR：${unit.str}</div>
            <div>CON：${unit.con}</div>
            <div>DEX：${unit.dex}</div>
            <div>POW：${unit.pow}</div>
            <div>INT：${unit.int}</div>
            <div>EDU：${unit.edu}</div>
            <div>SIZ：${unit.siz}</div>
          </div>
        </div>
        <div class="statusSection">
          <h3>戦闘基本</h3>
          <div class="statusGrid">
            <div>移動：${unit.move}マス</div>
            <div>射程：${unit.attackRange}マス</div>
            <div>DB：${unit.physicalBonus}</div>
            <div>MB：${unit.magicBonus}</div>
            <div>勇気：${unit.courage}%</div>
          </div>
        </div>`;
        return;
    }
    if (tabName === "battle") {
        const skillLines = Object.entries(unit.skills || {})
            .map(([name, v]) => `<div>${name}：${v}</div>`).join("");
        statusModalBody.innerHTML = `
        <div class="statusSection">
          <h3>特技（戦闘）</h3>
          <div class="statusGrid">${skillLines || "なし"}</div>
        </div>`;
        return;
    }
    if (tabName === "magic") {
        const spellLines = Object.entries(unit.spells || {}).map(([name, v]) => {
            const sp = SPELLS_DATA[name];
            return `<div>${name}：${v}　射程${typeof sp?.range === "number" ? sp.range : "―"}</div>`;
        }).join("");
        statusModalBody.innerHTML = `
        <div class="statusSection">
          <h3>魔法</h3>
          <div class="statusGrid">${spellLines || "なし"}</div>
        </div>`;
        return;
    }
    if (tabName === "special") {
        statusModalBody.innerHTML = `
        <div class="statusSection">
          <h3>その他</h3>
          <div class="statusGrid">
            <div>発作タイプ：${unit.seizureType || "―"}</div>
            <div>秘伝：${unit.secretArt || "―"}</div>
          </div>
        </div>`;
    }
}

// =============================================
// フェーズバナー & ヘッダー更新
// =============================================
function showPhaseBanner(text) {
    let banner = document.getElementById("phaseBanner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "phaseBanner";
        document.getElementById("gameScreen").appendChild(banner);
    }
    banner.textContent = text;
    banner.classList.remove("hidden");
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => banner.classList.add("hidden"), 1400);
}

function updatePhaseHeader() {
    if (!phaseLabel) return;
    if (turnPhase === "ally") {
        phaseLabel.textContent = "味方フェーズ";
        phaseLabel.style.color = "var(--teal)";
    } else {
        phaseLabel.textContent = "敵フェーズ";
        phaseLabel.style.color = "#ff8888";
    }
    if (turnLabel) turnLabel.textContent = `TURN ${turnCount}`;
}

// =============================================
// メッセージ / ログ
// =============================================
function showMessage(speaker, text) {
    nameText.textContent    = speaker;
    messageText.innerHTML   = text;
}

function addLog(text) {
    const p = document.createElement("p");
    p.textContent = text;
    logTextList.appendChild(p);
    logPanel.scrollTop = logPanel.scrollHeight;
}

function clearLog() {
    logTextList.innerHTML = "";
}

// =============================================
// モード切替
// =============================================
function switchTopLayer(layer) {
    topTabs.forEach(t => t.classList.toggle("active", t.dataset.layer === layer));
    topLayerDialogue.classList.toggle("hidden", layer !== "dialogue");
    topLayerBattle.classList.toggle("hidden", layer !== "battle");
}

// =============================================
// シナリオシステム
// =============================================
/** シナリオ用レイアウトに切り替え */
function enterScenarioLayout() {
    switchTopLayer("dialogue");
    battleGrid.style.display  = "none";   // グリッド線を非表示
    unitLayer.style.display   = "none";   // ユニットトークンを非表示
}

/** バトル用レイアウトに戻す */
function exitScenarioLayout() {
    battleGrid.style.display  = "";
    unitLayer.style.display   = "";
}

/**
 * シナリオキャラ立ち絵レイヤーを再描画する
 * @param {string} speaker - 現在の話者名（アクティブハイライト用）
 */
function updateScenarioCharLayer(speaker) {
    scenarioCharLayer.innerHTML = "";
    scenarioCharacters.forEach(entry => {
        // entry は文字列 or { name, image }
        const name  = (typeof entry === "string") ? entry : entry.name;
        const image = (typeof entry === "object" && entry.image)
            ? entry.image
            : (CHARACTERS_DATA.find(c => c.name === name)?.portraitImage ?? "");

        const charData = CHARACTERS_DATA.find(c => c.name === name);

        const wrapper = document.createElement("div");
        wrapper.className = "scenarioChar" + (name === speaker ? " active" : "");

        const portrait = document.createElement("div");
        portrait.className = "scenarioCharPortrait";
        if (image) {
            portrait.style.backgroundImage = `url('${image}')`;
        }
        // キャラ個別のシナリオ立ち絵トリミング設定（未指定ならCSSデフォルト）
        if (charData?.scenarioBgSize) portrait.style.backgroundSize     = charData.scenarioBgSize;
        if (charData?.scenarioBgPos)  portrait.style.backgroundPosition = charData.scenarioBgPos;

        wrapper.appendChild(portrait);
        scenarioCharLayer.appendChild(wrapper);
    });
}

function startChapter(chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch) { console.warn("Chapter not found:", chapterId); return; }
    currentChapter  = ch;
    currentSceneIdx = 0;
    scenarioActive  = true;
    gameMode        = "scenario";

    clearHighlights();
    hideRadialMenu();
    scenarioCharacters = [];
    scenarioCharLayer.innerHTML = "";
    enterScenarioLayout();

    renderScenarioCommands();
    playCurrentScene();
}

function playCurrentScene() {
    if (!scenarioActive || !currentChapter) return;
    if (currentSceneIdx >= currentChapter.scenes.length) {
        endChapter();
        return;
    }
    const scene = currentChapter.scenes[currentSceneIdx];
    switch (scene.type) {
        case "dialogue": playDialogueScene(scene); break;
        case "battle":   playBattleScene(scene);   break;
        default:         advanceScene();            break;
    }
}

function playDialogueScene(scene) {
    // setCharacters が指定された場合のみキャラ行を更新
    if (scene.setCharacters !== undefined) {
        scenarioCharacters = scene.setCharacters.slice();
    }
    updateScenarioCharLayer(scene.speaker);
    showMessage(scene.speaker, scene.text);
    dialogueBox.dataset.scenario = "active";
}

function advanceScene() {
    currentSceneIdx++;
    playCurrentScene();
}

function playBattleScene(/* scene */) {
    scenarioActive               = false;
    fromScenario                 = true;
    dialogueBox.dataset.scenario = "";
    exitScenarioLayout();
    setBattleMode();
}

function resumeScenarioAfterBattle() {
    if (!fromScenario) return;
    fromScenario   = false;
    scenarioActive = true;
    gameMode       = "scenario";

    clearHighlights();
    enterScenarioLayout();
    renderScenarioCommands();
    advanceScene();
}

function endChapter() {
    const title = currentChapter?.title ?? "章";
    scenarioActive               = false;
    fromScenario                 = false;
    currentChapter               = null;
    currentSceneIdx              = 0;
    dialogueBox.dataset.scenario = "";

    exitScenarioLayout();
    addLog(`── ${title} 終了 ──`);
    showMessage("SYSTEM", `${title} クリア！`);
}

// =============================================

function setScenarioMode() {
    gameMode = "scenario";
    clearHighlights();
    hideRadialMenu();
    switchTopLayer("dialogue");

    unitLayer.style.display      = "none";
    battleBoard.style.opacity    = "0";
    battleBoard.style.pointerEvents = "none";

    showMessage("リングホルム", "……この森、静かすぎる。<br>気を抜くな。");
    clearLog();
    addLog("・リングホルムのターン");
    addLog("・敵影を発見した");
    addLog("・森の中は静まり返っている");

    renderScenarioCommands();
}

function setBattleMode() {
    exitScenarioLayout();   // シナリオレイアウトが残っていたらリセット
    switchTopLayer("battle");
    gameMode   = "battle";
    battleOver = false;
    turnCount  = 1;
    turnPhase  = "ally";
    selectedUnit        = null;
    actionState         = null;
    selectedSpell       = null;
    selectedAttackSkill = null;

    // CHARACTERS_DATA をディープコピーして live データとして使用
    battleUnits = CHARACTERS_DATA.map(c => ({
        ...c,
        hp: c.maxHp,
        mp: c.maxMp,
        moved: false,
        acted: false,
        statusEffects: [],
        spells: { ...c.spells },
        skills: { ...c.skills },
    }));

    unitLayer.style.display         = "block";
    battleBoard.style.opacity       = "1";
    battleBoard.style.pointerEvents = "auto";

    clearLog();
    addLog("── バトル開始 ──");
    addLog("　ターン 1 ─ 味方フェーズ");
    showMessage("SYSTEM", "バトル開始！ユニットを選択してください。");
    showPhaseBanner("味方フェーズ");
    updatePhaseHeader();

    renderUnits();
    renderAllyPhasePanel();
}

// =============================================
// シナリオコマンド
// =============================================
function renderScenarioCommands() {
    commandHeader.textContent = "command";
    commandInfo.textContent   = "";
    commandList.innerHTML     = "";

    for (const label of ["セーブ", "ロード", "アイテム", "ステータス", "設定"]) {
        const btn = document.createElement("button");
        btn.className   = "commandItem";
        btn.textContent = label;
        btn.addEventListener("click", () => handleScenarioCommand(label));
        commandList.appendChild(btn);
    }
}

function handleScenarioCommand(label) {
    if (label === "ステータス") {
        // シナリオ中はリングホルムのステータスを表示
        const first = CHARACTERS_DATA.find(c => c.side === "ally");
        if (first) openStatusModal(first.id);
        return;
    }
    showMessage("システム", `${label}を開きます。`);
    addLog(`・「${label}」を選択しました`);
}

// =============================================
// フルスクリーン
// =============================================
async function toggleFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (e) {
        console.error("フルスクリーン切替に失敗:", e);
    }
}

// =============================================
// イベントリスナー
// =============================================
scenarioModeButton.addEventListener("click", () => startChapter("ch1"));
dialogueBox.addEventListener("click", () => { if (scenarioActive) advanceScene(); });
battleModeButton.addEventListener("click",   setBattleMode);
fullscreenButton.addEventListener("click",   toggleFullscreen);

topTabs.forEach(tab => {
    tab.addEventListener("click", () => switchTopLayer(tab.dataset.layer));
});

closeStatusModal.addEventListener("click", closeStatus);
statusModalOverlay.addEventListener("click", e => {
    if (e.target === statusModalOverlay) closeStatus();
});

statusTabs.forEach(tab => {
    tab.addEventListener("click", () => renderStatusTab(tab.dataset.tab));
});

// =============================================
// スケール調整（デザインサイズ390×844を画面にフィット）
// =============================================
function scaleGame() {
    const s = Math.min(window.innerWidth / 390, window.innerHeight / 844);
    document.getElementById("gameScreen").style.transform = `scale(${s})`;
}
window.addEventListener("resize", scaleGame);

// =============================================
// 初期化
// =============================================
createGrid();
setBattleMode();
renderIdlePanel();
scaleGame();

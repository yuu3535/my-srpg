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
const battleCanvas       = document.getElementById("battleCanvas");
const commandHeader      = document.getElementById("commandHeader");
const commandInfo        = document.getElementById("commandInfo");
const commandList        = document.getElementById("commandList");
const scenarioModeButton = document.getElementById("scenarioModeButton");
const battleModeButton   = document.getElementById("battleModeButton");
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
const topLayerForecast   = document.getElementById("topLayerForecast");
const forecastContent    = document.getElementById("forecastContent");
const topPanelBg         = document.getElementById("topPanelBg");
const homeScreen         = document.getElementById("homeScreen");
const homeStartBtn       = document.getElementById("homeStartBtn");
const homeContinueBtn    = document.getElementById("homeContinueBtn");
const homeSettingsBtn    = document.getElementById("homeSettingsBtn");
const homeMenuCursor     = document.getElementById("homeMenuCursor");
const dialogueBox        = document.getElementById("dialogueBox");
const topPanel           = document.getElementById("topPanel");
const bgImage            = document.getElementById("bgImage");
const topLayerVS         = document.getElementById("topLayerVS");
const vsConfirmBtn       = document.getElementById("vsConfirmBtn");
const vsCancelBtn        = document.getElementById("vsCancelBtn");

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
let _vsAttack = null; // VS確認待ち { attacker, target, isMagic, spell }

// =============================================
// DB / MB テーブル計算
// =============================================
/**
 * STR+SIZ（DB）または POW+INT（MB）の合計値から
 * ボーナスダイス式を返す（ルルブ対抗表準拠）
 */
function calcBonusDice(sum) {
    if (sum <=  12) return "-1d6";
    if (sum <=  16) return "-1d4";
    if (sum <=  24) return "0";
    if (sum <=  32) return "1d4";
    if (sum <=  40) return "1d6";
    if (sum <=  56) return "2d6";
    if (sum <=  72) return "3d6";
    if (sum <=  88) return "4d6";
    if (sum <= 102) return "5d6";
    if (sum <= 115) return "6d6";
    if (sum <= 128) return "7d6";
    if (sum <= 142) return "8d6";
    if (sum <= 156) return "9d6";
    if (sum <= 170) return "10d6";
    if (sum <= 184) return "11d6";
    if (sum <= 198) return "12d6";
    if (sum <= 212) return "13d6";
    return "14d6";
}

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
    // ダメージポップアップはアニメーション中なので退避して再追加する
    const livePopups = [...unitLayer.querySelectorAll(".dmgPopup")];
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

        // HP 情報エリア（数値 + バー）
        const hpPct  = unit.hp / unit.maxHp;
        const hpState = hpPct <= 0.25 ? "critical" : hpPct <= 0.5 ? "low" : "";

        const hpInfo = document.createElement("div");
        hpInfo.className = "unitHpInfo";

        const hpText = document.createElement("span");
        hpText.className = `unitHpText${hpState ? " " + hpState : ""}`;
        hpText.textContent = unit.hp;

        const hpBar  = document.createElement("div");
        hpBar.className = "unitHpBar";
        const hpFill = document.createElement("div");
        hpFill.className = `unitHpFill${hpState ? " " + hpState : ""}`;
        hpFill.style.width = `${hpPct * 100}%`;
        hpBar.appendChild(hpFill);

        hpInfo.appendChild(hpText);
        hpInfo.appendChild(hpBar);
        el.appendChild(hpInfo);

        // 位置（x=col, y=row）: トークンが12%×13%なのでマス中央に合わせてオフセット
        el.style.left = `${unit.x * 10 - 1}%`;
        el.style.top  = `${unit.y * 10 - 1.5}%`;

        // 自分のフェーズ中のみ行動済み表示（他フェーズでは暗くしない）
        if (unit.moved && unit.acted && unit.side === turnPhase) el.classList.add("unitDone");

        // 5回タップでポートレート調整ツール
        let _tapCount = 0, _tapTimer = null;
        el.addEventListener("click", (e) => {
            e.stopPropagation();
            _tapCount++;
            clearTimeout(_tapTimer);
            if (_tapCount >= 5) {
                _tapCount = 0;
                showUnitPortraitAdjuster(unit);
                return;
            }
            _tapTimer = setTimeout(() => { _tapCount = 0; }, 800);
            onUnitClick(unit);
        });

        unitLayer.appendChild(el);
    }

    // 退避したポップアップを最前面に再追加
    livePopups.forEach(p => unitLayer.appendChild(p));
}

// =============================================
// クリックハンドラ
// =============================================
function onUnitClick(unit) {
    if (_mapDragged) { _mapDragged = false; return; }
    if (gameMode !== "battle" || battleOver) return;

    // ── 攻撃対象選択中 ──
    if (actionState === "attacking" && selectedUnit) {
        if (unit.side !== selectedUnit.side && unit.hp > 0) {
            const dist = Math.abs(selectedUnit.x - unit.x) + Math.abs(selectedUnit.y - unit.y);
            if (dist <= selectedUnit.attackRange) {
                // 攻撃スキル名を確定
                const atkSkillName = selectedAttackSkill && selectedAttackSkill in (selectedUnit.skills || {})
                    ? selectedAttackSkill
                    : getAttackSkillVal(selectedUnit).name;
                // VS 予測パネルを出して確認待ちにする（即攻撃しない）
                const pred = calculateBattlePrediction(selectedUnit, unit, atkSkillName, false, null);
                _vsAttack = { attacker: selectedUnit, target: unit, isMagic: false, spell: null };
                showBattlePreview(selectedUnit, unit, pred, atkSkillName);
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
        const spell  = selectedSpell;
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

        // 敵対象の攻撃/デバフ系 → VS プレビューを挟む
        if (spell.targetType === "enemy") {
            const pred = calculateBattlePrediction(caster, unit, null, true, spell);
            _vsAttack  = { attacker: caster, target: unit, isMagic: true, spell };
            showBattlePreview(caster, unit, pred, spell.name);
        } else {
            // 味方対象（治癒・結界など）はそのまま実行
            executeMagic(caster, spell, unit);
        }
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
        renderEnemyInfoPanel(unit);
    }
}

function onCellClick(row, col) {
    if (_mapDragged) { _mapDragged = false; return; }
    if (gameMode !== "battle" || battleOver) return;

    // 転移先マス選択
    if (actionState === "magic" && selectedUnit && selectedSpell?.effectType === "teleport") {
        const cell = getCell(row, col);
        if (!cell || !cell.classList.contains("highlightMove")) return;
        clearHighlights();
        executeTeleport(selectedUnit, row, col);
        return;
    }

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
    // キャンバス上のユニット中心座標（ズーム・パン反映）
    const rawX = GRID_INSET + (unit.x + 0.5) * CELL_PX;
    const rawY = GRID_INSET + (unit.y + 0.5) * CELL_PX;
    radialMenu.innerHTML = "";
    radialMenu.classList.remove("hidden");
    radialMenu.style.left = `${rawX * mapZoom + mapPanX}px`;
    radialMenu.style.top  = `${TOP_H + rawY * mapZoom + mapPanY}px`;
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
    // 攻撃スキルが1つもない場合は「素手」で代替
    if (atkSkills.length === 0) atkSkills.push({ label: "素手", val: 4 });
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
        if (item.isBack) { hideForecastLayer(); renderBattleCommands(unit); return; }
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
            switchTopLayer("battle");
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
            switchTopLayer("battle");
            showMessage("SYSTEM", `${unit.name}の攻撃対象を選択（${item.label}）`);
        }
        addLog(`・${unit.name}は${item.label}で攻撃を選択`);
    });
}


/** 特技選択ラジアル（2段目） */
function showSkillRadial(unit) {
    initRadialAtUnit(unit);

    const utilityEntries = Object.entries(unit.skills || {})
        .filter(([name]) => BATTLE_UTILITY_SKILLS.has(name));

    const items = [
        ...utilityEntries.map(([name, val]) => ({
            label: name,
            html: `${name}<span class="radialBtnSub">${val}</span>`,
            skillName: name,
            val,
            isBack: false,
        })),
        { label: "戻る", html: `戻る<span class="radialBtnSub">BACK</span>`, isBack: true },
    ];

    const radius = Math.max(50, items.length * 10);
    buildRadialButtons(items, radius, (item) => {
        if (item.isBack) { renderBattleCommands(unit); return; }
        hideRadialMenu();
        executeSkill(unit, item.skillName, item.val, item.skillName);
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
        if (item.isBack) { hideForecastLayer(); renderBattleCommands(unit); return; }

        // range:null の魔法は選択時に即発動（カウンター・浮遊・召喚など）
        if (item.spellData.range === null) {
            hideRadialMenu();
            clearHighlights();
            addLog(`・${unit.name}は ${item.spellData.name} を使用`);
            executeMagic(unit, item.spellData, unit);
            return;
        }

        // 転移：空きマスをタップして瞬間移動
        if (item.spellData.effectType === "teleport") {
            selectedSpell = item.spellData;
            actionState   = "magic";
            hideRadialMenu();
            clearHighlights();
            hideForecastLayer();
            const tRange = item.spellData.range || 5;
            for (let dy = -tRange; dy <= tRange; dy++) {
                for (let dx = -tRange; dx <= tRange; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) > tRange || (dx === 0 && dy === 0)) continue;
                    const nx = unit.x + dx, ny = unit.y + dy;
                    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
                    if (battleUnits.some(u => u.hp > 0 && u.x === nx && u.y === ny)) continue;
                    const cell = getCell(ny, nx);
                    if (cell) cell.classList.add("highlightMove");
                }
            }
            showMessage(unit.name, "転移先のマスを選んでください。");
            addLog(`・${unit.name}は 転移 を詠唱中...`);
            return;
        }

        // 射程がある呪文は対象がいるか確認（自分自身も対象に含む）
        const sp = item.spellData;
        const inRange = battleUnits.filter(u => {
            if (u.hp <= 0) return false;
            const dist = Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y);
            if (dist > sp.range) return false;
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

        selectedSpell = item.spellData;
        actionState   = "magic";
        hideRadialMenu();
        clearHighlights();
        for (let dy = -sp.range; dy <= sp.range; dy++) {
            for (let dx = -sp.range; dx <= sp.range; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > sp.range) continue;
                const cell = getCell(unit.y + dy, unit.x + dx);
                if (cell) cell.classList.add("highlightAttack");
            }
        }
        switchTopLayer("battle");
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
    hideForecastLayer();
    hideBattlePreview();
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
            // 同じ陣営のユニットが止まっているマスには着地不可（通過はOK）
            const landOcc = battleUnits.find(u => u.hp > 0 && u.id !== unit.id && u.x === x && u.y === y);
            if (!landOcc) reachable.push({ col: x, row: y });
        }
        if (remaining <= 0) continue;

        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            // 敵ユニット（相手陣営）は通過不可
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

// =============================================
// 反撃システム（物理 / 魔法 自動選択）
// =============================================
/**
 * 物理・魔法の期待値を比較して最良手で反撃
 * @param {object} originalAttacker - 攻撃してきた相手（反撃のターゲット）
 * @param {object} defender         - 攻撃された側（反撃する側）
 */
function resolveCounterAttack(originalAttacker, defender) {
    const mode = defender.counterMode ?? "auto";

    // none：反撃しない
    if (mode === "none") return;

    // physical_only：常に物理
    if (mode === "physical_only") {
        executePhysicalCounter(defender, originalAttacker);
        return;
    }

    const dist     = Math.abs(defender.x - originalAttacker.x) + Math.abs(defender.y - originalAttacker.y);
    const evadeVal = getEvadeSkillVal(originalAttacker);

    // ── ダメージ系呪文の中で最良のものを探す ──
    const DAMAGE_TYPES = new Set(["magicDamage", "break"]);
    let bestMagic = null, bestMagicExpected = 0;

    for (const [spellId, spellVal] of Object.entries(defender.spells || {})) {
        const spell = SPELLS_DATA[spellId];
        if (!spell || !DAMAGE_TYPES.has(spell.effectType)) continue;
        if (typeof spell.range === "number" && dist > spell.range) continue;
        if (defender.mp <= 0) continue;

        const basePart = (spell.powerFormula || "1d6+MB")
            .replace(/\+?\s*MB/g, "").replace(/MB\s*\+?/g, "").trim() || "1d6";
        const expected = (spellVal * 10 / 100) * (avgDice(basePart) + avgDice(defender.magicBonus));
        if (expected > bestMagicExpected) { bestMagicExpected = expected; bestMagic = { spell, spellVal }; }
    }

    if (mode === "magic_first") {
        // magic_first：魔法が使えるなら必ず魔法、なければ物理
        if (bestMagic) {
            executeMagicCounter(defender, originalAttacker, bestMagic.spell, bestMagic.spellVal);
        } else {
            executePhysicalCounter(defender, originalAttacker);
        }
        return;
    }

    // auto（デフォルト）：期待値で自動選択
    const { val: phyAtk } = getAttackSkillVal(defender);
    const phyExpected = (getOpposedRate(phyAtk, evadeVal) / 100)
                      * ((3.5 + avgDice(defender.physicalBonus)) / 2);

    if (bestMagic && bestMagicExpected > phyExpected) {
        executeMagicCounter(defender, originalAttacker, bestMagic.spell, bestMagic.spellVal);
    } else {
        executePhysicalCounter(defender, originalAttacker);
    }
}

function executePhysicalCounter(counterAttacker, counterTarget) {
    const { val: atkVal, name: atkName } = getAttackSkillVal(counterAttacker);
    const evadeVal = getEvadeSkillVal(counterTarget);
    const hitRate  = getOpposedRate(atkVal, evadeVal);
    const roll     = Math.floor(Math.random() * 100) + 1;
    const isHit    = roll <= hitRate;
    addLog(`  物理反撃！${counterAttacker.name}【${atkName}${atkVal} vs 回避${evadeVal}】 ${roll}/${hitRate}% → ${isHit ? "命中" : "失敗"}`);
    if (!isHit) return;

    let base = Math.floor(Math.random() * 6) + 1;
    const db = rollDice(counterAttacker.physicalBonus);
    if ("武道" in (counterAttacker.skills || {})) {
        const r = Math.floor(Math.random() * 10) + 1;
        if (r <= counterAttacker.skills["武道"]) { base *= 2; addLog(`    武道発動！`); }
    }
    const dmg = Math.max(1, Math.floor((base + db) / 2));
    counterTarget.hp = Math.max(0, counterTarget.hp - dmg);
    showDamagePopup(counterTarget.id, dmg, "counter");
    flashUnitHit(counterTarget.id);
    addLog(`    ${dmg}ダメージ（半分）→ ${counterTarget.name} HP ${counterTarget.hp}/${counterTarget.maxHp}`);
    renderUnits();
    if (counterTarget.hp <= 0) addLog(`    ${counterTarget.name}は倒れた！`);
}

function executeMagicCounter(caster, target, spell, spellVal) {
    const successPct = spellVal * 10;
    const roll    = Math.floor(Math.random() * 100) + 1;
    const success = roll <= successPct;
    const mpCost  = rollDice(spell.mpCost || "1d6");
    caster.mp = Math.max(0, caster.mp - mpCost);
    addLog(`  魔法反撃【${spell.name}】${caster.name}→${target.name} （${roll}/${successPct}%） MP-${mpCost} → ${success ? "成功" : "失敗"}`);
    if (!success) return;

    const mb = rollDice(caster.magicBonus);
    const basePart = (spell.powerFormula || "1d6+MB")
        .replace(/\+?\s*MB/g, "").replace(/MB\s*\+?/g, "").trim() || "1d6";
    let baseDmg = rollDice(basePart);
    if ("魔導" in (caster.skills || {})) {
        const r = Math.floor(Math.random() * 10) + 1;
        if (r <= caster.skills["魔導"]) { baseDmg *= 2; addLog(`    魔導発動！`); }
    }
    let rawDmg = baseDmg + mb;

    // 装甲チェック（破壊なら完全破壊）
    const barrierEff = (target.statusEffects || []).find(e => e.type === "barrier");
    let barrierNote = "";
    if (barrierEff && barrierEff.value > 0) {
        const absorbed = Math.min(barrierEff.value, rawDmg);
        rawDmg -= absorbed;
        if (spell.effectType === "break") {
            target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
            barrierNote = `（装甲${absorbed}→完全破壊！）`;
        } else {
            barrierEff.value -= absorbed;
            if (barrierEff.value <= 0) {
                target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
                barrierNote = `（装甲${absorbed}→砕け散った！）`;
            } else {
                barrierNote = `（装甲${absorbed}吸収 残${barrierEff.value}）`;
            }
        }
    }

    target.hp = Math.max(0, target.hp - rawDmg);
    showDamagePopup(target.id, rawDmg, "counter");
    flashUnitHit(target.id);
    addLog(`    ${rawDmg}ダメージ${barrierNote} → ${target.name} HP ${target.hp}/${target.maxHp}`);
    renderUnits();
    if (target.hp <= 0) addLog(`    ${target.name}は倒れた！`);
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
        showDamagePopup(attacker.id, rawDmg, "damage");
        // 防御側（カウンター持ち）も同じダメージ
        target.hp   = Math.max(0, target.hp - rawDmg);
        showDamagePopup(target.id, rawDmg, "damage");
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

    // 装甲（barrier）チェック：吸収分だけ装甲耐久を削り、0になったら砕ける
    const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
    let actualDmg = rawDmg;
    let barrierNote = "";
    if (barrier && barrier.value > 0) {
        const absorbed = Math.min(barrier.value, rawDmg);
        actualDmg = rawDmg - absorbed;
        barrier.value -= absorbed;
        if (barrier.value <= 0) {
            target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
            barrierNote = `（装甲${absorbed}吸収→砕け散った！）`;
        } else {
            barrierNote = `（装甲${absorbed}吸収 残${barrier.value}）`;
        }
    }

    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - actualDmg);
    showDamagePopup(target.id, actualDmg, "damage");
    flashUnitHit(target.id);
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

    // 反撃チェック：勇気% 成功で物理/魔法の最良手を自動選択して反撃
    if (target.hp > 0) {
        const courageRoll = Math.floor(Math.random() * 100) + 1;
        if (courageRoll <= (target.courage || 50)) {
            showMessage(target.name, "反撃！");
            addLog(`  反撃チャンス！（勇気${target.courage}% ロール${courageRoll}）`);
            resolveCounterAttack(attacker, target);
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
        showDamagePopup(target.id, 0, "miss");
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
        showDamagePopup(target.id, 0, "miss");
        showMessage("SYSTEM", `${attacker.name}の投擲は外れた！`);
        endUnitTurn(attacker);
        return;
    }

    resolvePhysicalHit(attacker, target, "投擲");
    endUnitTurn(attacker);
    checkVictoryCondition();
}

// =============================================
// 転移
// =============================================
function executeTeleport(caster, row, col) {
    const successPct = (caster.spells?.["転移"] ?? 5) * 10;
    const roll   = Math.floor(Math.random() * 100) + 1;
    const success = roll <= successPct;
    const mpCost = rollDice("1d8");
    caster.mp = Math.max(0, caster.mp - mpCost);
    addLog(`・${caster.name}が 転移 使用（${roll}/${successPct}%）  MP-${mpCost}`);

    if (!success) {
        addLog("  失敗！");
        showMessage("SYSTEM", `${caster.name}の転移は失敗した！`);
        endUnitTurn(caster);
        return;
    }

    caster.x     = col;
    caster.y     = row;
    caster.moved = true;
    selectedSpell = null;
    actionState   = null;
    addLog(`  転移成功！(${col}, ${row})へ瞬間移動`);
    showMessage("SYSTEM", `${caster.name}が瞬間移動！`);
    renderUnits();

    // 移動扱い：まだ行動していなければコマンドを再表示
    if (!caster.acted) {
        selectUnit(caster);
    } else {
        endUnitTurn(caster);
    }
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
    const successPct = successVal * 10;                       // 成功値×10 = 成功率%
    const roll       = Math.floor(Math.random() * 100) + 1;  // 1d100
    const success    = roll <= successPct;

    // MPコスト
    const mpCost = rollDice(spell.mpCost || "1d6");
    caster.mp    = Math.max(0, caster.mp - mpCost);
    addLog(`・${caster.name}が ${spell.name} 使用（${roll}/${successPct}%）  MP-${mpCost}`);

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

            // 装甲チェック：吸収分だけ装甲耐久を削り、0になったら砕ける
            const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
            let rawDmg = baseDmg + mb;
            let barrierNote = "";
            if (barrier && barrier.value > 0) {
                const absorbed = Math.min(barrier.value, rawDmg);
                rawDmg -= absorbed;
                barrier.value -= absorbed;
                if (barrier.value <= 0) {
                    target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
                    barrierNote = `（装甲${absorbed}吸収→砕け散った！）`;
                } else {
                    barrierNote = `（装甲${absorbed}吸収 残${barrier.value}）`;
                }
            }

            const hpBefore = target.hp;
            target.hp = Math.max(0, target.hp - rawDmg);
            showDamagePopup(target.id, rawDmg, "damage");
            flashUnitHit(target.id);
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
            showDamagePopup(target.id, healAmt, "heal");
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
            // 破壊魔法：ダメージを与えつつ結界を完全破壊（超過分はHPへ）
            const basePart = (spell.powerFormula || "1d6+MB")
                .replace(/\+?\s*MB/g, "").replace(/MB\s*\+?/g, "").trim() || "1d6";
            let breakBase = rollDice(basePart);
            let breakBoost = "";
            if (magicBoost) {
                breakBoost = `（魔導:${breakBase}→${breakBase * 2}）`;
                breakBase *= 2;
            }
            const breakTotal = breakBase + mb;
            const barrierEff = (target.statusEffects || []).find(e => e.type === "barrier");
            let dmgToHp = breakTotal;
            let breakNote = "";
            if (barrierEff && barrierEff.value > 0) {
                const absorbed = Math.min(barrierEff.value, breakTotal);
                dmgToHp = breakTotal - absorbed;
                target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
                breakNote = `（装甲${absorbed}吸収→完全破壊！残${dmgToHp}ダメ）`;
            } else {
                breakNote = "（結界なし）";
            }
            target.hp = Math.max(0, target.hp - dmgToHp);
            if (dmgToHp > 0) { showDamagePopup(target.id, dmgToHp, "damage"); flashUnitHit(target.id); }
            addLog(`  破壊！${breakTotal}ダメージ${breakBoost}${breakNote} → ${target.name} HP ${target.hp}/${target.maxHp}`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！結界を砕き${dmgToHp}ダメージ！`);
            if (target.hp <= 0) addLog(`  ${target.name}は倒れた！`);
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
            showDamagePopup(target.id, reduction, "counter");   // MP吸収はオレンジ色で表示
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
                    showDamagePopup(t.id, dmg, "damage");
                    flashUnitHit(t.id);
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
    const successPct = successVal * 10;                       // 成功値×10 = 成功率%
    const roll       = Math.floor(Math.random() * 100) + 1;  // 1d100
    const success    = roll <= successPct;
    addLog(`・${unit.name}が ${displayName} 使用（${roll}/${successPct}%）`);

    if (!success) {
        addLog("  失敗！");
        showMessage("SYSTEM", `${unit.name}の${displayName}は失敗した！`);
    } else {
        addLog("  成功！");
        if (skillId === "応急手当" || skillId === "医学") {
            const heal = Math.floor(Math.random() * 3) + 1;
            unit.hp = Math.min(unit.maxHp, unit.hp + heal);
            showDamagePopup(unit.id, heal, "heal");
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
    hideForecastLayer();
    hideBattlePreview();
    renderUnits();

    if (turnPhase !== "ally") return;

    const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
    const allDone     = aliveAllies.every(u => u.moved && u.acted);

    if (allDone) {
        setTimeout(startEnemyPhase, 700);
    } else {
        renderIdlePanel();
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
    renderIdlePanel();
}

// =============================================
// 戦闘予測（バトルフォーキャスト）
// =============================================

// =============================================
// FEH風 VS レイヤー（topPanel 統合版）
// =============================================

/**
 * 物理・魔法の戦闘予測値を計算して返す
 * isMagic=true の場合は spell を参照
 */
function calculateBattlePrediction(attacker, target, atkSkillName, isMagic, spell) {
    // ── 攻撃側予測 ──
    let hitRate, expDmg, effectDesc;
    if (isMagic && spell) {
        hitRate    = (attacker.spells?.[spell.id] ?? 5) * 10;  // 成功率%
        const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
        if (spell.effectType === "magicDamage" || spell.effectType === "break") {
            const basePart = (spell.powerFormula || "1d6+MB")
                .replace(/\+?\s*MB/g, "").replace(/MB\s*\+?/g, "").trim() || "1d6";
            const raw = Math.round(avgDice(basePart) + avgDice(attacker.magicBonus));
            expDmg     = barrier ? Math.max(0, raw - barrier.value) : raw;
            effectDesc = `~${expDmg}`;
        } else if (spell.effectType === "heal") {
            expDmg     = Math.round(3.5 + avgDice(attacker.magicBonus));
            effectDesc = `+${expDmg}`;
        } else if (spell.effectType === "barrier") {
            expDmg     = Math.round(avgDice(spell.powerFormula || "2d4"));
            effectDesc = `+${expDmg}`;
        } else {
            expDmg     = 0;
            effectDesc = "特殊";
        }
    } else {
        const atkStat = atkSkillName && atkSkillName in (attacker.skills || {})
            ? attacker.skills[atkSkillName]
            : getAttackSkillVal(attacker).val;
        const stunned   = (target.statusEffects || []).some(e => e.type === "stun");
        const evadeStat = stunned ? 0 : getEvadeSkillVal(target);
        hitRate = stunned ? 100 : getOpposedRate(atkStat, evadeStat);

        const avgDb   = avgDice(attacker.physicalBonus);
        const rawDmg  = Math.round(3.5 + avgDb);
        const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
        expDmg     = barrier ? Math.max(0, rawDmg - barrier.value) : rawDmg;
        effectDesc = `~${expDmg}`;
    }

    // ── 反撃予測（共通） ──
    const canCounter = target.hp > 0 && (target.counterMode ?? "auto") !== "none";
    let ctrHitRate = 0, ctrExpDmg = 0;
    if (canCounter) {
        const ctrAtkStat = getAttackSkillVal(target).val;
        const ctrEvade   = getEvadeSkillVal(attacker);
        ctrHitRate = Math.round((target.courage || 50) * getOpposedRate(ctrAtkStat, ctrEvade) / 100);
        ctrExpDmg  = Math.max(1, Math.round((3.5 + avgDice(target.physicalBonus)) / 2));
    }

    return { hitRate, expDmg, effectDesc, canCounter, ctrHitRate, ctrExpDmg };
}

/** HP に応じた立ち絵 URL を返す（HP50%以下 & 被弾絵あり → 被弾絵） */
function getPortraitSrc(unit) {
    const damaged = unit.maxHp > 0 && unit.hp / unit.maxHp <= 0.5;
    if (damaged && unit.portraitImageDamaged) return unit.portraitImageDamaged;
    return unit.portraitImage || "";
}

/** vsFaceIcon div に background-image でポートレートをセット
 *  被弾状態なら portraitDmgBgSize/portraitDmgBgPos を優先使用 */
function _setVsPortrait(imgEl, charEl, unit) {
    const damaged = unit.maxHp > 0 && unit.hp / unit.maxHp <= 0.5;
    const src = getPortraitSrc(unit) || unit.tokenImage || "";
    const bgSize = damaged
        ? (unit.portraitDmgBgSize || unit.portraitBgSize || "cover")
        : (unit.portraitBgSize || "cover");
    const bgPos  = damaged
        ? (unit.portraitDmgBgPos  || unit.portraitBgPos  || "center top")
        : (unit.portraitBgPos  || "center top");
    if (imgEl) imgEl.src = "";
    const faceDiv = imgEl?.parentElement;
    if (faceDiv) {
        if (src) {
            faceDiv.style.backgroundImage    = `url("${src}")`;
            faceDiv.style.backgroundSize     = bgSize;
            faceDiv.style.backgroundPosition = bgPos;
            faceDiv.style.backgroundRepeat   = "no-repeat";
        } else {
            faceDiv.style.backgroundImage = "none";
        }
    }
    if (charEl) charEl.textContent = src ? "" : (unit.char || unit.name.slice(0, 1));
}

/** vsHpFill のバー幅・色クラスと HP 数値をセット */
function _setVsHp(fillEl, numEl, unit) {
    const pct = unit.hp / unit.maxHp;
    fillEl.style.width = `${pct * 100}%`;
    fillEl.className   = "vsHpFill" + (pct <= 0.25 ? " critical" : pct <= 0.5 ? " low" : "");
    numEl.textContent  = `${unit.hp}/${unit.maxHp}`;
}

/**
 * topLayerVS に予測を描画して表示。下パネルに確認ボタンを表示。
 * @param {object} attacker  攻撃側
 * @param {object} target    防御・対象側
 * @param {object} pred      calculateBattlePrediction() の戻り値
 * @param {string} actionLabel  ラジアルで選択した行動名（"武器"・"破壊" など）
 */
function showBattlePreview(attacker, target, pred, actionLabel) {
    // ── 攻撃側 ──
    const vsAtkImg  = document.getElementById("vsAtkImg");
    const vsAtkChar = document.getElementById("vsAtkChar");
    _setVsPortrait(vsAtkImg, vsAtkChar, attacker);
    document.getElementById("vsAtkName").textContent = attacker.name;
    _setVsHp(
        document.getElementById("vsAtkHpFill"),
        document.getElementById("vsAtkHpNum"),
        attacker
    );

    // ── 防御側 ──
    const vsDefImg  = document.getElementById("vsDefImg");
    const vsDefChar = document.getElementById("vsDefChar");
    _setVsPortrait(vsDefImg, vsDefChar, target);
    document.getElementById("vsDefName").textContent = target.name;
    _setVsHp(
        document.getElementById("vsDefHpFill"),
        document.getElementById("vsDefHpNum"),
        target
    );

    // ── 味方 / 敵 でリング色を切り替え ──
    const vsAtkUnit = vsAtkImg?.closest(".vsUnit");
    const vsDefUnit = vsDefImg?.closest(".vsUnit");
    if (vsAtkUnit) {
        vsAtkUnit.classList.toggle("vsAlly",  attacker.side === "ally");
        vsAtkUnit.classList.toggle("vsEnemy", attacker.side !== "ally");
    }
    if (vsDefUnit) {
        vsDefUnit.classList.toggle("vsAlly",  target.side === "ally");
        vsDefUnit.classList.toggle("vsEnemy", target.side !== "ally");
    }

    // ── 中央：行動名・攻撃予測 ──
    document.getElementById("vsActionName").textContent = actionLabel || "";
    document.getElementById("vsAtkHit").textContent = `${pred.hitRate}%`;
    document.getElementById("vsAtkDmg").textContent = pred.effectDesc || `~${pred.expDmg}`;

    // ── 反撃予測 ──
    const ctrTag     = document.getElementById("vsCtrTag");
    const defStatRow = document.getElementById("vsDefStatRow");
    if (pred.canCounter) {
        ctrTag.textContent       = "反撃あり";
        ctrTag.style.opacity     = "1";
        defStatRow.style.opacity = "1";
        document.getElementById("vsDefHit").textContent = `${pred.ctrHitRate}%`;
        document.getElementById("vsDefDmg").textContent = `~${pred.ctrExpDmg}`;
    } else {
        ctrTag.textContent       = "反撃なし";
        ctrTag.style.opacity     = "0.5";
        defStatRow.style.opacity = "0.35";
        document.getElementById("vsDefHit").textContent = "―%";
        document.getElementById("vsDefDmg").textContent = "―";
    }

    // ── 確認ボタンのテキストを行動に合わせて更新 ──
    if (vsConfirmBtn) vsConfirmBtn.textContent = _vsAttack?.isMagic
        ? `${_vsAttack.spell.name} を使用`
        : "攻撃実行";

    // ── topPanel を VS レイヤーに切り替え ──
    switchTopLayer("vs");
    hideRadialMenu();
}

// ── VS パネル内ボタン（ページロード時に一度だけ登録） ──
vsConfirmBtn.addEventListener("click", () => {
    if (!_vsAttack) return;
    const { attacker, target, isMagic, spell } = _vsAttack;
    hideBattlePreview();
    clearHighlights();
    if (isMagic) executeMagic(attacker, spell, target);
    else          executeAttack(attacker, target);
});
vsCancelBtn.addEventListener("click", () => {
    if (!_vsAttack) return;
    const { isMagic } = _vsAttack;
    hideBattlePreview();
    actionState = null;
    clearHighlights();
    if (selectedUnit) {
        if (isMagic) showMagicRadial(selectedUnit);
        else          showAttackRadial(selectedUnit);
    }
});

// ── ポートレート位置調整ツール ──────────────────────────────

/** スライダー1本を作る（VSパネル調整・単体調整で共用） */
function _adjSlider(label, min, max, step, val, onChange) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:4px;width:100%";
    const lbl = document.createElement("span");
    lbl.textContent = label;
    lbl.style.cssText = "font-size:8px;color:#c0a0ff;min-width:28px;text-align:right";
    const inp = document.createElement("input");
    inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
    inp.style.cssText = "flex:1;height:12px;accent-color:#a060ff";
    const num = document.createElement("span");
    num.textContent = val;
    num.style.cssText = "font-size:8px;color:#e0d0ff;min-width:30px";
    inp.addEventListener("input", () => { num.textContent = inp.value; onChange(Number(inp.value)); });
    wrap.appendChild(lbl); wrap.appendChild(inp); wrap.appendChild(num);
    return wrap;
}

/** localStorage から保存済みのポートレート位置を読み込んでユニット配列に反映 */
function loadPortraitAdj(units) {
    try {
        const saved = JSON.parse(localStorage.getItem("portraitAdj") || "{}");
        const KEYS = ["portraitBgSize","portraitBgPos",
                      "portraitDmgBgSize","portraitDmgBgPos",
                      "statusBgSize","statusBgPos"];
        units.forEach(u => {
            if (saved[u.id]) {
                KEYS.forEach(k => { if (saved[u.id][k] != null) u[k] = saved[u.id][k]; });
            }
        });
    } catch(e) {}
}

/** ドット絵5回タップで呼ばれるスタンドアロン調整パネル
 *  上パネル（VSレイヤー）・下パネル（portrait-wrapper）を直接プレビューとして使う */
function showUnitPortraitAdjuster(unit) {
    const existing = document.getElementById("unitAdjOverlay");
    if (existing) { existing.remove(); return; }

    // ── 元のトップレイヤーを記憶して閉じる時に復元 ──
    const prevLayer = document.querySelector(".topTab.active")?.dataset.layer || "battle";

    // ── ヘルパー ──
    function parsePos(str) {
        const p = (str || "center top").split(" ");
        let x = 50, y = 0;
        if (p[0] === "center") x = 50;
        else if (p[0]?.endsWith("%")) x = parseFloat(p[0]);
        if (p[1] === "top") y = 0;
        else if (p[1]?.endsWith("px")) y = parseFloat(p[1]);
        return { x, y };
    }

    // ── 3コンテキスト定義 ──
    const CTX = [
        { label:"VS立ち絵",   sk:"portraitBgSize",    pk:"portraitBgPos",
          imgSrc: unit.portraitImage || "" },
        { label:"VS被弾絵",   sk:"portraitDmgBgSize", pk:"portraitDmgBgPos",
          imgSrc: unit.portraitImageDamaged || unit.portraitImage || "",
          fallbackSK:"portraitBgSize", fallbackPK:"portraitBgPos" },
        { label:"ステータス", sk:"statusBgSize",        pk:"statusBgPos",
          imgSrc: unit.portraitImage || "",
          fallbackSK:"portraitBgSize", fallbackPK:"portraitBgPos" },
    ];

    const state = CTX.map(c => {
        const rawSize = unit[c.sk] || (c.fallbackSK && unit[c.fallbackSK]) || "280%";
        const rawPos  = unit[c.pk] || (c.fallbackPK && unit[c.fallbackPK]) || "center top";
        const pos = parsePos(rawPos);
        return { size: parseFloat(rawSize) || 280, posX: pos.x, posY: pos.y };
    });

    // ── 実パネル更新関数 ──
    function applyToVS(tabIdx) {
        const s   = state[tabIdx];
        const xStr = s.posX === 50 ? "center" : `${s.posX}%`;
        const yStr = s.posY === 0  ? "top"    : `${s.posY}px`;
        // VSレイヤーを表示して攻撃側（左）だけこのキャラのポートレートを入れる
        switchTopLayer("vs");
        const atkFace = document.getElementById("vsAtkImg")?.parentElement;
        if (atkFace) {
            atkFace.style.backgroundImage    = `url("${CTX[tabIdx].imgSrc}")`;
            atkFace.style.backgroundSize     = `${s.size}%`;
            atkFace.style.backgroundPosition = `${xStr} ${yStr}`;
            atkFace.style.backgroundRepeat   = "no-repeat";
        }
        document.getElementById("vsAtkName").textContent   = unit.name;
        document.getElementById("vsAtkChar").textContent   = "";
        document.getElementById("vsAtkHpFill").style.width = "100%";
        document.getElementById("vsAtkHpNum").textContent  = `${unit.maxHp}/${unit.maxHp}`;
        // 防御側をブランク
        const defFace = document.getElementById("vsDefImg")?.parentElement;
        if (defFace) defFace.style.backgroundImage = "none";
        document.getElementById("vsDefName").textContent   = "";
        document.getElementById("vsDefChar").textContent   = "";
        document.getElementById("vsDefHpFill").style.width = "0";
        document.getElementById("vsDefHpNum").textContent  = "";
        // 中央スタット非表示（調整中は不要）
        const mid = document.getElementById("vsMiddle");
        if (mid) mid.style.visibility = "hidden";
        return `${CTX[tabIdx].sk}:"${s.size}%", ${CTX[tabIdx].pk}:"${xStr} ${yStr}"`;
    }

    function applyToStatus() {
        const s   = state[2];
        const xStr = s.posX === 50 ? "center" : `${s.posX}%`;
        const yStr = s.posY === 0  ? "top"    : `${s.posY}px`;
        switchTopLayer("battle");
        // 下パネルのportrait-wrapperを直接更新（なければユニット情報を描画）
        let wrapper = document.querySelector(".portrait-wrapper");
        if (!wrapper) {
            if (unit.side === "ally") renderBattleCommands(unit);
            else renderEnemyInfoPanel(unit);
            wrapper = document.querySelector(".portrait-wrapper");
        }
        if (wrapper) {
            wrapper.style.backgroundImage    = `url("${CTX[2].imgSrc}")`;
            wrapper.style.backgroundSize     = `${s.size}%`;
            wrapper.style.backgroundPosition = `${xStr} ${yStr}`;
        }
        return `${CTX[2].sk}:"${s.size}%", ${CTX[2].pk}:"${xStr} ${yStr}"`;
    }

    function closeAdj() {
        overlay.remove();
        // vsMiddle の visibility を戻す
        const mid = document.getElementById("vsMiddle");
        if (mid) mid.style.visibility = "";
        switchTopLayer(prevLayer);
    }

    // ── オーバーレイ（battleBoard だけ覆う） ──
    const overlay = document.createElement("div");
    overlay.id = "unitAdjOverlay";
    overlay.style.cssText = "position:absolute;inset:0;z-index:300;background:rgba(5,3,15,0.82);pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;";
    overlay.addEventListener("click", e => { if (e.target === overlay) closeAdj(); });

    // ── スライダーボックス ──
    const box = document.createElement("div");
    box.style.cssText = "background:rgba(8,4,22,0.97);border:1px solid rgba(160,80,255,0.55);border-radius:8px;padding:10px;width:86%;max-width:320px;display:flex;flex-direction:column;gap:6px;pointer-events:auto;";

    // ヘッダー
    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center";
    const titleEl = document.createElement("span");
    titleEl.textContent = `${unit.name} — ポートレート調整`;
    titleEl.style.cssText = "font-size:10px;color:#c0a0ff;font-weight:bold";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0";
    closeBtn.onclick = closeAdj;
    hdr.appendChild(titleEl); hdr.appendChild(closeBtn);
    box.appendChild(hdr);

    // タブ
    const tabBar = document.createElement("div");
    tabBar.style.cssText = "display:flex;gap:4px;";
    const tabBtns = CTX.map((c, i) => {
        const btn = document.createElement("button");
        btn.textContent = c.label;
        btn.style.cssText = "flex:1;padding:5px 0;font-size:9px;border-radius:4px;cursor:pointer;border:1px solid rgba(160,80,255,0.4);background:rgba(20,10,40,0.8);color:#b090e0;";
        btn.addEventListener("click", () => switchTab(i));
        tabBar.appendChild(btn);
        return btn;
    });
    box.appendChild(tabBar);

    // スライダーエリア
    const slidersWrap = document.createElement("div");
    slidersWrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    box.appendChild(slidersWrap);

    // 出力テキスト
    const output = document.createElement("div");
    output.style.cssText = "font-size:8px;color:#90e0a0;word-break:break-all;cursor:pointer;padding:4px 5px;background:rgba(0,40,0,0.35);border-radius:3px";
    output.title = "タップでコピー";
    output.addEventListener("click", () => {
        navigator.clipboard?.writeText(output.textContent);
        output.style.background = "rgba(80,200,80,0.25)";
        setTimeout(() => output.style.background = "rgba(0,40,0,0.35)", 700);
    });
    box.appendChild(output);

    // 保存ボタン
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "全タブの位置を保存";
    saveBtn.style.cssText = "padding:8px;border-radius:5px;cursor:pointer;background:rgba(70,35,150,0.9);border:1px solid rgba(160,80,255,0.6);color:#d0b0ff;font-size:12px;font-weight:bold;width:100%;";
    saveBtn.onclick = () => {
        CTX.forEach((c, i) => {
            const s = state[i];
            const xStr = s.posX === 50 ? "center" : `${s.posX}%`;
            const yStr = s.posY === 0  ? "top"    : `${s.posY}px`;
            unit[c.sk] = `${s.size}%`;
            unit[c.pk] = `${xStr} ${yStr}`;
        });
        const saved = JSON.parse(localStorage.getItem("portraitAdj") || "{}");
        // state から直接書き込む（unit[k] が未設定でも全タブ保存）
        const entry = {};
        CTX.forEach((c, i) => { entry[c.sk] = unit[c.sk]; entry[c.pk] = unit[c.pk]; });
        saved[unit.id] = entry;
        localStorage.setItem("portraitAdj", JSON.stringify(saved));
        saveBtn.textContent = "✓ 保存しました！";
        saveBtn.style.background = "rgba(30,100,60,0.9)";
        saveBtn.style.borderColor = "rgba(80,200,100,0.6)";
        setTimeout(() => {
            saveBtn.textContent = "全タブの位置を保存";
            saveBtn.style.background = "rgba(70,35,150,0.9)";
            saveBtn.style.borderColor = "rgba(160,80,255,0.6)";
        }, 1800);
    };
    box.appendChild(saveBtn);

    // ── タブ切り替え ──
    let activeTab = -1;
    function switchTab(idx) {
        if (activeTab === idx) return;
        activeTab = idx;
        tabBtns.forEach((b, i) => {
            b.style.background  = i === idx ? "rgba(90,40,180,0.9)" : "rgba(20,10,40,0.8)";
            b.style.color       = i === idx ? "#e0c8ff" : "#b090e0";
            b.style.borderColor = i === idx ? "rgba(180,100,255,0.8)" : "rgba(160,80,255,0.4)";
        });
        // スライダー再構築
        slidersWrap.innerHTML = "";
        const s = state[idx];
        const applyFn = () => {
            output.textContent = idx < 2 ? applyToVS(idx) : applyToStatus();
        };
        slidersWrap.appendChild(_adjSlider("size",  80,  600, 5,  s.size, v => { s.size = v; applyFn(); }));
        slidersWrap.appendChild(_adjSlider("x %",  -20,  120, 1,  s.posX, v => { s.posX = v; applyFn(); }));
        slidersWrap.appendChild(_adjSlider("y px", -200, 200, 5,  s.posY, v => { s.posY = v; applyFn(); }));
        applyFn(); // 初期表示
    }
    switchTab(0);

    overlay.appendChild(box);
    document.getElementById("battleBoard").appendChild(overlay);
}

{
    let adjActive = false;
    let adjPanel  = null;

    /** 片側ユニットの調整ブロックを作る */
    function _adjBlock(unit, faceDiv, titleColor) {
        const block = document.createElement("div");
        block.style.cssText = `display:flex;flex-direction:column;gap:3px;
            background:rgba(20,10,35,0.88);border:1px solid rgba(160,80,255,0.35);
            border-radius:4px;padding:5px;flex:1`;

        const title = document.createElement("div");
        title.textContent = unit?.name ?? "―";
        title.style.cssText = `font-size:9px;font-weight:bold;color:${titleColor};margin-bottom:2px`;
        block.appendChild(title);

        if (!unit) return block;

        let size = parseFloat(unit.portraitBgSize) || 280;
        let posX = 50;  // % (centerを50とする)
        let posY = 0;   // px

        // 現在の portraitBgPos を解析
        const rawPos = unit.portraitBgPos || "center top";
        const parts  = rawPos.split(" ");
        if (parts[0] === "center") posX = 50;
        else if (parts[0].endsWith("%")) posX = parseFloat(parts[0]);
        if (parts[1] === "top") posY = 0;
        else if (parts[1]?.endsWith("px")) posY = parseFloat(parts[1]);

        const apply = () => {
            const xStr = posX === 50 ? "center" : `${posX}%`;
            const yStr = posY === 0  ? "top"    : `${posY}px`;
            faceDiv.style.backgroundSize     = `${size}%`;
            faceDiv.style.backgroundPosition = `${xStr} ${yStr}`;
            output.textContent = `portraitBgSize:"${size}%", portraitBgPos:"${xStr} ${yStr}"`;
        };

        block.appendChild(_adjSlider("size", 80, 600, 5,  size, v => { size = v; apply(); }));
        block.appendChild(_adjSlider("x%",  -20, 120, 1,  posX, v => { posX = v; apply(); }));
        block.appendChild(_adjSlider("y px",-200, 200, 5, posY, v => { posY = v; apply(); }));

        const output = document.createElement("div");
        output.style.cssText = "font-size:7px;color:#90e0a0;word-break:break-all;cursor:pointer;margin-top:2px";
        output.title = "クリックでコピー";
        output.addEventListener("click", () => {
            navigator.clipboard?.writeText(output.textContent);
            output.style.background = "rgba(100,200,100,0.2)";
            setTimeout(() => output.style.background = "", 600);
        });
        apply();
        block.appendChild(output);
        return block;
    }

    function showAdjPanel() {
        if (adjPanel) adjPanel.remove();
        const atkUnit = _vsAttack?.attacker ?? null;
        const defUnit = _vsAttack?.target   ?? null;
        const atkFace = document.getElementById("vsAtkImg")?.parentElement;
        const defFace = document.getElementById("vsDefImg")?.parentElement;

        adjPanel = document.createElement("div");
        adjPanel.id = "portraitAdjPanel";
        adjPanel.style.cssText = `
            position:absolute; bottom:0; left:0; right:0;
            display:flex; gap:4px; padding:4px 4px 6px;
            background:rgba(10,5,20,0.95);
            border-top:1px solid rgba(160,80,255,0.4);
            z-index:200; pointer-events:auto;`;
        adjPanel.appendChild(_adjBlock(atkUnit, atkFace, "#70c0ff"));
        adjPanel.appendChild(_adjBlock(defUnit, defFace, "#ff9090"));

        // #topLayerVS ではなく #gameScreen の直下に置いて上パネルを隠さない
        document.getElementById("gameScreen").appendChild(adjPanel);
    }

    document.getElementById("vsAdjustToggle").addEventListener("click", e => {
        e.stopPropagation();
        adjActive = !adjActive;
        e.currentTarget.style.background = adjActive
            ? "rgba(100,40,160,0.85)" : "rgba(40,20,60,0.85)";
        if (adjActive) showAdjPanel();
        else { adjPanel?.remove(); adjPanel = null; }
    });

}

/** VS レイヤーを閉じてバトルログに戻る */
function hideBattlePreview() {
    _vsAttack = null;
    if (gameMode === "battle") switchTopLayer("battle");
}

/** ダイス式の期待値を返す（"2d6+3" → 10, "1d6" → 3.5→3） */
function avgDice(formula) {
    if (!formula || formula === "0") return 0;
    let expr = String(formula).replace(/(\d+)d(\d+)/g, (_, n, m) =>
        String(parseInt(n) * (parseInt(m) + 1) / 2)
    );
    try {
        const safe = expr.replace(/[^0-9+\-*/().]/g, "");
        return safe ? Math.max(0, Math.floor(new Function("return " + safe)())) : 0;
    } catch (e) { return 0; }
}

/**
 * 上パネルに戦闘予測を表示し「予測」タブに自動切替
 * @param {object}  attacker  - 攻撃側ユニット
 * @param {Array}   targets   - 対象ユニット配列
 * @param {string|null} skillName - 使用スキル名（物理）
 * @param {boolean} isMagic   - 魔法かどうか
 * @param {object|null} spell - 魔法データ（isMagic時）
 */
function showForecastLayer(attacker, targets, skillName, isMagic, spell) {
    forecastContent.innerHTML = "";

    // ヘッダー
    const label = isMagic ? (spell?.name || "魔法") : (skillName || "攻撃");
    const hdr = document.createElement("div");
    hdr.className = "forecastHeader";
    hdr.textContent = `${attacker.name}  ─  ${label}`;
    forecastContent.appendChild(hdr);

    if (targets.length === 0) {
        const empty = document.createElement("div");
        empty.className = "forecastEmpty";
        empty.textContent = "射程内に対象がいません";
        forecastContent.appendChild(empty);
        switchTopLayer("forecast");
        return;
    }

    for (const target of targets) {
        const card = document.createElement("div");
        card.className = "forecastCard";

        // ターゲットHPヘッダー
        const hpPct = target.hp / target.maxHp * 100;
        const hpClass = hpPct <= 25 ? "critical" : hpPct <= 50 ? "low" : "";
        card.innerHTML = `
            <div class="forecastCardHeader">
                <span class="forecastTargetName">${target.name}</span>
                <div class="forecastHpBar"><div class="forecastHpFill ${hpClass}" style="width:${hpPct}%"></div></div>
                <span class="forecastHpVal">${target.hp}/${target.maxHp}</span>
            </div>
            <div class="forecastCardBody" id="fcbody_${target.id}"></div>
        `;
        forecastContent.appendChild(card);

        const body = card.querySelector(`#fcbody_${target.id}`);

        if (!isMagic) {
            // ── 物理攻撃予測 ──
            const atkStat = skillName && skillName in (attacker.skills || {})
                ? attacker.skills[skillName]
                : getAttackSkillVal(attacker).val;
            const stunned  = (target.statusEffects || []).some(e => e.type === "stun");
            const evadeStat = stunned ? 0 : getEvadeSkillVal(target);
            const hitRate   = stunned ? 100 : getOpposedRate(atkStat, evadeStat);

            const avgDb   = avgDice(attacker.physicalBonus);
            const rawDmg  = Math.round(3.5 + avgDb);
            const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
            const expDmg  = barrier ? Math.max(0, rawDmg - barrier.value) : rawDmg;
            const barrierNote = barrier ? `<span class="forecastNote">結界-${barrier.value}</span>` : "";

            // 反撃期待値
            const ctrAttempt = target.courage || 50;
            const ctrAtkStat = getAttackSkillVal(target).val;
            const ctrEvade   = getEvadeSkillVal(attacker);
            const ctrHit     = getOpposedRate(ctrAtkStat, ctrEvade);
            const ctrChance  = Math.round(ctrAttempt * ctrHit / 100);
            const ctrDmg     = Math.max(1, Math.round((3.5 + avgDice(target.physicalBonus)) / 2));

            body.innerHTML = `
                <div class="forecastRow">
                    <span class="forecastDir">→</span>
                    <span class="forecastLabel">命中</span>
                    <span class="forecastVal hit">${hitRate}%</span>
                    <span class="forecastSep">／</span>
                    <span class="forecastLabel">期待ダメ</span>
                    <span class="forecastVal dmg">~${expDmg}</span>${barrierNote}
                </div>
                <div class="forecastRow">
                    <span class="forecastDir ctr">←</span>
                    <span class="forecastLabel">反撃</span>
                    <span class="forecastVal ctr">${ctrChance}%</span>
                    <span class="forecastSep">／</span>
                    <span class="forecastLabel">被ダメ</span>
                    <span class="forecastVal cdmg">~${ctrDmg}</span>
                </div>
            `;
        } else if (isMagic && spell) {
            // ── 魔法予測 ──
            const successRate = (attacker.spells?.[spell.id] ?? 5) * 10;  // 成功値×10%
            let effectHtml = "";

            if (spell.effectType === "magicDamage") {
                const basePart = (spell.powerFormula || "1d6+MB")
                    .replace(/\+?\s*MB/g, "").replace(/MB\s*\+?/g, "").trim() || "1d6";
                const avgMb  = avgDice(attacker.magicBonus);
                const rawMdmg = Math.round(avgDice(basePart) + avgMb);
                const barr2  = (target.statusEffects || []).find(e => e.type === "barrier");
                const effMdmg = barr2 ? Math.max(0, rawMdmg - barr2.value) : rawMdmg;
                const bNote   = barr2 ? `<span class="forecastNote">結界-${barr2.value}</span>` : "";
                effectHtml = `<span class="forecastLabel">ダメ</span><span class="forecastVal dmg">~${effMdmg}</span>${bNote}`;
            } else if (spell.effectType === "heal") {
                const healAmt = Math.round(3.5 + avgDice(attacker.magicBonus));
                effectHtml = `<span class="forecastLabel">回復</span><span class="forecastVal hit">~${healAmt}</span>`;
            } else if (spell.effectType === "barrier") {
                const barrVal = Math.round(avgDice(spell.powerFormula || "2d4"));
                effectHtml = `<span class="forecastLabel">結界</span><span class="forecastVal hit">~${barrVal}</span>`;
            } else {
                effectHtml = `<span class="forecastLabel">${spell.description || spell.effectType}</span>`;
            }

            body.innerHTML = `
                <div class="forecastRow">
                    <span class="forecastDir">→</span>
                    <span class="forecastLabel">成功</span>
                    <span class="forecastVal hit">${successRate}%</span>
                    <span class="forecastSep">／</span>
                    ${effectHtml}
                </div>
            `;
        }
    }

    switchTopLayer("forecast");
}

/** 予測レイヤーを閉じてバトルログに戻る */
function hideForecastLayer() {
    if (gameMode === "battle") switchTopLayer("battle");
}

// ─── 敵AI ユーティリティ ───────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/** 行動中ユニットの赤ハイライトをON/OFF */
function setUnitActing(id, active) {
    const el = document.getElementById(`unit_${id}`);
    if (el) el.classList.toggle("acting", active);
}
/** 被ダメージ時の白フラッシュ */
function flashUnitHit(id) {
    const el = document.getElementById(`unit_${id}`);
    if (!el) return;
    el.classList.add("flashHit");
    setTimeout(() => el.classList.remove("flashHit"), 500);
}

/**
 * ユニットトークンの頭上にダメージ/回復値をポップアップ表示
 * @param {string} unitId - ユニットID
 * @param {number} value  - 数値（miss時は無視）
 * @param {string} type   - "damage" | "counter" | "heal" | "miss"
 */
function showDamagePopup(unitId, value, type) {
    const el = document.getElementById(`unit_${unitId}`);
    if (!el) return;
    const popup = document.createElement("div");
    popup.className = `dmgPopup ${type}`;
    switch (type) {
        case "heal":  popup.textContent = `+${value}`; break;
        case "miss":  popup.textContent = "Miss";      break;
        default:      popup.textContent = String(value); break;
    }
    // ユニットは10%幅なので中心はleft+5%
    const leftPct = parseFloat(el.style.left) + 5;
    const topPct  = parseFloat(el.style.top);
    popup.style.left = `${leftPct}%`;
    popup.style.top  = `${topPct}%`;
    unitLayer.appendChild(popup);
    setTimeout(() => popup.remove(), 1200);
}

async function startEnemyPhase() {
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

    for (const enemy of enemies) {
        if (battleOver) break;
        await sleep(600);              // 行動前の間
        if (battleOver) break;
        await enemyAction(enemy);
        await sleep(450);              // 行動後の間
    }

    if (!battleOver) startAllyPhase();
}

function tickStatusEffects(side) {
    for (const u of battleUnits) {
        if (u.side !== side || u.hp <= 0 || !u.statusEffects) continue;
        const nextEffects = [];
        for (const e of u.statusEffects) {
            if (e.type === "burn") {
                const dmg = rollDice("1d3");
                u.hp = Math.max(0, u.hp - dmg);
                showDamagePopup(u.id, dmg, "damage");
                addLog(`  ${u.name}は火傷で ${dmg} ダメージ（HP ${u.hp}/${u.maxHp}）`);
            } else if (e.type === "gravityField") {
                const gDmg = e.value || 1;
                u.hp = Math.max(0, u.hp - gDmg);
                showDamagePopup(u.id, gDmg, "damage");
                addLog(`  ${u.name}は重力場で ${gDmg} ダメージ`);
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
async function enemyAction(enemy) {
    if (enemy.hp <= 0) return;

    setUnitActing(enemy.id, true);   // 赤ハイライトON

    // スタン中は行動不可
    if ((enemy.statusEffects || []).some(e => e.type === "stun")) {
        addLog(`・${enemy.name}はスタン中のため行動できない`);
        enemy.moved = true;
        enemy.acted = true;
        setUnitActing(enemy.id, false);
        return;
    }

    const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
    if (aliveAllies.length === 0) {
        setUnitActing(enemy.id, false);
        return;
    }

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
                setUnitActing(enemy.id, true);  // renderUnitsで再生成されるので再付与
                await sleep(550);               // 移動後に少し待つ
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
            flashUnitHit(target.id);            // 被弾フラッシュ
            resolvePhysicalHit(enemy, target, atkSkillName);
            checkVictoryCondition();
            await sleep(700);                   // ダメージ表示を見せる間
        }
    }

    enemy.moved = true;
    enemy.acted = true;
    setUnitActing(enemy.id, false);  // ハイライトOFF
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

function renderBattleCommands(unit) {
    commandHeader.textContent = unit.name;
    commandInfo.textContent   = `Lv ${unit.level}`;
    commandList.innerHTML     = "";

    // ユニット情報カード
    const hpPct   = unit.hp / unit.maxHp;
    const mpPct   = unit.mp / unit.maxMp;
    const hpClass = hpPct <= 0.25 ? "critical" : hpPct <= 0.5 ? "low" : "";

    const bgSize = unit.statusBgSize || unit.portraitBgSize || "280%";
    const bgPos  = unit.statusBgPos  || unit.portraitBgPos  || "top center";
    const statusStr = (() => {
        if (!unit.statusEffects || unit.statusEffects.length === 0) return "―";
        const nm = { burn:"火傷", stun:"スタン", barrier:"結界", counter:"カウンター",
                     accuracyDown:"命中↓", gravityField:"重力場", support:"強化" };
        return unit.statusEffects.map(e => nm[e.type] || e.type).join(" ");
    })();
    const _portraitSrc = getPortraitSrc(unit);
    const imgTag = _portraitSrc
        ? `<div class="portrait-wrapper" style="background-image:url('${_portraitSrc}');background-size:${bgSize};background-position:${bgPos}"></div>`
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
                <div class="unitInfoSubPair">
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">物理</span>
                        <span class="unitInfoSubValue">+${unit.physicalBonus}</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">魔力</span>
                        <span class="unitInfoSubValue">+${unit.magicBonus}</span>
                    </div>
                </div>
                <div class="unitInfoSubItem">
                    <span class="unitInfoSubLabel">装備</span>
                    <span class="unitInfoSubValue unitInfoEquip">${unit.equipment || "―"}</span>
                </div>
                <div class="unitInfoSubPair">
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">種族</span>
                        <span class="unitInfoSubValue">${unit.race || "―"}</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">所属</span>
                        <span class="unitInfoSubValue">${unit.side === "ally" ? "味方" : "敵"}</span>
                    </div>
                </div>
                <div class="unitInfoSubPair">
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">移動</span>
                        <span class="unitInfoSubValue">${unit.move}マス</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">状態</span>
                        <span class="unitInfoSubValue">${statusStr}</span>
                    </div>
                </div>
            </div>
            <div class="unitInfoBtnRow">
                <button class="unitInfoTabBtn" id="allySkillBtn">特技</button>
                <button class="unitInfoTabBtn" id="allyMagicBtn">魔法</button>
                <button class="unitInfoStatusBtn" id="allyStatusBtn">詳細 ▶</button>
            </div>
        </div>
    `;
    commandList.appendChild(card);
    document.getElementById("allySkillBtn").addEventListener("click",  () => openStatusModal(unit.id, "battle"));
    document.getElementById("allyMagicBtn").addEventListener("click",  () => openStatusModal(unit.id, "magic"));
    document.getElementById("allyStatusBtn").addEventListener("click", () => openStatusModal(unit.id, "basic"));

    showRadialMenu(unit);
}

/** 敵ユニットをタップした時に下パネルに情報を表示 */
function renderEnemyInfoPanel(unit) {
    commandHeader.textContent = unit.name;
    commandInfo.textContent   = `Lv ${unit.level}  /  敵`;
    commandList.innerHTML     = "";

    const hpPct   = unit.hp / unit.maxHp;
    const mpPct   = unit.mp / unit.maxMp;
    const hpClass = hpPct <= 0.25 ? "critical" : hpPct <= 0.5 ? "low" : "";

    const bgSize = unit.statusBgSize || unit.portraitBgSize || "280%";
    const bgPos  = unit.statusBgPos  || unit.portraitBgPos  || "top center";
    const statusStr = (() => {
        if (!unit.statusEffects || unit.statusEffects.length === 0) return "―";
        const nm = { burn:"火傷", stun:"スタン", barrier:"結界", counter:"カウンター",
                     accuracyDown:"命中↓", gravityField:"重力場", support:"強化" };
        return unit.statusEffects.map(e => nm[e.type] || e.type).join(" ");
    })();
    const _portraitSrc = getPortraitSrc(unit);
    const imgTag = _portraitSrc
        ? `<div class="portrait-wrapper" style="background-image:url('${_portraitSrc}');background-size:${bgSize};background-position:${bgPos}"></div>`
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
                <div class="unitInfoSubPair">
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">物理</span>
                        <span class="unitInfoSubValue">+${unit.physicalBonus}</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">魔力</span>
                        <span class="unitInfoSubValue">+${unit.magicBonus}</span>
                    </div>
                </div>
                <div class="unitInfoSubItem">
                    <span class="unitInfoSubLabel">装備</span>
                    <span class="unitInfoSubValue unitInfoEquip">${unit.equipment || "―"}</span>
                </div>
                <div class="unitInfoSubPair">
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">種族</span>
                        <span class="unitInfoSubValue">${unit.race || "―"}</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">所属</span>
                        <span class="unitInfoSubValue">${unit.side === "ally" ? "味方" : "敵"}</span>
                    </div>
                </div>
                <div class="unitInfoSubPair">
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">移動</span>
                        <span class="unitInfoSubValue">${unit.move}マス</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">状態</span>
                        <span class="unitInfoSubValue">${statusStr}</span>
                    </div>
                </div>
            </div>
            <div class="unitInfoBtnRow">
                <button class="unitInfoTabBtn" id="enemySkillBtn">特技</button>
                <button class="unitInfoTabBtn" id="enemyMagicBtn">魔法</button>
                <button class="unitInfoStatusBtn" id="enemyStatusBtn">詳細 ▶</button>
            </div>
        </div>
    `;
    commandList.appendChild(card);
    document.getElementById("enemySkillBtn").addEventListener("click",  () => openStatusModal(unit.id, "battle"));
    document.getElementById("enemyMagicBtn").addEventListener("click",  () => openStatusModal(unit.id, "magic"));
    document.getElementById("enemyStatusBtn").addEventListener("click", () => openStatusModal(unit.id, "basic"));
}

function renderIdlePanel() {
    if (gameMode === "battle" && !battleOver) {
        commandHeader.textContent = turnPhase === "ally" ? "味方フェーズ" : "敵フェーズ";
        commandInfo.textContent   = `TURN ${turnCount}  ―  ユニットを選択`;
    } else {
        commandHeader.textContent = "command";
        commandInfo.textContent   = "";
    }
    commandList.innerHTML = "";
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
            showSkillRadial(unit);
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
function openStatusModal(unitId, tab = "basic") {
    statusTargetId = unitId;
    currentStatusTab = tab;
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
    topLayerBattle.classList.toggle("hidden",   layer !== "battle");
    topLayerForecast.classList.toggle("hidden",  layer !== "forecast");
    topLayerVS.classList.toggle("hidden",        layer !== "vs");
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
// シナリオ立ち絵5タップ検出用
let _scenTapCount = 0, _scenTapTimer = null, _scenTapName = null;

function updateScenarioCharLayer(speaker) {
    scenarioCharLayer.innerHTML = "";
    // localStorage 保存値（優先度最高）
    let savedScenAdj = {};
    try { savedScenAdj = JSON.parse(localStorage.getItem("scenarioPortraitAdj") || "{}"); } catch(e) {}

    scenarioCharacters.forEach(entry => {
        // entry は文字列 or { name, image, bgSize?, bgPos? }
        const name  = (typeof entry === "string") ? entry : entry.name;
        const image = (typeof entry === "object" && entry.image)
            ? entry.image
            : (CHARACTERS_DATA.find(c => c.name === name)?.portraitImage ?? "");

        const charData = CHARACTERS_DATA.find(c => c.name === name);

        const wrapper = document.createElement("div");
        wrapper.className = "scenarioChar" + (name === speaker ? " active" : "");

        const portrait = document.createElement("div");
        portrait.className = "scenarioCharPortrait";
        if (image) portrait.style.backgroundImage = `url('${image}')`;

        // 優先順: localStorage(画像パスキー) > localStorage(キャラ名キー・全表情共通) > entry.bgSize > CHARACTERS_DATA
        // ※ 旧バージョンはキャラ名キーで保存していたので後方互換として両方チェック
        const adjKey  = image || name;
        const sBgSize = savedScenAdj[adjKey]?.bgSize
            || savedScenAdj[name]?.bgSize
            || (typeof entry === "object" && entry.bgSize)
            || charData?.scenarioBgSize;
        const sBgPos  = savedScenAdj[adjKey]?.bgPos
            || savedScenAdj[name]?.bgPos
            || (typeof entry === "object" && entry.bgPos)
            || charData?.scenarioBgPos;
        if (sBgSize) portrait.style.backgroundSize     = sBgSize;
        if (sBgPos)  portrait.style.backgroundPosition = sBgPos;

        // ── 5タップで立ち絵調整パネルを開く ──
        wrapper.addEventListener("click", (e) => {
            if (!scenarioActive) return;
            e.stopPropagation();
            if (_scenTapName !== adjKey) { _scenTapCount = 0; _scenTapName = adjKey; }
            _scenTapCount++;
            clearTimeout(_scenTapTimer);
            if (_scenTapCount >= 5) {
                _scenTapCount = 0; _scenTapName = null;
                showScenarioPortraitAdjuster(name, image, portrait);
                return;
            }
            _scenTapTimer = setTimeout(() => { _scenTapCount = 0; _scenTapName = null; }, 800);
        });

        wrapper.appendChild(portrait);
        scenarioCharLayer.appendChild(wrapper);
    });
}

// =============================================
// シナリオ立ち絵調整パネル（5タップで起動）
// =============================================
function showScenarioPortraitAdjuster(name, image, portraitEl) {
    // キー：画像パスがあれば画像パス、なければキャラ名（表情ごとに独立保存）
    const adjKey = image || name;
    // 表情名をタイトルに表示（例: "笑顔_transparent.png" → "笑顔"）
    const exprMatch = image?.match(/\/([^/]+)_transparent\.png$/);
    const exprLabel = exprMatch ? ` (${exprMatch[1]})` : "";

    // 現在の値を読み込む（localStorage > CSSから取得）
    let savedAdj = {};
    try { savedAdj = JSON.parse(localStorage.getItem("scenarioPortraitAdj") || "{}"); } catch(e) {}
    const saved = savedAdj[adjKey] || {};

    const initSize = saved.bgSize || portraitEl.style.backgroundSize || "auto 140%";
    const initPos  = saved.bgPos  || portraitEl.style.backgroundPosition || "center top";

    // "auto XX%" → 数値
    let sizeNum = parseInt(initSize.match(/(\d+)%/)?.[1] || "140");
    // "center XXpx" or "center top" → 数値（topは0）
    let posYNum = 0;
    const posMatch = initPos.match(/(-?\d+)px/);
    if (posMatch) posYNum = parseInt(posMatch[1]);

    // ── オーバーレイ（#battleBoard に重ねる） ──
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none";

    const panel = document.createElement("div");
    panel.style.cssText = [
        "position:absolute;bottom:0;left:0;right:0;",
        "background:rgba(20,10,35,0.96);border-top:2px solid #7040b0;",
        "padding:10px 14px 14px;pointer-events:all;",
    ].join("");

    // タイトル
    const title = document.createElement("div");
    title.textContent = `シナリオ立ち絵調整：${name}${exprLabel}`;
    title.style.cssText = "color:#c0a0ff;font-size:11px;font-weight:bold;margin-bottom:8px;font-family:sans-serif";
    panel.appendChild(title);

    // ライブ更新
    const apply = () => {
        const newSize = `auto ${sizeNum}%`;
        const newPos  = posYNum === 0 ? "center top" : `center ${posYNum}px`;
        portraitEl.style.backgroundSize     = newSize;
        portraitEl.style.backgroundPosition = newPos;
        valDisp.textContent = `bgSize: "${newSize}"\nbgPos:  "${newPos}"`;
    };

    panel.appendChild(_adjSlider("サイズ %", 50, 400, 5, sizeNum, v => { sizeNum = v; apply(); }));
    panel.appendChild(_adjSlider("縦 offset px", -50, 200, 5, posYNum, v => { posYNum = v; apply(); }));

    // 値表示（scenario.js に貼る用）
    const valWrap = document.createElement("div");
    valWrap.style.cssText = "margin-top:8px";
    const valLabel = document.createElement("div");
    valLabel.textContent = "▼ scenario.js に貼る値";
    valLabel.style.cssText = "font-size:8px;color:#808080;margin-bottom:2px;font-family:sans-serif";
    const valDisp = document.createElement("pre");
    valDisp.style.cssText = [
        "font-size:9px;color:#90d0ff;margin:0;",
        "background:rgba(0,0,0,0.5);padding:5px 8px;border-radius:3px;",
        "white-space:pre-wrap;word-break:break-all;font-family:monospace",
    ].join("");
    valDisp.textContent = `bgSize: "auto ${sizeNum}%"\nbgPos:  "${posYNum === 0 ? "center top" : `center ${posYNum}px`}"`;
    valWrap.appendChild(valLabel);
    valWrap.appendChild(valDisp);
    panel.appendChild(valWrap);

    // ボタン行
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:8px;margin-top:10px";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存（この表情のみ）";
    saveBtn.style.cssText = "flex:1;padding:6px;background:#5a2090;color:#e0d0ff;border:1px solid #9060e0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:bold";
    saveBtn.addEventListener("click", () => {
        const newSize = `auto ${sizeNum}%`;
        const newPos  = posYNum === 0 ? "center top" : `center ${posYNum}px`;
        const adj = (() => { try { return JSON.parse(localStorage.getItem("scenarioPortraitAdj") || "{}"); } catch(e) { return {}; } })();
        adj[adjKey] = { bgSize: newSize, bgPos: newPos };
        localStorage.setItem("scenarioPortraitAdj", JSON.stringify(adj));
        saveBtn.textContent = "保存済 ✓";
        setTimeout(() => { saveBtn.textContent = "保存（この表情のみ）"; }, 1500);
    });

    const saveAllBtn = document.createElement("button");
    saveAllBtn.textContent = "全表情に適用";
    saveAllBtn.style.cssText = "flex:1;padding:6px;background:#204060;color:#a0d0ff;border:1px solid #4080a0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:bold";
    saveAllBtn.addEventListener("click", () => {
        const newSize = `auto ${sizeNum}%`;
        const newPos  = posYNum === 0 ? "center top" : `center ${posYNum}px`;
        const adj = (() => { try { return JSON.parse(localStorage.getItem("scenarioPortraitAdj") || "{}"); } catch(e) { return {}; } })();
        // 表情個別キーと、キャラ名キー（全表情の共通デフォルト）両方に保存
        adj[adjKey] = { bgSize: newSize, bgPos: newPos };
        adj[name]   = { bgSize: newSize, bgPos: newPos };
        localStorage.setItem("scenarioPortraitAdj", JSON.stringify(adj));
        saveAllBtn.textContent = "適用済 ✓";
        setTimeout(() => { saveAllBtn.textContent = "全表情に適用"; }, 1500);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "閉じる";
    closeBtn.style.cssText = "flex:1;padding:6px;background:#2a1040;color:#c0a0ff;border:1px solid #5030a0;border-radius:4px;font-size:10px;cursor:pointer";
    closeBtn.addEventListener("click", () => document.body.removeChild(overlay));

    btns.appendChild(saveBtn);
    btns.appendChild(saveAllBtn);
    btns.appendChild(closeBtn);
    panel.appendChild(btns);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
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
    // bg が指定された場合は背景画像を切り替える
    if (scene.bg) {
        bgImage.src    = scene.bg;
        topPanelBg.src = scene.bg;
    }
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
    hideBattlePreview();

    // CHARACTERS_DATA をディープコピーして live データとして使用
    // DB = STR+SIZ、MB = POW+INT をルルブ表から自動計算
    battleUnits = CHARACTERS_DATA.map(c => ({
        ...c,
        hp: c.maxHp,
        mp: c.maxMp,
        moved: false,
        acted: false,
        statusEffects: [],
        spells: { ...c.spells },
        skills: { ...c.skills },
        physicalBonus: calcBonusDice((c.str || 0) + (c.siz || 0)),
        magicBonus:    calcBonusDice((c.pow || 0) + (c.int || 0)),
    }));
    loadPortraitAdj(battleUnits); // 保存済みの位置調整を反映

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
    renderIdlePanel();
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
// イベントリスナー
// =============================================
scenarioModeButton.addEventListener("click", () => startChapter("prologue"));
dialogueBox.addEventListener("click", () => { if (scenarioActive) advanceScene(); });
battleModeButton.addEventListener("click",   setBattleMode);

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
// 盤面ズーム・パン
// =============================================
let mapZoom = 1, mapPanX = 0, mapPanY = 0;
const MAP_ZOOM_MIN = 0.6, MAP_ZOOM_MAX = 4.0;

function applyMapTransform() {
    battleCanvas.style.transform =
        `translate(${mapPanX}px,${mapPanY}px) scale(${mapZoom})`;
}

/** cx,cy は battleBoard 左上基準のズーム中心 */
function zoomAt(newZoom, cx, cy) {
    newZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, newZoom));
    const r = newZoom / mapZoom;
    mapPanX = cx - r * (cx - mapPanX);
    mapPanY = cy - r * (cy - mapPanY);
    mapZoom = newZoom;
    applyMapTransform();
}

// ドラッグ中かどうか（クリック判定の抑制に使う）
let _mapDragged = false;

// ── マウスホイール: ズーム ──
battleBoard.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = battleBoard.getBoundingClientRect();
    // gameScreen のスケールを考慮
    const gs   = parseFloat(document.getElementById("gameScreen").style.transform.replace(/[^0-9.]/g,"")) || 1;
    zoomAt(mapZoom * (e.deltaY < 0 ? 1.15 : 0.87),
           (e.clientX - rect.left) / gs,
           (e.clientY - rect.top)  / gs);
}, { passive: false });

// ── マウスドラッグ: パン ──
{
    let dragging = false, sx = 0, sy = 0;
    battleBoard.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        dragging = true; _mapDragged = false;
        sx = e.clientX - mapPanX;
        sy = e.clientY - mapPanY;
    });
    window.addEventListener("mousemove", e => {
        if (!dragging) return;
        const dx = e.clientX - sx - mapPanX;
        const dy = e.clientY - sy - mapPanY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _mapDragged = true;
        if (_mapDragged) {
            mapPanX = e.clientX - sx;
            mapPanY = e.clientY - sy;
            applyMapTransform();
        }
    });
    window.addEventListener("mouseup", () => { dragging = false; });
}

// ── タッチ: ピンチズーム + 1本指パン ──
{
    let t0x = 0, t0y = 0, tPanning = false;
    let pinchDist0 = 0, pinchZoom0 = 1;

    battleBoard.addEventListener("touchstart", e => {
        if (e.touches.length === 1) {
            t0x = e.touches[0].clientX - mapPanX;
            t0y = e.touches[0].clientY - mapPanY;
            tPanning = false; _mapDragged = false;
        } else if (e.touches.length === 2) {
            pinchDist0 = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
            pinchZoom0 = mapZoom;
        }
    }, { passive: true });

    battleBoard.addEventListener("touchmove", e => {
        if (e.touches.length === 1) {
            const nx = e.touches[0].clientX - t0x;
            const ny = e.touches[0].clientY - t0y;
            if (!tPanning && (Math.abs(nx - mapPanX) > 6 || Math.abs(ny - mapPanY) > 6)) {
                tPanning = true; _mapDragged = true;
            }
            if (tPanning) {
                mapPanX = nx; mapPanY = ny;
                applyMapTransform();
                e.preventDefault();
            }
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
            const rect = battleBoard.getBoundingClientRect();
            const gs   = parseFloat(document.getElementById("gameScreen").style.transform.replace(/[^0-9.]/g,"")) || 1;
            const cx   = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / gs;
            const cy   = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top)  / gs;
            zoomAt(pinchZoom0 * (dist / pinchDist0), cx, cy);
            e.preventDefault();
        }
    }, { passive: false });
}

// ── ズームボタン ──
document.getElementById("mapZoomIn")   .addEventListener("click", e => { e.stopPropagation(); zoomAt(mapZoom * 1.3, 195, 195); });
document.getElementById("mapZoomOut")  .addEventListener("click", e => { e.stopPropagation(); zoomAt(mapZoom * 0.77, 195, 195); });
document.getElementById("mapZoomReset").addEventListener("click", e => {
    e.stopPropagation();
    mapZoom = 1; mapPanX = 0; mapPanY = 0; applyMapTransform();
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
// ホーム画面
// =============================================
// ── ホームメニューカーソル ──────────────────────────────────
let _homeIdx = 0;

function _homeAllBtns() {
    return Array.from(document.querySelectorAll("#homeButtons .homeButton"));
}
function _homeMoveCursor(btn, instant) {
    if (!btn) return;
    if (instant) {
        homeMenuCursor.style.transition = "none";
        requestAnimationFrame(() => { homeMenuCursor.style.transition = ""; });
    }
    homeMenuCursor.style.top    = btn.offsetTop + "px";
    homeMenuCursor.style.height = btn.offsetHeight + "px";
    homeMenuCursor.style.opacity = "1";
    document.querySelectorAll("#homeButtons .homeButton").forEach(b => b.classList.remove("homeButtonActive"));
    btn.classList.add("homeButtonActive");
}
function _homeInitCursor() {
    const btns = _homeAllBtns();
    if (!btns.length) return;
    _homeIdx = 0;
    _homeMoveCursor(btns[0], true);
}

// マウスホバーでカーソル移動（disabled も乗れる）
[homeStartBtn, homeContinueBtn, homeSettingsBtn].forEach(btn => {
    btn.addEventListener("mouseenter", () => {
        _homeIdx = _homeAllBtns().indexOf(btn);
        _homeMoveCursor(btn, false);
    });
});

// キーボード（上下 + Enter）
document.addEventListener("keydown", e => {
    if (homeScreen.style.display === "none") return;
    const btns = _homeAllBtns();
    if (e.key === "ArrowDown") {
        _homeIdx = (_homeIdx + 1) % btns.length;
        _homeMoveCursor(btns[_homeIdx]);
        e.preventDefault();
    } else if (e.key === "ArrowUp") {
        _homeIdx = (_homeIdx - 1 + btns.length) % btns.length;
        _homeMoveCursor(btns[_homeIdx]);
        e.preventDefault();
    } else if (e.key === "Enter" && !btns[_homeIdx]?.disabled) {
        btns[_homeIdx]?.click();
    }
});

// マウスホイール
document.addEventListener("wheel", e => {
    if (homeScreen.style.display === "none") return;
    const btns = _homeAllBtns();
    _homeIdx = (_homeIdx + (e.deltaY > 0 ? 1 : -1) + btns.length) % btns.length;
    _homeMoveCursor(btns[_homeIdx]);
    e.preventDefault();
}, { passive: false });
// ────────────────────────────────────────────────────────────

function buildLoadingScreen() {
    const ls = document.getElementById('loadingScreen');
    if (!ls) return;
    const ns = 'http://www.w3.org/2000/svg';
    const cx = 150, cy = 150, R = 83;
    const sweep = 164, wTail = 2.5, wNeck = 22, N = 140;

    function mk(tag, attrs) {
        const e = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
        return e;
    }
    const rad = d => d * Math.PI / 180;
    const pt = (a, r) => [+(cx + r * Math.cos(rad(a))).toFixed(2), +(cy + r * Math.sin(rad(a))).toFixed(2)];
    const width = t => (wTail + (wNeck - wTail) * Math.pow(t, 0.8)) / 2;

    const svg = mk('svg', { viewBox: '0 0 300 300', id: 'loadingSvg' });
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `
        <radialGradient id="lsCG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(200,146,42,0.09)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
        <linearGradient id="lsBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2c2824"/>
            <stop offset="52%" stop-color="#121110"/>
            <stop offset="100%" stop-color="#000"/>
        </linearGradient>
        <filter id="lsGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
    `;
    svg.appendChild(defs);

    // 背景グロー
    svg.appendChild(mk('circle', { cx, cy, r: 140, fill: 'url(#lsCG)' }));

    // 外周リング（ゆっくり時計回り）
    const outerG = mk('g', { id: 'lsOuterRing' });
    outerG.appendChild(mk('circle', { cx, cy, r: 128, fill: 'none', stroke: 'rgba(200,146,42,0.28)', 'stroke-width': 0.8 }));
    for (let i = 0; i < 60; i++) {
        const a = i * 6 * Math.PI / 180, maj = i % 5 === 0;
        outerG.appendChild(mk('line', {
            x1: cx+(maj?121:125)*Math.cos(a), y1: cy+(maj?121:125)*Math.sin(a),
            x2: cx+128*Math.cos(a),           y2: cy+128*Math.sin(a),
            stroke: maj ? 'rgba(200,146,42,0.7)' : 'rgba(200,146,42,0.3)',
            'stroke-width': maj ? 1.5 : 0.7
        }));
    }
    svg.appendChild(outerG);

    // ローマ数字（固定）
    ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'].forEach((n, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const t = mk('text', {
            x: cx+110*Math.cos(a), y: cy+110*Math.sin(a),
            'text-anchor': 'middle', 'dominant-baseline': 'central',
            'font-family': '"Noto Serif JP", serif',
            'font-size': i%3===0 ? 10 : 7,
            fill: i%3===0 ? 'rgba(200,146,42,0.85)' : 'rgba(200,146,42,0.55)'
        });
        t.textContent = n;
        svg.appendChild(t);
    });

    // 蛇グループ（ゆっくり逆回転）
    const snakeG = mk('g', { id: 'lsSnakeGroup' });

    // 蛇1体を描画。A0=尻尾の開始角度、sweep°後に頭がA0+180°の相手の尻尾に噛みつく
    function serpent(A0) {
        const outer = [], inner = [], spine = [];
        for (let i = 0; i <= N; i++) {
            const t = i / N, a = A0 + t * sweep, w = width(t);
            outer.push(pt(a, R + w));
            inner.push(pt(a, R - w));
            spine.push(pt(a, R));
        }
        // 胴体
        let d = 'M' + outer[0];
        outer.forEach(p => d += 'L' + p);
        for (let i = inner.length - 1; i >= 0; i--) d += 'L' + inner[i];
        d += 'Z';
        snakeG.appendChild(mk('path', { d, fill: 'url(#lsBody)', stroke: '#c9a227', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));

        // 背骨ハイライト
        let sp = 'M' + spine[0];
        spine.forEach(p => sp += 'L' + p);
        snakeG.appendChild(mk('path', { d: sp, fill: 'none', stroke: '#f1d27a', 'stroke-width': 0.8, 'stroke-opacity': 0.28 }));

        // 鱗（V字シェブロン、体の曲線に沿って個別配置）
        for (let k = 3; k <= 16; k++) {
            const t = k / 18, a = A0 + t * sweep, w = width(t);
            if (w < 4) continue;
            const o = pt(a, R + w * 0.78), inn = pt(a, R - w * 0.78), ap = pt(a + 5, R);
            snakeG.appendChild(mk('path', {
                d: `M${o} L${ap} L${inn}`,
                fill: 'none', stroke: '#c9a227', 'stroke-width': 0.9, 'stroke-opacity': 0.75, 'stroke-linejoin': 'round'
            }));
        }

        // 頭（開いた顎）― パートナーの尻尾(A0+180°)に噛みついている
        const neckA = A0 + sweep, hw = wNeck / 2, bite = A0 + 180;
        const nO = pt(neckA, R + hw), nI = pt(neckA, R - hw);
        const upperFang = pt(bite + 4, R + 7);
        const lowerFang = pt(bite - 3, R - 7);
        const throat = pt(neckA + 9, R);
        snakeG.appendChild(mk('path', {
            d: `M${nO} L${upperFang} L${throat} L${lowerFang} L${nI} Z`,
            fill: 'url(#lsBody)', stroke: '#c9a227', 'stroke-width': 1.5, 'stroke-linejoin': 'round'
        }));

        // 目（蛇の向きに合わせて回転）
        const eye = pt(neckA + 8, R + hw * 0.55);
        snakeG.appendChild(mk('ellipse', {
            cx: eye[0], cy: eye[1], rx: 2.6, ry: 1.9, fill: '#b41e2c',
            transform: `rotate(${neckA + 8}, ${eye[0]}, ${eye[1]})`
        }));
        snakeG.appendChild(mk('ellipse', {
            cx: eye[0], cy: eye[1], rx: 0.7, ry: 1.6, fill: '#160000',
            transform: `rotate(${neckA + 8}, ${eye[0]}, ${eye[1]})`
        }));

        // 眉（厳しい表情）
        const b1 = pt(neckA + 3, R + hw * 0.95), b2 = pt(neckA + 12, R + hw * 0.75);
        snakeG.appendChild(mk('path', {
            d: `M${b1} L${b2}`,
            stroke: '#c9a227', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-opacity': 0.9, fill: 'none'
        }));

        // 宝石（蛇の中央付近）
        const [gx, gy] = pt(A0 + 82, R);
        snakeG.appendChild(mk('circle', { cx: gx, cy: gy, r: 4.5, fill: 'rgba(180,30,30,0.25)' }));
        snakeG.appendChild(mk('circle', { cx: gx, cy: gy, r: 2.2, fill: '#bb2020', stroke: 'rgba(255,100,100,0.45)', 'stroke-width': 0.7 }));
    }

    serpent(0);
    serpent(180);
    svg.appendChild(snakeG);

    // 内側装飾リング群（多重＋羅針盤風目盛り）
    svg.appendChild(mk('circle', { cx, cy, r: 68, fill: 'none', stroke: 'rgba(200,146,42,0.22)', 'stroke-width': 0.8 }));
    svg.appendChild(mk('circle', { cx, cy, r: 62, fill: 'none', stroke: 'rgba(200,146,42,0.12)', 'stroke-width': 0.5 }));
    // 4方位の長い目盛り
    for (let i = 0; i < 4; i++) {
        const a = i * 90 - 90;
        const [p1x, p1y] = pt(a, 71), [p2x, p2y] = pt(a, 58);
        svg.appendChild(mk('line', { x1: p1x, y1: p1y, x2: p2x, y2: p2y, stroke: 'rgba(200,146,42,0.55)', 'stroke-width': 1.3 }));
    }
    // 斜め4方位の短い目盛り
    for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45 - 90;
        const [p1x, p1y] = pt(a, 69), [p2x, p2y] = pt(a, 63);
        svg.appendChild(mk('line', { x1: p1x, y1: p1y, x2: p2x, y2: p2y, stroke: 'rgba(200,146,42,0.3)', 'stroke-width': 0.8 }));
    }
    // 内側4方位に菱形マーカー
    for (let i = 0; i < 4; i++) {
        const a = i * 90 - 90, [mx, my] = pt(a, 58), s = 3;
        svg.appendChild(mk('path', {
            d: `M${mx},${my-s} L${mx+s*0.65},${my} L${mx},${my+s} L${mx-s*0.65},${my} Z`,
            fill: 'rgba(200,146,42,0.45)', stroke: 'rgba(200,146,42,0.6)', 'stroke-width': 0.5
        }));
    }

    // 中央テキスト
    const lt = mk('text', { x: cx, y: cy+16, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-family': '"Noto Serif JP", serif', 'font-style': 'italic',
        'font-size': 13, fill: 'rgba(200,146,42,0.72)', 'letter-spacing': 3 });
    lt.textContent = 'Loading';
    svg.appendChild(lt);
    const st = mk('text', { x: cx, y: cy+30, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-family': '"M PLUS 1", sans-serif',
        'font-size': 5.5, fill: 'rgba(160,110,30,0.5)', 'letter-spacing': 3.5 });
    st.textContent = 'TEMPUS REGIT OMNIA';
    svg.appendChild(st);

    // 時計の針（2本・ダイヤ形）
    function buildHand(id, len, w, deco) {
        const hg = mk('g', { id });
        hg.appendChild(mk('path', {
            d: `M${cx},${cy+9} L${cx-w},${cy} L${cx},${cy-len} L${cx+w},${cy} Z`,
            fill: 'rgba(215,165,55,0.85)', stroke: '#f1d27a', 'stroke-width': 0.5, 'stroke-opacity': 0.5
        }));
        if (deco) {
            const ty = cy - len + 13;
            hg.appendChild(mk('path', {
                d: `M${cx},${ty-6} L${cx-3.5},${ty} L${cx},${ty+6} L${cx+3.5},${ty} Z`,
                fill: 'none', stroke: '#f1d27a', 'stroke-width': 0.9, 'stroke-opacity': 0.6
            }));
        }
        // 反対側の短い尾
        hg.appendChild(mk('path', {
            d: `M${cx-w*0.7},${cy} L${cx},${cy+12} L${cx+w*0.7},${cy} Z`,
            fill: 'rgba(200,146,42,0.4)'
        }));
        svg.appendChild(hg);
    }
    buildHand('lsHourHand', 46, 3.5, true);
    buildHand('lsMinuteHand', 60, 2, false);

    // 中心ピボット（多重リング）
    svg.appendChild(mk('circle', { cx, cy, r: 9,   fill: 'rgba(12,8,3,0.97)', stroke: 'rgba(200,146,42,0.45)', 'stroke-width': 1 }));
    svg.appendChild(mk('circle', { cx, cy, r: 5.5, fill: 'none', stroke: 'rgba(225,175,58,0.65)', 'stroke-width': 0.8 }));
    svg.appendChild(mk('circle', { cx, cy, r: 3,   fill: 'rgba(220,170,60,0.95)' }));

    ls.appendChild(svg);
}

function showHomeScreen() {
    homeScreen.style.display = "";
    homeScreen.style.opacity = "";
    homeScreen.style.pointerEvents = "";
    requestAnimationFrame(_homeInitCursor);
}
function hideHomeScreen(callback) {
    homeScreen.style.opacity = "0";
    homeScreen.style.pointerEvents = "none";
    setTimeout(() => {
        homeScreen.style.display = "none";
        if (callback) callback();
    }, 500);
}

homeStartBtn.addEventListener("click", () => {
    hideHomeScreen(() => startChapter("prologue"));
});

homeContinueBtn.addEventListener("click", () => {
    showMessage("SYSTEM", "セーブ機能は準備中です。");
});

homeSettingsBtn.addEventListener("click", () => {
    showMessage("SYSTEM", "設定は準備中です。");
});

// =============================================
// 初期化
// =============================================
createGrid();
setBattleMode();
renderIdlePanel();
buildLoadingScreen();  // ローディング画面を構築
showHomeScreen();      // ホーム画面（ローディング画面の下に先に準備）
scaleGame();

// 2.8秒後にローディング画面をフェードアウト
setTimeout(() => {
    const ls = document.getElementById('loadingScreen');
    ls.classList.add('ls-fade-out');
    setTimeout(() => { ls.style.display = 'none'; }, 1000);
}, 2800);

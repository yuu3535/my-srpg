// ============================================================
//  game.js  ―  自作SRPG メインロジック
//  シナリオモード / バトルモード統合
// ============================================================

// =============================================
// DOM 参照
// =============================================
const gameScreen         = document.getElementById("gameScreen");
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
const debugStoryBattleBtn = document.getElementById("debugStoryBattleBtn");
const debugTestBattleBtn  = document.getElementById("debugTestBattleBtn");
const homeContinueBtn    = document.getElementById("homeContinueBtn");
const homeSettingsBtn    = document.getElementById("homeSettingsBtn");
const homeMenuCursor     = document.getElementById("homeMenuCursor");
const dialogueBox        = document.getElementById("dialogueBox");
const topPanel           = document.getElementById("topPanel");
const bgImage            = document.getElementById("bgImage");
const topLayerVS         = document.getElementById("topLayerVS");
const vsConfirmBtn       = document.getElementById("vsConfirmBtn");
const vsCancelBtn        = document.getElementById("vsCancelBtn");
const landscapeBattleShell = document.getElementById("landscapeBattleShell");
const landscapeBattlefield = document.getElementById("landscapeBattlefield");
const landscapeUnitContent = document.getElementById("landscapeUnitContent");
const landscapeUnitEmpty   = document.getElementById("landscapeUnitEmpty");
const landscapeCommandList  = document.getElementById("landscapeCommandList");
const landscapeCommandPanel = document.getElementById("landscapeCommandPanel");
const landscapePhaseTitle  = document.getElementById("landscapePhaseTitle");
const landscapeTurnChip    = document.getElementById("landscapeTurnChip");
const landscapeHint        = document.getElementById("landscapeHint");
const lsForecast           = document.getElementById("lsForecast");
const dangerRangeToggle    = document.getElementById("dangerRangeToggle");
const battleBoardHome      = battleBoard.parentNode;
const battleBoardNext      = battleBoard.nextSibling;

// =============================================
// 定数
// =============================================
let GRID_COLS = 10;
let GRID_ROWS = 10;
let currentWalls = new Set(); // "col,row" 形式の通行不可タイル
let currentVoids = new Set(); // "col,row" 形式の存在しないタイル（マップ外）

/** タイルが壁またはvoidなら true */
function isTileBlocked(x, y) {
    const key = `${x},${y}`;
    return currentWalls.has(key) || currentVoids.has(key);
}

// 攻撃ボタンの命中ロールに使うスキル優先順（魔導はパッシブなので除外）
const ATTACK_SKILL_PRIORITY = [
    "武器", "爪", "ブレス", "キック", "こぶし", "尾撃", "噛む", "暗器", "投擲"
];

// 特技メニューに表示する戦闘ユーティリティスキル
const BATTLE_UTILITY_SKILLS = new Set([
    "応急手当", "医学", "戦闘指揮", "目星", "集中", "挑発", "庇う"
]);

const IMPLEMENTED_COMBAT_ART_IDS = new Set([
    "ryoudan",
    "zetsuei",
]);

const IMPLEMENTED_PASSIVE_SKILL_IDS = new Set([
    "sakki",
]);

// 回避スキル名
const EVADE_SKILL_NAME = "回避";

// 戦闘ルールv2: "formula" はSTR・DEX・SIZ・修練度式、"guaranteed" は命中確定。
const BATTLE_HIT_MODE = "formula";

// =============================================
// ゲームモード状態
// =============================================
let gameMode = "scenario";

const UI_THEMES = new Set(["orcus", "alstro", "mixed", "abyss"]);

function setUiTheme(theme = "orcus") {
    const nextTheme = UI_THEMES.has(theme) ? theme : "orcus";
    gameScreen?.setAttribute("data-theme", nextTheme);
}

const bootParams = new URLSearchParams(location.search);
const initialUiTheme = bootParams.get("theme");
const initialBattleId = bootParams.get("battle");
const forcedUiTheme = UI_THEMES.has(initialUiTheme) ? initialUiTheme : null;
if (forcedUiTheme) setUiTheme(forcedUiTheme);

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
let battleEntrySource = "none"; // scenario | test | manual | bootstrap
let scenarioCharacters = [];    // 現在ステージに立つキャラ [文字列 or {name,image}]

// =============================================
// バトル状態
// =============================================
let battleUnits     = [];   // CHARACTERS_DATA のディープコピー（生データ）
let selectedUnit        = null;
let actionState         = null; // null | "moving" | "attacking" | "throwing" | "magic"
let selectedSpell       = null;
let selectedAttackSkill = null;
let selectedCombatArtId = null;
let turnPhase       = "ally"; // "ally" | "enemy"
let turnCount       = 1;
let battleOver      = false;
let currentBattleId = "battle_tutorial"; // 現在の戦闘ID（初期値はチュートリアル）
let currentMapItems = []; // マップ上に配置されたアイテム { x, y, item: {id,name,type,value} }
let statusTargetId  = null; // ステータスモーダル表示対象
let currentStatusTab = "basic";
let _vsAttack = null; // VS確認待ち { attacker, target, isMagic, spell }
let partyState = createPartyState(CHARACTERS_DATA, calcBattleStats);

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
function createGrid(cols = 10, rows = 10, tiles = []) {
    GRID_COLS = cols;
    GRID_ROWS = rows;
    currentWalls.clear();
    currentVoids.clear();
    for (const t of tiles) {
        const key = `${t.x},${t.y}`;
        if (t.type === "wall") currentWalls.add(key);
        if (t.type === "void") currentVoids.add(key);
    }

    battleGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    battleGrid.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;
    battleGrid.innerHTML = "";

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement("div");
            const key  = `${col},${row}`;
            cell.className = "gridCell";
            if (currentWalls.has(key)) cell.classList.add("tileWall");
            if (currentVoids.has(key)) cell.classList.add("tileVoid");
            cell.dataset.row = row;
            cell.dataset.col = col;
            if (!currentVoids.has(key) && !currentWalls.has(key)) {
                cell.addEventListener("click", () => onCellClick(row, col));
            }
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
        cell.classList.remove("highlightMove", "highlightAttack", "allyActionRange", "enemyActionRange");
    }
}

let enemyDangerVisible = false;

function clearEnemyDangerRange() {
    for (const cell of battleGrid.children) cell.classList.remove("enemyDangerRange");
}

/** 全敵について「移動後に攻撃可能なセル」の和集合を返す。 */
function getEnemyDangerCells() {
    const danger = new Set();
    const enemies = battleUnits.filter(u => u.side === "enemy" && u.hp > 0);

    for (const enemy of enemies) {
        const origins = [{ x: enemy.x, y: enemy.y }];
        for (const cell of getMoveRange(enemy)) origins.push({ x: cell.col, y: cell.row });

        const range = Math.max(1, Number(enemy.attackRange) || 1);
        for (const origin of origins) {
            for (let dy = -range; dy <= range; dy++) {
                for (let dx = -range; dx <= range; dx++) {
                    const distance = Math.abs(dx) + Math.abs(dy);
                    if (distance === 0 || distance > range) continue;
                    const x = origin.x + dx;
                    const y = origin.y + dy;
                    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
                    if (isTileBlocked(x, y)) continue;
                    danger.add(`${x},${y}`);
                }
            }
        }
    }
    return danger;
}

function renderEnemyDangerRange() {
    clearEnemyDangerRange();
    if (!enemyDangerVisible || gameMode !== "battle") return;

    for (const key of getEnemyDangerCells()) {
        const [x, y] = key.split(",").map(Number);
        getCell(y, x)?.classList.add("enemyDangerRange");
    }
}

function setEnemyDangerVisible(visible) {
    enemyDangerVisible = !!visible;
    dangerRangeToggle?.classList.toggle("active", enemyDangerVisible);
    dangerRangeToggle?.setAttribute("aria-pressed", enemyDangerVisible ? "true" : "false");
    dangerRangeToggle?.setAttribute("title", enemyDangerVisible
        ? "敵全体の危険域を隠す"
        : "敵全体の危険域を表示");
    renderEnemyDangerRange();
}

function getActionRangeClass(unit) {
    return unit?.side === "enemy" ? "enemyActionRange" : "allyActionRange";
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

        // セル中央にトークン(12%×13%)を配置。セルサイズはグリッド列・行数から動的計算
        const cellW = 100 / GRID_COLS;
        const cellH = 100 / GRID_ROWS;
        el.style.left = `${(unit.x + 0.5) * cellW - 6}%`;
        el.style.top  = `${(unit.y + 0.5) * cellH - 6.5}%`;

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

    renderEnemyDangerRange();
    renderDeclarations();
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
                const actionLabel = getCombatArtData(selectedCombatArtId)?.name || atkSkillName;
                // VS 予測パネルを出して確認待ちにする（即攻撃しない）
                const pred = calculateBattlePrediction(selectedUnit, unit, atkSkillName, false, null);
                _vsAttack = { attacker: selectedUnit, target: unit, isMagic: false, spell: null };
                showBattlePreview(selectedUnit, unit, pred, actionLabel);
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
    const cell = getCell(unit.y, unit.x);
    if (!cell) return;
    const cellRect   = cell.getBoundingClientRect();
    const parentRect = radialMenu.parentElement.getBoundingClientRect();
    // #gameScreen に scale() が掛かっているため getBoundingClientRect は
    // スケール後の画面座標を返す。style.left/top はスケール前論理座標なので割り戻す
    const scale = parseFloat(
        document.getElementById("gameScreen").style.transform.replace(/[^0-9.]/g, "")
    ) || 1;
    const cx = (cellRect.left + cellRect.width  / 2 - parentRect.left) / scale;
    const cy = (cellRect.top  + cellRect.height / 2 - parentRect.top)  / scale;
    radialMenu.innerHTML = "";
    radialMenu.classList.remove("hidden");
    radialMenu.style.left = `${cx}px`;
    radialMenu.style.top  = `${cy}px`;
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
    if (isLandscapeBattleUi()) {
        hideRadialMenu();
        renderLandscapeCommandRail(unit);
        return;
    }
    initRadialAtUnit(unit);

    const cmds = [];
    if (!unit.moved) cmds.push({ label: "移動", sub: "MOVE" });
    if (!unit.acted) {
        cmds.push({ label: "攻撃", sub: "ATK" });
        cmds.push({ label: "魔法", sub: "MAG" });
        const hasUtility = Object.keys(unit.skills || {}).some(s => BATTLE_UTILITY_SKILLS.has(s));
        if (hasUtility) cmds.push({ label: "特技", sub: "SKL" });
        if ((unit.items?.length ?? 0) > 0) cmds.push({ label: "アイテム", sub: "ITEM" });
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
    if (isLandscapeBattleUi()) {
        actionState = null;
        clearHighlights();
        renderLandscapeSubCommandRail(unit, "attack");
        return;
    }
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
        ...getAvailableCombatArts(unit, "attack").map(art => {
            const baseSkill = getAttackSkillVal(unit);
            return {
                label: art.name,
                html: `${art.name}<span class="radialBtnSub">ART</span>`,
                attackSkillName: baseSkill.name,
                val: baseSkill.val,
                combatArtId: art.id,
                isBack: false,
            };
        }),
        { label: "戻る", html: `戻る<span class="radialBtnSub">BACK</span>`, isBack: true },
    ];

    const radius = Math.max(46, items.length * 9);
    buildRadialButtons(items, radius, (item) => {
        if (item.isBack) { hideForecastLayer(); renderBattleCommands(unit); return; }
        selectedAttackSkill = item.attackSkillName || item.label;
        selectedCombatArtId = item.combatArtId || null;
        hideRadialMenu();
        if (selectedAttackSkill === "投擲") {
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
    if (isLandscapeBattleUi()) {
        actionState = null;
        clearHighlights();
        renderLandscapeSubCommandRail(unit, "skill");
        return;
    }
    initRadialAtUnit(unit);

    const utilityEntries = Object.entries(unit.skills || {})
        .filter(([name]) => BATTLE_UTILITY_SKILLS.has(name));
    const selfArts = getAvailableCombatArts(unit, "self");

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
    items.splice(items.length - 1, 0, ...selfArts.map(art => ({
        label: art.name,
        html: `${art.name}<span class="radialBtnSub">${getCombatArtUseText(unit, art)}</span>`,
        combatArtId: art.id,
        isBack: false,
    })));

    const radius = Math.max(50, items.length * 10);
    buildRadialButtons(items, radius, (item) => {
        if (item.isBack) { renderBattleCommands(unit); return; }
        hideRadialMenu();
        if (item.combatArtId) {
            executeSelfCombatArt(unit, item.combatArtId);
            return;
        }
        executeSkill(unit, item.skillName, item.val, item.skillName);
    });
}

/** 魔法選択ラジアル（2段目） */
function showMagicRadial(unit) {
    if (isLandscapeBattleUi()) {
        actionState = null;
        clearHighlights();
        renderLandscapeSubCommandRail(unit, "magic");
        return;
    }
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
    selectedAttackSkill = null;
    selectedCombatArtId = null;
    clearHighlights();

    const el = document.getElementById(`unit_${unit.id}`);
    if (el) el.classList.add("unitSelected");

    renderBattleCommands(unit);
    activateLandscapeDefaultMove(unit);
    syncLandscapeBattleUi(unit);
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
    selectedCombatArtId = null;
    clearHighlights();
    hideRadialMenu();
    hideForecastLayer();
    hideBattlePreview();
    renderIdlePanel();
    syncLandscapeBattleUi(null);
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
            if (isTileBlocked(nx, ny)) continue;
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
    const sideClass = getActionRangeClass(unit);
    for (const { col, row } of getMoveRange(unit)) {
        const cell = getCell(row, col);
        if (cell) cell.classList.add("highlightMove", sideClass);
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
    syncLandscapeBattleUi(unit);

    // アイテム拾得チェック
    const pickedIdx = currentMapItems.findIndex(mi => mi.x === col && mi.y === row);
    if (pickedIdx !== -1) {
        const picked = currentMapItems.splice(pickedIdx, 1)[0];
        if (!unit.items) unit.items = [];
        unit.items.push(picked.item);
        renderMapItems();
        showMessage("SYSTEM", `${unit.name}は ${picked.item.name} を拾った！`);
        addLog(`・${unit.name}は ${picked.item.name} を拾った`);
    }

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
    const sideClass = getActionRangeClass(unit);
    const range = unit.attackRange;
    for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > range) continue;
            if (dx === 0 && dy === 0) continue;
            const nx = unit.x + dx, ny = unit.y + dy;
            if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
            if (isTileBlocked(nx, ny)) continue;
            const cell = getCell(ny, nx);
            if (cell) cell.classList.add("highlightAttack", sideClass);
        }
    }
}

/** 投擲射程のハイライト：上下左右の直線4マス以内 */
function highlightThrowRange(unit) {
    clearHighlights();
    const sideClass = getActionRangeClass(unit);
    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
        for (let i = 1; i <= 4; i++) {
            const nx = unit.x + dx * i;
            const ny = unit.y + dy * i;
            if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) break;
            if (isTileBlocked(nx, ny)) break;
            const cell = getCell(ny, nx);
            if (cell) cell.classList.add("highlightAttack", sideClass);
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

function clampHitRate(rate) {
    return Math.max(20, Math.min(95, Math.round(rate)));
}

function getAccuracyStatusModifier(unit) {
    return (unit.statusEffects || [])
        .filter(effect => effect.type === "accuracyDown")
        .reduce((sum, effect) => sum + Number(effect.value || 0) * 5, 0);
}

function getEvasionStatusModifier(unit) {
    return (unit.statusEffects || [])
        .filter(effect => effect.type === "evasionUp" || effect.type === "evasionBonus")
        .reduce((sum, effect) => sum + Number(effect.value || 0), 0);
}

function unitHasPassiveSkill(unit, skillId) {
    return getAvailablePassiveSkills(unit).some(skill => skill.id === skillId);
}

function canUseVoluntaryPassive(options = {}) {
    return !options.isCounter;
}

function getPassiveAccuracyModifier(attacker, defender, options = {}) {
    if (unitHasPassiveSkill(attacker, "sakki") && canUseVoluntaryPassive(options)) {
        return Number(getPassiveSkillData("sakki")?.effect?.hitBonus || 10);
    }
    return 0;
}

function getPassiveEvasionModifier(attacker, defender, options = {}) {
    if (unitHasPassiveSkill(attacker, "sakki") && canUseVoluntaryPassive(options)) {
        return -Number(getPassiveSkillData("sakki")?.effect?.targetEvasionPenalty || 10);
    }
    return 0;
}

function getBattleHitResult(attacker, defender, attackSkill, targetStunned = false, options = {}) {
    if (targetStunned || BATTLE_HIT_MODE === "guaranteed") {
        return { rate: 100, roll: null, isHit: true, note: targetStunned ? "スタン中：自動命中" : "v2命中確定" };
    }
    const attackerStats = calcBattleStats(attacker);
    const defenderStats = calcBattleStats(defender);
    const evadeSkill = getEvadeSkillVal(defender);
    const accuracyModifier = getAccuracyStatusModifier(attacker)
        + getPassiveAccuracyModifier(attacker, defender, options);
    const evasionModifier = getEvasionStatusModifier(defender)
        + getPassiveEvasionModifier(attacker, defender, options);
    const accuracy = accuracyScore(attackerStats.raw.dex, attackSkill, accuracyModifier);
    const evasion = evasionScore(
        defenderStats.raw.str,
        defenderStats.raw.dex,
        defenderStats.raw.siz,
        evadeSkill,
        evasionModifier
    );
    const rate = battleHitRate(attackerStats, defenderStats, attackSkill, evadeSkill, {
        accuracy: accuracyModifier,
        evasion: evasionModifier,
    });
    const shouldRoll = options.roll !== false;
    const roll = shouldRoll ? Math.floor(Math.random() * 100) + 1 : null;
    return {
        rate,
        roll,
        isHit: shouldRoll ? roll <= rate : true,
        accuracy,
        evasion,
        note: shouldRoll ? `${roll}/${rate}%` : `予測/${rate}%`,
    };
}

const OFFENSIVE_MAGIC_EFFECTS = new Set([
    "magicDamage", "areaDamage", "break", "stun", "accuracyDown",
    "nightmare", "gravityField",
]);

function magicUsesAccuracyCheck(spell) {
    return spell?.targetType === "enemy" || OFFENSIVE_MAGIC_EFFECTS.has(spell?.effectType);
}

function getMagicHitResult(caster, target, spell, successValue, options = {}) {
    if (!magicUsesAccuracyCheck(spell)) {
        return { rate: 100, roll: null, isHit: true, note: "補助魔法：自動成功" };
    }
    const targetStunned = (target?.statusEffects || []).some(effect => effect.type === "stun");
    return getBattleHitResult(caster, target, successValue, targetStunned, options);
}

function applyBarrierDamage(target, rawDmg, breakBarrier = false) {
    const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
    if (!barrier || barrier.value <= 0) {
        return { damage: rawDmg, note: "" };
    }

    const absorbed = Math.min(barrier.value, rawDmg);
    const damage = rawDmg - absorbed;
    if (breakBarrier) {
        target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
        return { damage, note: `（装甲${absorbed}吸収→完全破壊）` };
    }

    barrier.value -= absorbed;
    if (barrier.value <= 0) {
        target.statusEffects = target.statusEffects.filter(e => e.type !== "barrier");
        return { damage, note: `（装甲${absorbed}吸収→砕け散った）` };
    }
    return { damage, note: `（装甲${absorbed}吸収 残${barrier.value}）` };
}

function calculatePhysicalDamage(attacker, target, options = {}) {
    const atkStats = calcBattleStats(attacker);
    const defStats = calcBattleStats(target);
    const weaponPower = getWeaponPower(attacker);
    const powerBonus = Number(options.powerBonus || 0);
    const attackValue = atkStats.power + weaponPower + powerBonus;
    const masteryBonus = masteryDamageBonus(attacker.skills?.["武道"]);
    const artNote = masteryBonus > 0 ? `（武道+${masteryBonus}）` : "";
    const raw = physicalDamage({ atk: attackValue }, defStats, 0);
    const mastered = raw + masteryBonus;
    const damage = options.half ? Math.max(1, Math.floor(mastered / 2)) : mastered;
    return { damage, raw: mastered, power: atkStats.power, weaponPower, powerBonus, armor: defStats.armor, masteryBonus, artNote };
}

function calculateMagicDamage(caster, target, spell, options = {}) {
    const atkStats = calcBattleStats(caster);
    const defStats = calcBattleStats(target);
    const spellPower = getSpellPower(spell) + Number(options.magicPowerBonus || 0);
    const raw = magicalDamage(atkStats, defStats, spellPower);
    const masteryBonus = masteryDamageBonus(caster.skills?.["魔導"]);
    const mastered = raw + masteryBonus;
    const damage = options.half ? Math.max(1, Math.floor(mastered / 2)) : mastered;
    const masteryNote = masteryBonus > 0 ? `（魔導+${masteryBonus}）` : "";
    return { damage, raw: mastered, magic: atkStats.magic, spellPower, ward: defStats.ward, masteryBonus, masteryNote };
}

function getCounterRate(unit) {
    return Math.max(0, Math.min(100, getEffectiveCourage(unit)));
}

function getEffectiveCourage(unit) {
    const base = calcBattleStats(unit).raw.courage;
    return Math.max(0, Number(base || 0) - Number(unit?.battleCourageLoss || 0));
}

function getCriticalStatusModifier(unit, type) {
    return (unit?.statusEffects || [])
        .filter(effect => effect.type === type)
        .reduce((sum, effect) => sum + Number(effect.value || 0), 0);
}

function getCriticalRate(attacker, defender) {
    const defenderApp = calcBattleStats(defender).raw.app;
    return criticalRate(getEffectiveCourage(attacker), attacker.level, defenderApp, {
        critical: Number(attacker.criticalBonus || 0)
            + getCriticalStatusModifier(attacker, "criticalBonus"),
        criticalAvoidance: Number(defender.criticalAvoidanceBonus || 0)
            + getCriticalStatusModifier(defender, "criticalAvoidance"),
    });
}

function rollCritical(attacker, defender, baseDamage) {
    const rate = getCriticalRate(attacker, defender);
    const roll = Math.floor(Math.random() * 100) + 1;
    const isCritical = roll <= rate;
    if (isCritical) showCriticalCutIn(attacker);
    return {
        rate,
        roll,
        isCritical,
        damage: isCritical ? criticalDamage(baseDamage) : baseDamage,
    };
}

function canCounter(unit) {
    return (unit.counterMode ?? "auto") !== "none" && getCounterRate(unit) > 0;
}

function getCombatArtData(artId) {
    if (!artId || typeof COMBAT_ARTS === "undefined") return null;
    return COMBAT_ARTS[artId] ? { id: artId, ...COMBAT_ARTS[artId] } : null;
}

function isCombatArtImplemented(artId) {
    return IMPLEMENTED_COMBAT_ART_IDS.has(artId);
}

function getAvailableCombatArts(unit, base = "attack") {
    if (!unit || typeof COMBAT_ARTS === "undefined") return [];
    const known = new Set([
        ...(unit.learnedArts || []),
        ...(unit.equippedArts || []),
    ]);

    for (const [id, art] of Object.entries(COMBAT_ARTS)) {
        if (!isCombatArtImplemented(id)) continue;
        if (art.base !== base) continue;
        const rank = Number(unit.skillRanks?.[art.track] ?? unit.skills?.[art.track] ?? 0);
        if (rank >= 6) known.add(id);
    }

    return [...known]
        .filter(id => isCombatArtImplemented(id))
        .map(id => getCombatArtData(id))
        .filter(art => art && art.base === base);
}

function getCombatArtUseText(unit, art) {
    const maxUses = Number(art?.cost?.uses || 0);
    if (maxUses <= 0) return "ART";
    const used = Number(unit?.combatArtUses?.[art.id] || 0);
    return `${Math.max(0, maxUses - used)}/${maxUses}`;
}

function previewBarrierDamage(target, rawDmg, breakBarrier = false) {
    const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
    if (!barrier || barrier.value <= 0) {
        return { damage: rawDmg, note: "" };
    }
    const absorbed = Math.min(barrier.value, rawDmg);
    const damage = rawDmg - absorbed;
    if (breakBarrier) return { damage, note: `（結界${absorbed}吸収→完全破壊）` };
    if (barrier.value - absorbed <= 0) return { damage, note: `（結界${absorbed}吸収→砕け散った）` };
    return { damage, note: `（結界${absorbed}吸収 残${barrier.value - absorbed}）` };
}

function createActionTargetResult(context, target) {
    return {
        context,
        target,
        hit: context.hit,
        critical: null,
        calculation: null,
        barrier: null,
        baseDamage: 0,
        finalDamage: 0,
        criticalDamage: 0,
        actualDamage: 0,
        baseAfterBarrier: 0,
        critAfterBarrier: 0,
        modifiers: {
            finalDamageBonus: 0,
            damageMultiplier: 1,
            criticalAvoidanceBonus: 0,
        },
        notes: [],
    };
}

function applyTargetDamageModifiers(context, targetResult, baseDamage) {
    const actionBonus = Number(context.modifiers.finalDamageBonus || 0);
    const targetBonus = Number(targetResult.modifiers.finalDamageBonus || 0);
    const actionMult = Number(context.modifiers.damageMultiplier || 1);
    const targetMult = Number(targetResult.modifiers.damageMultiplier || 1);
    const adjusted = Math.floor((Number(baseDamage || 0) + actionBonus + targetBonus) * actionMult * targetMult);
    return Math.max(0, adjusted);
}

function getContextCriticalRate(context, defender) {
    const defenderApp = calcBattleStats(defender).raw.app;
    return criticalRate(getEffectiveCourage(context.attacker), context.attacker.level, defenderApp, {
        critical: Number(context.attacker.criticalBonus || 0)
            + getCriticalStatusModifier(context.attacker, "criticalBonus")
            + Number(context.modifiers.criticalBonus || 0),
        criticalAvoidance: Number(defender.criticalAvoidanceBonus || 0)
            + getCriticalStatusModifier(defender, "criticalAvoidance"),
    });
}

function rollContextCritical(context, defender, baseDamage, shouldRoll) {
    const rate = getContextCriticalRate(context, defender);
    const critDamage = criticalDamage(baseDamage);
    if (!shouldRoll) {
        return { rate, roll: null, isCritical: false, damage: baseDamage, critDamage };
    }
    const roll = Math.floor(Math.random() * 100) + 1;
    const isCritical = roll <= rate;
    if (isCritical && !context.isPreview) showCriticalCutIn(context.attacker);
    return {
        rate,
        roll,
        isCritical,
        damage: isCritical ? critDamage : baseDamage,
        critDamage,
    };
}

function completeDamageContext(context, targetResult, calculation, options = {}) {
    targetResult.calculation = calculation;
    targetResult.baseDamage = calculation.damage;
    runBattleActionHooks("beforeDamaged", context, targetResult);

    const finalBaseDamage = applyTargetDamageModifiers(context, targetResult, calculation.damage);
    const critical = rollContextCritical(context, targetResult.target, finalBaseDamage, options.rollCritical !== false);
    const finalDamage = critical.isCritical ? critical.damage : finalBaseDamage;
    const barrier = options.commitBarrier
        ? applyBarrierDamage(targetResult.target, finalDamage, !!options.breakBarrier)
        : previewBarrierDamage(targetResult.target, finalDamage, !!options.breakBarrier);

    targetResult.critical = critical;
    targetResult.barrier = barrier;
    targetResult.finalDamage = finalDamage;
    targetResult.criticalDamage = critical.critDamage;
    targetResult.actualDamage = barrier.damage;
    targetResult.baseAfterBarrier = previewBarrierDamage(targetResult.target, finalBaseDamage, !!options.breakBarrier).damage;
    targetResult.critAfterBarrier = previewBarrierDamage(targetResult.target, critical.critDamage, !!options.breakBarrier).damage;

    context.critical = critical;
    context.damage.baseDamage = targetResult.baseDamage;
    context.damage.finalDamage = targetResult.finalDamage;
    context.damage.criticalDamage = targetResult.criticalDamage;
    context.damage.actualDamage = targetResult.actualDamage;
    context.damage.baseAfterBarrier = targetResult.baseAfterBarrier;
    context.damage.critAfterBarrier = targetResult.critAfterBarrier;
    context.targetResults.push(targetResult);

    return targetResult;
}

function createPhysicalActionContext(attacker, target, options = {}) {
    const combatArt = getCombatArtData(options.combatArtId);
    const context = options.context || createBattleActionContext({
        attacker,
        target,
        targets: options.targets || [target],
        actionType: options.actionType || "attack",
        damageType: "physical",
        isCounter: !!options.isCounter,
        isPreview: !!options.isPreview,
        combatArtId: combatArt?.id || null,
        combatArt,
        attackSkillName: options.attackSkillName || null,
        attackSkillValue: options.attackSkillValue ?? null,
        half: !!options.half,
        hit: options.hit || null,
    });
    context.target = target;
    if (!context.targets.includes(target)) context.targets.push(target);
    if (!options.context) runBattleActionHooks("beforeAttack", context, { target });
    const targetResult = createActionTargetResult(context, target);
    const calculation = calculatePhysicalDamage(attacker, target, {
        half: !!options.half,
        powerBonus: context.modifiers.physicalPowerBonus,
    });
    return completeDamageContext(context, targetResult, calculation, options);
}

function createMagicActionContext(caster, target, spell, options = {}) {
    const context = options.context || createBattleActionContext({
        attacker: caster,
        target,
        targets: options.targets || [target],
        actionType: "magic",
        damageType: "magic",
        isMagic: true,
        isCounter: !!options.isCounter,
        isPreview: !!options.isPreview,
        spell,
        half: !!options.half,
        hit: options.hit || null,
    });
    context.target = target;
    if (!context.targets.includes(target)) context.targets.push(target);
    if (!options.context) runBattleActionHooks("beforeAttack", context, { target });
    const targetResult = createActionTargetResult(context, target);
    const calculation = calculateMagicDamage(caster, target, spell, {
        half: !!options.half,
        magicPowerBonus: context.modifiers.magicPowerBonus,
    });
    return completeDamageContext(context, targetResult, calculation, {
        ...options,
        breakBarrier: options.breakBarrier || spell?.effectType === "break",
    });
}

function finishDamageHooks(context, targetResult, hpBefore) {
    runBattleActionHooks("afterDamage", context, targetResult);
    if (hpBefore > 0 && targetResult.target.hp <= 0) {
        runBattleActionHooks("onKill", context, targetResult);
    }
    runBattleActionHooks("afterAttack", context, targetResult);
}

registerBattleActionHook("beforeAttack", {
    id: "combatArt:ryoudan",
    oncePerAction: true,
    run(context) {
        if (context.combatArtId !== "ryoudan" || context.damageType !== "physical") return false;
        context.modifiers.physicalPowerBonus += 5;
        context.usageCounts.ryoudan = (context.usageCounts.ryoudan || 0) + 1;
        context.notes.push("両断:攻撃+5");
        return true;
    },
});

registerBattleActionHook("beforeAttack", {
    id: "combatArt:zetsuei",
    oncePerAction: true,
    run(context) {
        if (context.combatArtId !== "zetsuei" || context.actionType !== "self") return false;
        const unit = context.attacker;
        if (!unit) return false;
        const bonus = Number(context.combatArt?.effect?.evasionBonus ?? 20);
        const duration = Number(context.combatArt?.effect?.duration ?? 1);
        unit.statusEffects = (unit.statusEffects || [])
            .filter(effect => effect.source !== "combatArt:zetsuei");
        unit.statusEffects.push({
            type: "evasionUp",
            value: bonus,
            duration,
            source: "combatArt:zetsuei",
            name: context.combatArt?.name || "zetsuei",
        });
        context.usageCounts.zetsuei = (context.usageCounts.zetsuei || 0) + 1;
        context.notes.push(`zetsuei:evasion+${bonus}`);
        return true;
    },
});

registerBattleActionHook("beforeAttack", {
    id: "passive:sakki",
    oncePerAction: true,
    run(context) {
        if (!unitHasPassiveSkill(context.attacker, "sakki") || !canUseVoluntaryPassive(context)) return false;
        context.modifiers.criticalBonus += Number(getPassiveSkillData("sakki")?.effect?.critBonus || 10);
        context.notes.push("sakki:crit+10");
        return true;
    },
});

function executeSelfCombatArt(unit, artId) {
    const art = getCombatArtData(artId);
    if (!unit || !art || art.base !== "self" || !isCombatArtImplemented(art.id)) return false;
    const maxUses = Number(art.cost?.uses || 0);
    const used = Number(unit.combatArtUses?.[art.id] || 0);
    if (maxUses > 0 && used >= maxUses) {
        showMessage("SYSTEM", `${art.name}: no uses left`);
        addLog(`・${unit.name} cannot use ${art.name}: ${used}/${maxUses}`);
        return false;
    }

    const context = createBattleActionContext({
        attacker: unit,
        target: unit,
        targets: [unit],
        actionType: "self",
        damageType: "support",
        combatArtId: art.id,
        combatArt: art,
    });
    runBattleActionHooks("beforeAttack", context, { target: unit });
    runBattleActionHooks("afterAttack", context, { target: unit });
    if (maxUses > 0) {
        unit.combatArtUses = unit.combatArtUses || {};
        unit.combatArtUses[art.id] = used + 1;
    }
    addLog(`・${unit.name} uses ${art.name}`);
    showMessage("SYSTEM", `${unit.name}: ${art.name}`);
    renderUnits();
    endUnitTurn(unit);
    return true;
}

function isLandscapeBattleUi() {
    return gameMode === "battle"
        && gameScreen.dataset.mode === "battle"
        && window.innerWidth > window.innerHeight
        && window.innerWidth <= 1200;
}

function syncLandscapeBattleMount() {
    if (!landscapeBattleShell || !landscapeBattlefield) return;
    const active = isLandscapeBattleUi();
    landscapeBattleShell.classList.toggle("active", active);
    landscapeBattleShell.setAttribute("aria-hidden", active ? "false" : "true");

    if (active && battleBoard.parentNode !== landscapeBattlefield) {
        landscapeBattlefield.appendChild(battleBoard);
    } else if (!active && battleBoard.parentNode === landscapeBattlefield) {
        battleBoardHome.insertBefore(battleBoard, battleBoardNext);
    }
    sizeLandscapeBattleCanvas();
}

/** 横画面時：マップの縦横比を GRID_COLS:GRID_ROWS に合わせて中央配置する。
 *  デザイン空間（844×390）内の中央マップ領域に収める。縦画面時は CSS に戻す */
function sizeLandscapeBattleCanvas() {
    if (!battleCanvas) return;
    if (!isLandscapeBattleUi()) {
        battleCanvas.style.width  = "";
        battleCanvas.style.height = "";
        battleCanvas.style.left   = "";
        battleCanvas.style.top    = "";
        return;
    }
    // コマンドはモーダル型オーバーレイになったため、マップは左パネル以外を広く使える
    // 844 - 左パネル150 - gap/padding ≒ 660、390 - 上下帯 ≒ 300
    const availW = 650, availH = 300;
    const inset = 32; // battleGrid の上下左右 16px ずつ（セルを正方形に保つため差し引く）
    const ratio = GRID_COLS / GRID_ROWS;
    let innerH = availH - inset, innerW = innerH * ratio;
    if (innerW > availW - inset) { innerW = availW - inset; innerH = innerW / ratio; }
    const w = innerW + inset, h = innerH + inset;
    battleCanvas.style.width  = `${Math.round(w)}px`;
    battleCanvas.style.height = `${Math.round(h)}px`;
    battleCanvas.style.left   = `calc(50% - ${Math.round(w / 2)}px)`;
    battleCanvas.style.top    = `calc(50% - ${Math.round(h / 2)}px)`;
}

function unitStatusText(unit) {
    if (!unit.statusEffects || unit.statusEffects.length === 0) return "通常";
    const nm = { burn:"火傷", stun:"スタン", barrier:"結界", counter:"カウンター",
                 accuracyDown:"命中低下", gravityField:"重力場", support:"強化", evasionUp:"回避↑" };
    return unit.statusEffects.map(e => nm[e.type] || e.type).join(" ");
}

function activateLandscapeDefaultMove(unit) {
    if (!isLandscapeBattleUi()
        || !unit
        || battleOver
        || turnPhase !== "ally"
        || unit.side !== "ally"
        || unit.moved) {
        return false;
    }

    actionState = "moving";
    selectedSpell = null;
    selectedAttackSkill = null;
    hideForecastLayer();
    highlightMoveRange(unit);
    setLandscapeHint(`${unit.name}の移動先を選べます。行動するなら右のコマンドを選んでください。`);
    return true;
}

function renderLandscapeUnitPanel(unit = selectedUnit) {
    if (!landscapeUnitContent || !landscapeUnitEmpty) return;
    if (!isLandscapeBattleUi() || !unit) {
        landscapeUnitContent.innerHTML = "";
        landscapeUnitEmpty.style.display = "";
        return;
    }

    const hpPct = unit.maxHp ? Math.max(0, Math.min(100, unit.hp / unit.maxHp * 100)) : 0;
    const mpPct = unit.maxMp ? Math.max(0, Math.min(100, unit.mp / unit.maxMp * 100)) : 0;
    const src = getPortraitSrc(unit) || unit.tokenImage || "";
    const stats = calcBattleStats(unit);
    const declLabel = unit.side === "enemy" ? getDeclarationLabel(enemyDeclarations.get(unit.id)) : null;
    landscapeUnitEmpty.style.display = "none";
    landscapeUnitContent.innerHTML = `
        <div class="lsUnitPortrait" style="${src ? `background-image:url('${src}')` : ""}"></div>
        <div class="lsUnitBody">
            <div class="lsUnitName"><b>${unit.name}</b><span>LV ${unit.level}</span></div>
            <div class="lsBarRow"><span>HP</span><div class="lsBar hp"><i style="width:${hpPct}%"></i></div><b>${unit.hp}/${unit.maxHp}</b></div>
            <div class="lsBarRow"><span>MP</span><div class="lsBar mp"><i style="width:${mpPct}%"></i></div><b>${unit.mp}/${unit.maxMp}</b></div>
            <div class="lsStatGrid">
                <div><b>力</b><span>${stats.power}</span></div>
                <div><b>魔力</b><span>${stats.magic}</span></div>
                <div><b>物防</b><span>${stats.armor}</span></div>
                <div><b>魔防</b><span>${stats.ward}</span></div>
                <div><b>移動</b><span>${unit.move}マス</span></div>
                <div><b>状態</b><span>${unitStatusText(unit)}</span></div>
            </div>
            ${declLabel ? `<div class="lsPrediction">TARGET: ${declLabel}</div>` : ""}
        </div>
    `;
}

function setLandscapeHint(text) {
    if (landscapeHint) landscapeHint.textContent = text || "敵の宣言を確認し、攻撃線から外れるか、移動先を塞いで行動を崩せます。";
}

function renderLandscapeHeader() {
    if (!landscapePhaseTitle || !landscapeTurnChip) return;
    const phase = turnPhase === "ally" ? "味方フェーズ" : "敵フェーズ";
    landscapePhaseTitle.textContent = battleOver ? "戦闘終了" : phase;
    const declCount = enemyDeclarations?.size || 0;
    landscapeTurnChip.textContent = `TURN ${turnCount}　敵行動予告 ${declCount}`;
}

function getLandscapeCommands(unit) {
    const commands = [];
    if (!unit.acted) commands.push({ label: "攻撃", active: actionState === "attacking" || actionState === "throwing" });
    if (!unit.acted && Object.keys(unit.spells || {}).length > 0) commands.push({ label: "魔法", active: actionState === "magic" });
    if (!unit.acted && Object.keys(unit.skills || {}).some(s => BATTLE_UTILITY_SKILLS.has(s))) commands.push({ label: "特技" });
    if ((unit.items?.length ?? 0) > 0) commands.push({ label: "持ち物" });
    commands.push({ label: "待機" });
    commands.push({ label: "詳細" });
    return commands;
}

/** レールのボタンを「時計の針」のような弧状に配置する。
 *  軸（ハブ）は左＝盤面側。各ボタンは左端を支点に回転する針で、
 *  上から下へ 1時→3時→5時 と時計回りに掃く「)」型の弧を描く */
function applyLandscapeRailArc() {
    if (!landscapeCommandList) return;
    const btns = [...landscapeCommandList.children];
    const n = btns.length;
    if (!n) return;
    const mid = (n - 1) / 2;
    btns.forEach((btn, i) => {
        const t = i - mid;                                    // 中央からの段数
        const rot = Math.max(-24, Math.min(24, t * 6.5));     // 針の傾き
        const dx  = (mid - Math.abs(t)) * 5;                  // 弧の膨らみ（中央=3時が最も右）
        // transform本体はCSS側（--rot/--dx参照）。選択時の「カチッ」をCSSで足せるようにする
        btn.style.setProperty("--rot", `${rot.toFixed(1)}deg`);
        btn.style.setProperty("--dx", `${dx.toFixed(1)}px`);
        btn.style.setProperty("--tick-delay", `${i * 36}ms`);   // 針が順にカチッと収まる
    });
}

function setLandscapeRailVisible(visible) {
    landscapeCommandPanel?.classList.toggle("railHidden", !visible);
}

function isLandscapeForecastOpen() {
    return !!lsForecast && !lsForecast.classList.contains("hidden");
}

function setLandscapeForecastOpen(open) {
    landscapeBattleShell?.classList.toggle("forecast-open", open);
    gameScreen?.classList.toggle("forecast-open", open);
    lsForecast?.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) setLandscapeRailVisible(false);
    sizeLandscapeBattleCanvas();
}

function renderLandscapeCommandRail(unit = selectedUnit) {
    if (!landscapeCommandList) return;
    if (!isLandscapeBattleUi()) {
        landscapeCommandList.innerHTML = "";
        return;
    }

    if (isLandscapeForecastOpen()) {
        landscapeCommandList.innerHTML = "";
        setLandscapeRailVisible(false);
        return;
    }

    // モーダル型：行動できるユニットを選んでいない間は針ごと隠す
    if (!unit || battleOver || turnPhase !== "ally" || unit.side !== "ally") {
        landscapeCommandList.innerHTML = "";
        setLandscapeRailVisible(false);
        return;
    }
    setLandscapeRailVisible(true);

    const commands = getLandscapeCommands(unit);
    landscapeCommandList.innerHTML = "";
    commands.forEach(cmd => {
        const btn = document.createElement("button");
        btn.className = `lsCommandBtn${cmd.active ? " active" : ""}`;
        btn.disabled = !!cmd.disabled;
        btn.innerHTML = `<span>${cmd.label}</span>`;
        btn.addEventListener("click", () => {
            if (!unit || cmd.disabled) return;
            const label = cmd.label === "持ち物" ? "アイテム"
                        : cmd.label === "詳細" ? "ステータス"
                        : cmd.label;
            handleBattleCommand(unit, label);
            if (!["攻撃", "魔法", "特技", "アイテム"].includes(label)) {
                syncLandscapeBattleUi(unit);
            }
        });
        landscapeCommandList.appendChild(btn);
    });
    applyLandscapeRailArc();
}

function addLandscapeBackButton(unit) {
    const back = document.createElement("button");
    back.className = "lsCommandBtn back";
    back.innerHTML = "<span>戻る</span>";
    back.addEventListener("click", () => {
        actionState = null;
        selectedSpell = null;
        selectedAttackSkill = null;
        selectedCombatArtId = null;
        clearHighlights();
        hideForecastLayer();
        renderBattleCommands(unit);
        activateLandscapeDefaultMove(unit);
        syncLandscapeBattleUi(unit);
    });
    landscapeCommandList.appendChild(back);
    applyLandscapeRailArc();
}

function renderLandscapeSubCommandRail(unit, kind) {
    if (!landscapeCommandList || !unit) return;
    setLandscapeRailVisible(true);
    landscapeCommandList.innerHTML = "";

    const addButton = (label, sub, onClick) => {
        const btn = document.createElement("button");
        btn.className = "lsCommandBtn";
        btn.innerHTML = `<span>${label}</span>${sub ? `<small>${sub}</small>` : ""}`;
        btn.addEventListener("click", onClick);
        landscapeCommandList.appendChild(btn);
    };

    if (kind === "attack") {
        const atkSkills = ATTACK_SKILL_PRIORITY
            .filter(name => name in (unit.skills || {}))
            .map(name => ({ label: name, val: unit.skills[name] }));
        if (atkSkills.length === 0) atkSkills.push({ label: "素手", val: 4 });
        atkSkills.forEach(item => addButton(item.label, String(item.val), () => {
            selectedAttackSkill = item.label;
            selectedCombatArtId = null;
            if (item.label === "投擲") {
                actionState = "throwing";
                highlightThrowRange(unit);
                switchTopLayer("battle");
                addLog(`・${unit.name}は投擲を選択`);
                setLandscapeHint(`${unit.name}の投擲対象を選択してください。`);
            } else {
                actionState = "attacking";
                highlightAttackRange(unit);
                switchTopLayer("battle");
                addLog(`・${unit.name}は${item.label}で攻撃を選択`);
                setLandscapeHint(`${unit.name}の攻撃対象を選択してください。`);
            }
            syncLandscapeBattleUi(unit);
        }));
        getAvailableCombatArts(unit, "attack").forEach(art => {
            const baseSkill = getAttackSkillVal(unit);
            addButton(art.name, "ART", () => {
                selectedAttackSkill = baseSkill.name;
                selectedCombatArtId = art.id;
                actionState = "attacking";
                highlightAttackRange(unit);
                switchTopLayer("battle");
                addLog(`・${unit.name}は戦技 ${art.name} を選択`);
                setLandscapeHint(`${art.name}の対象を選択してください。`);
                syncLandscapeBattleUi(unit);
            });
        });
        addLandscapeBackButton(unit);
        return;
    }

    if (kind === "skill") {
        const entries = Object.entries(unit.skills || {})
            .filter(([name]) => BATTLE_UTILITY_SKILLS.has(name));
        const selfArts = getAvailableCombatArts(unit, "self");
        if (entries.length === 0 && selfArts.length === 0) addButton("使える特技なし", "", () => {});
        entries.forEach(([name, val]) => addButton(name, String(val), () => {
            hideRadialMenu();
            executeSkill(unit, name, val, name);
        }));
        selfArts.forEach(art => addButton(art.name, getCombatArtUseText(unit, art), () => {
            executeSelfCombatArt(unit, art.id);
        }));
        addLandscapeBackButton(unit);
        return;
    }

    if (kind === "magic") {
        const entries = Object.entries(unit.spells || {}).filter(([id]) => SPELLS_DATA[id]);
        entries.forEach(([id, val]) => {
            const sp = SPELLS_DATA[id];
            addButton(sp.name, String(val), () => {
                if (sp.range === null) {
                    clearHighlights();
                    addLog(`・${unit.name}は ${sp.name} を使用`);
                    executeMagic(unit, sp, unit);
                    return;
                }
                if (sp.effectType === "teleport") {
                    selectedSpell = sp;
                    actionState = "magic";
                    clearHighlights();
                    hideForecastLayer();
                    const tRange = sp.range || 5;
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
                    addLog(`・${unit.name}は 転移 を詠唱中...`);
                    setLandscapeHint("転移先のマスを選んでください。");
                    syncLandscapeBattleUi(unit);
                    return;
                }
                selectedSpell = sp;
                actionState = "magic";
                clearHighlights();
                for (let dy = -sp.range; dy <= sp.range; dy++) {
                    for (let dx = -sp.range; dx <= sp.range; dx++) {
                        if (Math.abs(dx) + Math.abs(dy) > sp.range) continue;
                        const cell = getCell(unit.y + dy, unit.x + dx);
                        if (cell) cell.classList.add("highlightAttack");
                    }
                }
                switchTopLayer("battle");
                addLog(`・${unit.name}は ${sp.name} を詠唱中...`);
                setLandscapeHint(`${sp.name}の対象を選んでください。`);
                syncLandscapeBattleUi(unit);
            });
        });
        addLandscapeBackButton(unit);
        return;
    }

    if (kind === "item") {
        const entries = unit.items || [];
        if (entries.length === 0) addButton("持ち物なし", "", () => {});
        entries.forEach((item, idx) => addButton(item.name, "使う", () => {
            const used = unit.items.splice(idx, 1)[0];
            if (used?.type === "heal") {
                const restored = used.value;
                unit.hp = Math.min(unit.maxHp, unit.hp + restored);
                showDamagePopup(unit.id, restored, "heal");
                renderUnits();
                addLog(`・${unit.name}は ${used.name} を使用 → HP +${restored}`);
            }
            unit.acted = true;
            endUnitTurn(unit);
        }));
        addLandscapeBackButton(unit);
    }
}

function renderLandscapeBattlePreview(attacker, target, pred, actionLabel) {
    if (!lsForecast) return;
    if (landscapeCommandList) landscapeCommandList.innerHTML = "";
    setLandscapeRailVisible(false);   // 予測モーダル表示中は針を隠す

    // 戦闘後HPの予測（FE風の下段バーに使う）。
    // effectDesc は通常攻撃でも常に入るため、ダメージ系かは effectType で判定する
    const isDamage = !_vsAttack?.isMagic
        || ["magicDamage", "break"].includes(_vsAttack?.spell?.effectType);
    const dmgN = Number(pred.expDmg) || 0;
    const ctrN = pred.canCounter ? (Number(pred.ctrExpDmg) || 0) : 0;
    const defAfter = isDamage ? Math.max(0, target.hp - dmgN) : target.hp;
    const atkAfter = Math.max(0, attacker.hp - ctrN);
    const atkPct = attacker.maxHp ? atkAfter / attacker.maxHp * 100 : 0;
    const defPct = target.maxHp   ? defAfter / target.maxHp   * 100 : 0;

    const bust = (u, flip) => {
        const src = getPortraitSrc(u) || u.tokenImage || "";
        return `<div class="lsFcBust${flip ? " flip" : ""}" style="${src ? `background-image:url('${src}')` : ""}"></div>`;
    };
    const ctrWeapon = pred.canCounter ? (getAttackSkillVal(target).name || "反撃") : "なし";
    const dmgDisp = pred.effectDesc || dmgN;

    const equipmentName = u => {
        if (typeof u.equipment === "string" && u.equipment.trim() && u.equipment !== "―") {
            return u.equipment;
        }
        return u.equipment?.weapon?.name || u.weapon?.name || "未装備";
    };

    // 予測画面では戦闘判断に必要な情報だけを出す。
    // TRPG技能一覧は表示せず、装備武器と今回選んだ攻撃種別を分ける。
    const sideMeta = (u, actionType, actionName) => `
        <div class="lsFcMeta">
            <div class="lsFcNameRow"><span class="lsFcName">${u.name}</span><i class="lsFcCrest"></i></div>
            <div class="lsFcClass">LV ${u.level}　${u.race || "―"}</div>
            <div class="lsFcSlot"><em>武器</em><span>${equipmentName(u)}</span></div>
            <div class="lsFcSlot action"><em>${actionType}</em><span>${actionName}</span></div>
        </div>`;

    const activeCombatArt = getCombatArtData(selectedCombatArtId);
    const attackerActionType = activeCombatArt ? "戦技" : (_vsAttack?.isMagic ? "魔法" : "武器種");
    const attackerActionName = activeCombatArt?.name || actionLabel || (_vsAttack?.isMagic ? _vsAttack?.spell?.name : getAttackSkillVal(attacker).name) || "攻撃";
    const counterActionName = pred.canCounter ? ctrWeapon : "なし";

    lsForecast.innerHTML = `
        <div class="lsFcSide allySide">
            ${bust(attacker, false)}
            ${sideMeta(attacker, attackerActionType, attackerActionName)}
            <span class="lsFcTerrain">平地</span>
        </div>
        <div class="lsFcTable">
            <div class="lsFcChipRow">
                <button type="button" id="lsFcCancel">キャンセル</button>
                <button type="button" id="lsFcConfirm">実行</button>
            </div>
            <div class="lsFcHead">
                <span>命中</span><span>威力</span><span>必殺</span>
                <b class="lsFcHpPlate">${attacker.hp}<em>HP</em>${target.hp}</b>
                <span>必殺</span><span>威力</span><span>命中</span>
            </div>
            <div class="lsFcVals">
                <span>${pred.hitRate}</span><span>${dmgDisp}</span><span class="lsFcCrit">${isDamage ? pred.critRate : "─"}</span>
                <span class="lsFcExchange" aria-label="与えるダメージと受けるダメージ">
                    <b class="toDef"><small>与</small><strong>${isDamage ? dmgN : pred.effectDesc}</strong><i>→</i></b>
                    <b class="toAtk"><i>←</i><strong>${pred.canCounter ? ctrN : "─"}</strong><small>被</small></b>
                </span>
                <span class="lsFcCrit">${pred.canCounter ? pred.ctrCritRate : "─"}</span><span>${pred.canCounter ? ctrN : "─"}</span><span>${pred.canCounter ? pred.ctrHitRate : "─"}</span>
            </div>
            <div class="lsFcCounterNote${pred.canCounter ? "" : " hidden"}">
                <span>反撃発生 ${pred.counterRate}%</span>
                <i>×</i>
                <span>命中 ${pred.ctrHitRate}%</span>
                <b>実効 ${pred.ctrEffectiveRate}%</b>
            </div>
            <div class="lsFcBars">
                <div class="lsFcBar ally"><i style="width:${atkPct}%"></i></div>
                <b class="lsFcAfter ally">${atkAfter}</b>
                <span class="lsFcAfterLabel">戦闘後</span>
                <b class="lsFcAfter enemy">${defAfter}</b>
                <div class="lsFcBar enemy"><i style="width:${defPct}%"></i></div>
            </div>
        </div>
        <div class="lsFcSide enemySide">
            ${bust(target, true)}
            ${sideMeta(target, "反撃", counterActionName)}
            <span class="lsFcTerrain">平地</span>
        </div>
    `;
    lsForecast.classList.remove("hidden");
    setLandscapeForecastOpen(true);

    document.getElementById("lsFcConfirm").addEventListener("click", () => {
        executePendingBattlePreview();
    });
    document.getElementById("lsFcCancel").addEventListener("click", () => {
        if (!_vsAttack) return;
        const { isMagic } = _vsAttack;
        hideBattlePreview();
        actionState = null;
        clearHighlights();
        if (selectedUnit) {
            if (isMagic) renderLandscapeSubCommandRail(selectedUnit, "magic");
            else renderLandscapeSubCommandRail(selectedUnit, "attack");
        }
    });
    setLandscapeHint(`${target.name}への${actionLabel || "攻撃"}を実行しますか。`);
}

function syncLandscapeBattleUi(unit = selectedUnit) {
    syncLandscapeBattleMount();
    renderLandscapeHeader();
    renderLandscapeUnitPanel(unit);
    renderLandscapeCommandRail(unit);
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

    const dist = Math.abs(defender.x - originalAttacker.x) + Math.abs(defender.y - originalAttacker.y);

    // ── ダメージ系呪文の中で最良のものを探す ──
    const DAMAGE_TYPES = new Set(["magicDamage", "break"]);
    let bestMagic = null, bestMagicDamage = 0;

    for (const [spellId, spellVal] of Object.entries(defender.spells || {})) {
        const spell = SPELLS_DATA[spellId];
        if (!spell || !DAMAGE_TYPES.has(spell.effectType)) continue;
        if (typeof spell.range === "number" && dist > spell.range) continue;
        if (defender.mp <= 0) continue;

        const predicted = calculateMagicDamage(defender, originalAttacker, spell, { half: true }).damage;
        if (predicted > bestMagicDamage) {
            bestMagicDamage = predicted;
            bestMagic = { spell, spellVal };
        }
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

    // auto（デフォルト）：確定ダメージで自動選択
    const phyDamage = calculatePhysicalDamage(defender, originalAttacker, {
        half: true,
        allowMartialArt: false,
    }).damage;

    if (bestMagic && bestMagicDamage > phyDamage) {
        executeMagicCounter(defender, originalAttacker, bestMagic.spell, bestMagic.spellVal);
    } else {
        executePhysicalCounter(defender, originalAttacker);
    }
}

function executePhysicalCounter(counterAttacker, counterTarget) {
    const { val: atkVal, name: atkName } = getAttackSkillVal(counterAttacker);
    const evadeVal = getEvadeSkillVal(counterTarget);
    const hit = getBattleHitResult(counterAttacker, counterTarget, atkVal, false, { isCounter: true });
    addLog(`  物理反撃！${counterAttacker.name}【${atkName}${atkVal} vs 回避${evadeVal}】 ${hit.note} → ${hit.isHit ? "命中" : "失敗"}`);
    const isHit = hit.isHit;
    if (!isHit) return;

    const targetResult = createPhysicalActionContext(counterAttacker, counterTarget, {
        half: true,
        isCounter: true,
        hit,
        attackSkillName: atkName,
        attackSkillValue: atkVal,
        commitBarrier: true,
    });
    const result = targetResult.calculation;
    const critical = targetResult.critical;
    const barrier = targetResult.barrier;
    const hpBefore = counterTarget.hp;
    counterTarget.hp = Math.max(0, counterTarget.hp - barrier.damage);
    showDamagePopup(counterTarget.id, barrier.damage, critical.isCritical ? "critical" : "counter");
    flashUnitHit(counterTarget.id);
    const criticalNote = critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : "";
    addLog(`    ${barrier.damage}ダメージ（半分）${criticalNote}${result.artNote}${barrier.note}（力${result.power}+武器${result.weaponPower}-物防${result.armor}）→ ${counterTarget.name} HP ${counterTarget.hp}/${counterTarget.maxHp}`);
    renderUnits();
    if (counterTarget.hp <= 0) addLog(`    ${counterTarget.name}は倒れた！`);
    finishDamageHooks(targetResult.context, targetResult, hpBefore);
}

function executeMagicCounter(caster, target, spell, spellVal) {
    const mpCost  = rollDice(spell.mpCost || "1d6");
    caster.mp = Math.max(0, caster.mp - mpCost);
    const hit = getMagicHitResult(caster, target, spell, spellVal, { isCounter: true });
    addLog(`  魔法反撃【${spell.name}】${caster.name}→${target.name} （${hit.note}） MP-${mpCost} → ${hit.isHit ? "成功" : "失敗"}`);
    if (!hit.isHit) return;

    const targetResult = createMagicActionContext(caster, target, spell, {
        half: true,
        isCounter: true,
        hit,
        commitBarrier: true,
        breakBarrier: spell.effectType === "break",
    });
    const result = targetResult.calculation;
    const critical = targetResult.critical;
    const barrier = targetResult.barrier;
    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - barrier.damage);
    showDamagePopup(target.id, barrier.damage, critical.isCritical ? "critical" : "counter");
    flashUnitHit(target.id);
    const criticalNote = critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : "";
    addLog(`    ${barrier.damage}ダメージ（半分）${criticalNote}${result.masteryNote}${barrier.note}（魔力${result.magic}+呪文${result.spellPower}-魔防${result.ward}）→ ${target.name} HP ${target.hp}/${target.maxHp}`);
    renderUnits();
    if (target.hp <= 0) addLog(`    ${target.name}は倒れた！`);
    finishDamageHooks(targetResult.context, targetResult, hpBefore);
}

/**
 * 命中後の物理ダメージ適用（武道補正・必殺・カウンター・装甲・気絶・反撃を処理）
 */
function resolvePhysicalHit(attacker, target, atkSkillName, options = {}) {
    // カウンター状態：同じダメージを両者に与える
    if ((target.statusEffects || []).some(e => e.type === "counter")) {
        const targetResult = createPhysicalActionContext(attacker, target, {
            hit: options.hit || null,
            attackSkillName: atkSkillName,
            attackSkillValue: options.attackSkillValue ?? null,
            combatArtId: options.combatArtId || null,
            commitBarrier: false,
        });
        const result = targetResult.calculation;
        const critical = targetResult.critical;
        const rawDmg = targetResult.finalDamage;
        const targetHpBefore = target.hp;
        const attackerHpBefore = attacker.hp;
        // 攻撃側も同じダメージ
        attacker.hp = Math.max(0, attacker.hp - rawDmg);
        showDamagePopup(attacker.id, rawDmg, "damage");
        // 防御側（カウンター持ち）も同じダメージ
        target.hp   = Math.max(0, target.hp - rawDmg);
        showDamagePopup(target.id, rawDmg, "damage");
        const criticalNote = critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : "";
        addLog(`  カウンター発動！${rawDmg}ダメージ${criticalNote}${result.artNote} → ${target.name} HP ${target.hp}/${target.maxHp} / ${attacker.name} HP ${attacker.hp}/${attacker.maxHp}`);
        showMessage("SYSTEM", `${target.name}のカウンター！お互いに ${rawDmg} ダメージ！`);
        renderUnits();
        if (target.hp   <= 0) addLog(`  ${target.name}は倒れた！`);
        if (attacker.hp <= 0) addLog(`  ${attacker.name}は倒れた！`);
        finishDamageHooks(targetResult.context, targetResult, targetHpBefore);
        if (attackerHpBefore > 0 && attacker.hp <= 0) {
            runBattleActionHooks("onKill", targetResult.context, { ...targetResult, target: attacker });
        }
        return;
    }

    const targetResult = createPhysicalActionContext(attacker, target, {
        hit: options.hit || null,
        attackSkillName: atkSkillName,
        attackSkillValue: options.attackSkillValue ?? null,
        combatArtId: options.combatArtId || null,
        commitBarrier: true,
    });
    const result = targetResult.calculation;
    const critical = targetResult.critical;
    const barrier = targetResult.barrier;
    const actualDmg = barrier.damage;

    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - actualDmg);
    showDamagePopup(target.id, actualDmg, critical.isCritical ? "critical" : "damage");
    flashUnitHit(target.id);
    const criticalNote = critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : "";
    addLog(`  命中！${actualDmg}ダメージ${criticalNote}${result.artNote}${barrier.note}（力${result.power}+武器${result.weaponPower}-物防${result.armor}）→ ${target.name} HP ${target.hp}/${target.maxHp}`);
    showMessage("SYSTEM", critical.isCritical
        ? `${attacker.name}の必殺！${target.name}に ${actualDmg} ダメージ！`
        : `${attacker.name}の攻撃命中！${target.name}に ${actualDmg} ダメージ！`);

    // 気絶チェック：HPが一気に2以下に減った場合 CON×5% 失敗で戦闘不能
    if (hpBefore > 2 && target.hp <= 2 && target.hp > 0) {
        const conRate  = calcBattleStats(target).raw.con * 5;
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
    finishDamageHooks(targetResult.context, targetResult, hpBefore);

    // 反撃チェック：パッシブモードでは反撃しない
    if (target.hp > 0 && !BATTLE_DEFINITIONS[currentBattleId]?.passive && canCounter(target)) {
        const counterRate = getCounterRate(target);
        const counterRoll = Math.floor(Math.random() * 100) + 1;
        if (counterRoll <= counterRate) {
            showMessage(target.name, "反撃！");
            addLog(`  反撃発生！（勇気 ${counterRoll}/${counterRate}%）`);
            resolveCounterAttack(attacker, target);
        } else {
            addLog(`  反撃せず（勇気 ${counterRoll}/${counterRate}%）`);
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
    const combatArtId = selectedCombatArtId;
    selectedAttackSkill = null;
    selectedCombatArtId = null;

    // スタン中の相手は回避不可
    const targetStunned = (target.statusEffects || []).some(e => e.type === "stun");
    const evadeStat = targetStunned ? 0 : getEvadeSkillVal(target);
    const hit = getBattleHitResult(attacker, target, atkStat, targetStunned);
    const isHit = hit.isHit;

    const rollNote = hit.note;
    addLog(`・${attacker.name} → ${target.name} 【${atkSkillName}${atkStat} vs 回避${evadeStat}】 ${rollNote} → ${isHit ? "命中" : "失敗"}`);

    if (!isHit) {
        showDamagePopup(target.id, 0, "miss");
        showMessage("SYSTEM", `${attacker.name}の攻撃は外れた！`);
        endUnitTurn(attacker);
        return;
    }

    resolvePhysicalHit(attacker, target, atkSkillName, {
        hit,
        attackSkillValue: atkStat,
        combatArtId,
    });
    endUnitTurn(attacker);
    checkVictoryCondition();
}

function executeThrow(attacker, target) {
    const throwStat = attacker.skills["投擲"] ?? 5;
    const targetStunned = (target.statusEffects || []).some(e => e.type === "stun");
    const evadeStat = targetStunned ? 0 : getEvadeSkillVal(target);
    const hit = getBattleHitResult(attacker, target, throwStat, targetStunned);
    const isHit = hit.isHit;

    const rollNote = hit.note;
    addLog(`・${attacker.name} 投擲 → ${target.name} 【投擲${throwStat} vs 回避${evadeStat}】 ${rollNote} → ${isHit ? "命中" : "失敗"}`);

    if (!isHit) {
        showDamagePopup(target.id, 0, "miss");
        showMessage("SYSTEM", `${attacker.name}の投擲は外れた！`);
        endUnitTurn(attacker);
        return;
    }

    resolvePhysicalHit(attacker, target, "投擲", {
        hit,
        attackSkillValue: throwStat,
    });
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
    const hit = getMagicHitResult(caster, target, spell, successVal);

    // MPコスト
    const mpCost = rollDice(spell.mpCost || "1d6");
    caster.mp    = Math.max(0, caster.mp - mpCost);
    addLog(`・${caster.name}が ${spell.name} 使用（${hit.note}）  MP-${mpCost}`);

    if (!hit.isHit) {
        addLog("  失敗！");
        showMessage("SYSTEM", `${caster.name}の${spell.name}は失敗した！`);
        endUnitTurn(caster);
        return;
    }

    switch (spell.effectType) {
        case "magicDamage": {
            const targetResult = createMagicActionContext(caster, target, spell, {
                hit,
                commitBarrier: true,
            });
            const result = targetResult.calculation;
            const critical = targetResult.critical;
            const barrier = targetResult.barrier;
            const rawDmg = barrier.damage;

            const hpBefore = target.hp;
            target.hp = Math.max(0, target.hp - rawDmg);
            showDamagePopup(target.id, rawDmg, critical.isCritical ? "critical" : "damage");
            flashUnitHit(target.id);
            const criticalNote = critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : "";
            addLog(`  命中！${rawDmg}ダメージ${criticalNote}${result.masteryNote}${barrier.note}（魔力${result.magic}+呪文${result.spellPower}-魔防${result.ward}）→ ${target.name} HP ${target.hp}/${target.maxHp}`);
            showMessage("SYSTEM", critical.isCritical
                ? `${caster.name}の${spell.name}必殺！${target.name}に ${rawDmg} ダメージ！`
                : `${caster.name}の${spell.name}命中！${target.name}に ${rawDmg} ダメージ！`);

            // 気絶チェック
            if (hpBefore > 2 && target.hp <= 2 && target.hp > 0) {
                const conRate  = calcBattleStats(target).raw.con * 5;
                const conCheck = Math.floor(Math.random() * 100) + 1;
                if (conCheck > conRate) {
                    target.hp = 0;
                    addLog(`  ${target.name}は気絶した！（CON×5%:${conRate}% 失敗:${conCheck}）`);
                }
            }

            // スペル固有の状態異常付与。命中後は追加抽選を重ねない。
            const dmgForCheck = critical.damage; // 装甲前のダメージで判定
            if (dmgForCheck >= 10 && spell.statusEffect) {
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

            if (target.hp <= 0) addLog(`  ${target.name}は倒れた！`);
            finishDamageHooks(targetResult.context, targetResult, hpBefore);
            break;
        }
        case "heal": {
            const healAmt = calcBattleStats(caster).supportMagic + getSpellPower(spell);
            target.hp = Math.min(target.maxHp, target.hp + healAmt);
            showDamagePopup(target.id, healAmt, "heal");
            addLog(`  ${target.name}を ${healAmt} 回復（HP ${target.hp}/${target.maxHp}）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}のHP+${healAmt}`);
            break;
        }
        case "barrier": {
            const val = getSpellPower(spell);
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
            const targetResult = createMagicActionContext(caster, target, spell, {
                hit,
                commitBarrier: true,
                breakBarrier: true,
            });
            const result = targetResult.calculation;
            const critical = targetResult.critical;
            const barrier = targetResult.barrier;
            const dmgToHp = barrier.damage;
            const breakNote = barrier.note || "（結界なし）";
            const hpBefore = target.hp;
            target.hp = Math.max(0, target.hp - dmgToHp);
            if (dmgToHp > 0) { showDamagePopup(target.id, dmgToHp, critical.isCritical ? "critical" : "damage"); flashUnitHit(target.id); }
            const criticalNote = critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : "";
            addLog(`  破壊！${critical.damage}ダメージ${criticalNote}${result.masteryNote}${breakNote}（魔力${result.magic}+呪文${result.spellPower}-魔防${result.ward}） → ${target.name} HP ${target.hp}/${target.maxHp}`);
            showMessage("SYSTEM", critical.isCritical
                ? `${caster.name}の${spell.name}必殺！結界を砕き${dmgToHp}ダメージ！`
                : `${caster.name}の${spell.name}！結界を砕き${dmgToHp}ダメージ！`);
            if (target.hp <= 0) addLog(`  ${target.name}は倒れた！`);
            finishDamageHooks(targetResult.context, targetResult, hpBefore);
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
            const reduction = evalDamage(
                spell.effectValue || "1d6",
                calcBattleStats(caster).supportMagic,
                0
            );
            target.battleCourageLoss = Number(target.battleCourageLoss || 0) + reduction;
            showDamagePopup(target.id, reduction, "counter");
            addLog(`  ${target.name}の勇気を ${reduction} 削った（残り${getEffectiveCourage(target)}）`);
            showMessage("SYSTEM", `${caster.name}の${spell.name}！${target.name}の勇気-${reduction}！`);
            break;
        }
        case "areaDamage": {
            const targets = battleUnits.filter(u =>
                u.side !== caster.side && u.hp > 0 &&
                Math.abs(u.y - caster.y) <= (spell.range || 3) &&
                Math.abs(u.x - caster.x) <= 1
            );
            if (targets.length === 0) {
                addLog("  範囲内に敵がいない");
                showMessage("SYSTEM", `${spell.name}が着弾したが対象がいない！`);
            } else {
                let areaContext = null;
                for (const t of targets) {
                    const targetResult = createMagicActionContext(caster, t, spell, {
                        hit,
                        targets,
                        context: areaContext,
                        commitBarrier: true,
                    });
                    areaContext = targetResult.context;
                    const result = targetResult.calculation;
                    const critical = targetResult.critical;
                    const dmg = targetResult.actualDamage;
                    const hpBefore = t.hp;
                    t.hp = Math.max(0, t.hp - dmg);
                    showDamagePopup(t.id, dmg, critical.isCritical ? "critical" : "damage");
                    flashUnitHit(t.id);
                    addLog(`  ${t.name}に ${dmg} ダメージ${critical.isCritical ? ` 必殺！（${critical.roll}/${critical.rate}%）` : ""}${result.masteryNote}`);
                    if (t.hp <= 0) addLog(`  ${t.name}は倒れた！`);
                    finishDamageHooks(targetResult.context, targetResult, hpBefore);
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
    const selfArts = getAvailableCombatArts(unit, "self");

    if (utilityEntries.length === 0 && selfArts.length === 0) {
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
    appendSelfCombatArtCommands(unit);

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

function appendSelfCombatArtCommands(unit) {
    for (const art of getAvailableCombatArts(unit, "self")) {
        const btn = document.createElement("button");
        btn.className = "commandItem";
        btn.textContent = `${art.name}（${getCombatArtUseText(unit, art)}）`;
        btn.addEventListener("click", () => executeSelfCombatArt(unit, art.id));
        commandList.appendChild(btn);
    }
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
    selectedCombatArtId = null;
    clearHighlights();
    hideForecastLayer();
    hideBattlePreview();
    renderUnits();
    syncLandscapeBattleUi(null);

    if (turnPhase !== "ally") return;

    const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
    const allDone     = aliveAllies.every(u => u.moved && u.acted);

    if (allDone) {
        setTimeout(startEnemyPhase, 700);
    } else {
        renderIdlePanel();
        syncLandscapeBattleUi(null);
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
    planEnemyActions();
    renderIdlePanel();
    syncLandscapeBattleUi(null);
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
    let hitRate, expDmg, effectDesc, critRate = 0, critDmg = 0;
    if (isMagic && spell) {
        const hit = getMagicHitResult(attacker, target, spell, attacker.spells?.[spell.id] ?? 5, { roll: false });
        hitRate = hit.rate;
        if (spell.effectType === "magicDamage" || spell.effectType === "break") {
            const targetResult = createMagicActionContext(attacker, target, spell, {
                hit,
                isPreview: true,
                rollCritical: false,
                commitBarrier: false,
                breakBarrier: spell.effectType === "break",
            });
            expDmg     = targetResult.baseAfterBarrier;
            critRate   = targetResult.critical.rate;
            critDmg    = targetResult.critAfterBarrier;
            effectDesc = `${expDmg}`;
        } else if (spell.effectType === "heal") {
            expDmg     = calcBattleStats(attacker).supportMagic + getSpellPower(spell);
            effectDesc = `+${expDmg}`;
        } else if (spell.effectType === "barrier") {
            expDmg     = getSpellPower(spell);
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
        const hit = getBattleHitResult(attacker, target, atkStat, stunned, { roll: false });
        hitRate = hit.rate;

        const targetResult = createPhysicalActionContext(attacker, target, {
            hit,
            isPreview: true,
            rollCritical: false,
            commitBarrier: false,
            attackSkillName: atkSkillName,
            attackSkillValue: atkStat,
            combatArtId: selectedCombatArtId,
        });
        expDmg     = targetResult.baseAfterBarrier;
        critRate   = targetResult.critical.rate;
        critDmg    = targetResult.critAfterBarrier;
        effectDesc = `${expDmg}`;
    }

    // ── 反撃予測（共通） ──
    const counterRate = getCounterRate(target);
    const counterAvailable = target.hp > 0 && canCounter(target);
    let ctrHitRate = 0, ctrEffectiveRate = 0, ctrExpDmg = 0, ctrCritRate = 0, ctrCritDmg = 0;
    if (counterAvailable) {
        const ctrAtkStat = getAttackSkillVal(target).val;
        const ctrHit = getBattleHitResult(target, attacker, ctrAtkStat, false, { roll: false, isCounter: true });
        ctrHitRate = ctrHit.rate;
        ctrEffectiveRate = Math.round(counterRate * ctrHitRate / 100);
        const ctrResult = createPhysicalActionContext(target, attacker, {
            hit: ctrHit,
            isPreview: true,
            isCounter: true,
            half: true,
            rollCritical: false,
            commitBarrier: false,
            attackSkillValue: ctrAtkStat,
        });
        ctrExpDmg = ctrResult.baseAfterBarrier;
        ctrCritRate = ctrResult.critical.rate;
        ctrCritDmg = ctrResult.critAfterBarrier;
    }

    return {
        hitRate,
        expDmg,
        effectDesc,
        critRate,
        critDmg,
        canCounter: counterAvailable,
        counterRate,
        ctrHitRate,
        ctrEffectiveRate,
        ctrExpDmg,
        ctrCritRate,
        ctrCritDmg,
    };
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
    if (isLandscapeBattleUi()) {
        renderLandscapeUnitPanel(attacker);
        renderLandscapeBattlePreview(attacker, target, pred, actionLabel);
        hideRadialMenu();
        return;
    }

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
    document.getElementById("vsAtkCrit").textContent = `${pred.critRate}%`;

    // ── 反撃予測 ──
    const ctrTag     = document.getElementById("vsCtrTag");
    const defStatRow = document.getElementById("vsDefStatRow");
    if (pred.canCounter) {
        ctrTag.textContent       = `反撃 ${pred.counterRate}% / 実効 ${pred.ctrEffectiveRate}%`;
        ctrTag.style.opacity     = "1";
        defStatRow.style.opacity = "1";
        document.getElementById("vsDefHit").textContent = `${pred.ctrHitRate}%`;
        document.getElementById("vsDefDmg").textContent = `~${pred.ctrExpDmg}`;
        document.getElementById("vsDefCrit").textContent = `${pred.ctrCritRate}%`;
    } else {
        ctrTag.textContent       = "反撃なし";
        ctrTag.style.opacity     = "0.5";
        defStatRow.style.opacity = "0.35";
        document.getElementById("vsDefHit").textContent = "―%";
        document.getElementById("vsDefDmg").textContent = "―";
        document.getElementById("vsDefCrit").textContent = "―%";
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
    executePendingBattlePreview();
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
    lsForecast?.classList.add("hidden");
    setLandscapeForecastOpen(false);
    if (gameMode === "battle") switchTopLayer("battle");
    syncLandscapeBattleUi(selectedUnit);
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
    const activeCombatArt = !isMagic ? getCombatArtData(selectedCombatArtId) : null;
    const label = activeCombatArt?.name || (isMagic ? (spell?.name || "魔法") : (skillName || "攻撃"));
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
            const hit = getBattleHitResult(attacker, target, atkStat, stunned, { roll: false });
            const hitRate = hit.rate;

            const targetResult = createPhysicalActionContext(attacker, target, {
                hit,
                isPreview: true,
                rollCritical: false,
                commitBarrier: false,
                attackSkillName: skillName,
                attackSkillValue: atkStat,
                combatArtId: selectedCombatArtId,
            });
            const expDmg  = targetResult.baseAfterBarrier;
            const critRate = targetResult.critical.rate;
            const critDmg = targetResult.critAfterBarrier;
            const barrier = (target.statusEffects || []).find(e => e.type === "barrier");
            const barrierNote = barrier ? `<span class="forecastNote">結界-${barrier.value}</span>` : "";

            // 反撃予測
            const ctrAtkStat = getAttackSkillVal(target).val;
            const ctrEvade   = getEvadeSkillVal(attacker);
            const counterPossible = canCounter(target);
            const ctrHit = counterPossible ? getBattleHitResult(target, attacker, ctrAtkStat, false, { roll: false, isCounter: true }) : null;
            const ctrHitRate = counterPossible ? ctrHit.rate : 0;
            const ctrChance  = Math.round(getCounterRate(target) * ctrHitRate / 100);
            const ctrResult = counterPossible
                ? createPhysicalActionContext(target, attacker, {
                    hit: ctrHit,
                    isPreview: true,
                    isCounter: true,
                    half: true,
                    rollCritical: false,
                    commitBarrier: false,
                    attackSkillValue: ctrAtkStat,
                })
                : null;
            const ctrDmg     = ctrResult ? ctrResult.baseAfterBarrier : 0;
            const ctrCritRate = ctrResult ? ctrResult.critical.rate : 0;
            const ctrCritDmg = ctrResult ? ctrResult.critAfterBarrier : 0;

            body.innerHTML = `
                <div class="forecastRow">
                    <span class="forecastDir">→</span>
                    <span class="forecastLabel">命中</span>
                    <span class="forecastVal hit">${hitRate}%</span>
                    <span class="forecastSep">／</span>
                    <span class="forecastLabel">ダメ</span>
                    <span class="forecastVal dmg">${expDmg}</span>${barrierNote}
                    <span class="forecastSep">／</span>
                    <span class="forecastLabel">必殺</span>
                    <span class="forecastVal crit">${critRate}%</span>
                    <span class="forecastNote">時${critDmg}</span>
                </div>
                <div class="forecastRow">
                    <span class="forecastDir ctr">←</span>
                    <span class="forecastLabel">反撃</span>
                    <span class="forecastVal ctr">${ctrChance}%</span>
                    <span class="forecastSep">／</span>
                    <span class="forecastLabel">被ダメ</span>
                    <span class="forecastVal cdmg">${ctrDmg}</span>
                    <span class="forecastSep">／</span>
                    <span class="forecastLabel">必殺</span>
                    <span class="forecastVal crit">${counterPossible ? `${ctrCritRate}%` : "―"}</span>
                    ${counterPossible ? `<span class="forecastNote">時${ctrCritDmg}</span>` : ""}
                </div>
            `;
        } else if (isMagic && spell) {
            // ── 魔法予測 ──
            const successRate = getMagicHitResult(attacker, target, spell, attacker.spells?.[spell.id] ?? 5, { roll: false }).rate;
            let effectHtml = "";

            if (spell.effectType === "magicDamage" || spell.effectType === "break") {
                const magicHit = getMagicHitResult(attacker, target, spell, attacker.spells?.[spell.id] ?? 5, { roll: false });
                const magicResult = createMagicActionContext(attacker, target, spell, {
                    hit: magicHit,
                    isPreview: true,
                    rollCritical: false,
                    commitBarrier: false,
                    breakBarrier: spell.effectType === "break",
                });
                const barr2  = (target.statusEffects || []).find(e => e.type === "barrier");
                const effMdmg = magicResult.baseAfterBarrier;
                const critRate = magicResult.critical.rate;
                const critDmg = magicResult.critAfterBarrier;
                const bNote   = barr2 ? `<span class="forecastNote">結界-${barr2.value}</span>` : "";
                effectHtml = `<span class="forecastLabel">ダメ</span><span class="forecastVal dmg">${effMdmg}</span>${bNote}<span class="forecastSep">／</span><span class="forecastLabel">必殺</span><span class="forecastVal crit">${critRate}%</span><span class="forecastNote">時${critDmg}</span>`;
            } else if (spell.effectType === "heal") {
                const healAmt = calcBattleStats(attacker).supportMagic + getSpellPower(spell);
                effectHtml = `<span class="forecastLabel">回復</span><span class="forecastVal hit">${healAmt}</span>`;
            } else if (spell.effectType === "barrier") {
                const barrVal = getSpellPower(spell);
                effectHtml = `<span class="forecastLabel">結界</span><span class="forecastVal hit">${barrVal}</span>`;
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
    const displayDelay = type === "critical" ? 760 : 0;
    setTimeout(() => {
        if (gameMode !== "battle") return;
        unitLayer.appendChild(popup);
        setTimeout(() => popup.remove(), 1200);
    }, displayDelay);
}

let criticalCutInTimer = null;
let criticalCutInExitTimer = null;

/** Brief portrait cut-in shared by physical, magic, and counter criticals. */
function showCriticalCutIn(unit) {
    if (!unit || !gameScreen) return;

    document.getElementById("criticalCutIn")?.remove();
    clearTimeout(criticalCutInTimer);
    clearTimeout(criticalCutInExitTimer);

    const layer = document.createElement("div");
    const portrait = getPortraitSrc(unit) || unit.portraitImage || unit.tokenImage || "";
    const side = unit.side === "enemy" ? "enemy" : "ally";

    layer.id = "criticalCutIn";
    layer.className = `criticalCutIn ${side}`;
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-live", "assertive");
    layer.setAttribute("aria-label", `${unit.name}の必殺`);
    layer.innerHTML = `
        <div class="criticalCutInBand">
            <div class="criticalCutInPortrait" aria-hidden="true"></div>
            <div class="criticalCutInCopy">
                <small>CRITICAL STRIKE</small>
                <strong>必殺</strong>
                <span>${unit.name}</span>
            </div>
            <i class="criticalCutInEdge" aria-hidden="true"></i>
        </div>`;

    if (portrait) {
        layer.querySelector(".criticalCutInPortrait").style.backgroundImage = `url("${portrait}")`;
    }

    gameScreen.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add("active"));

    criticalCutInExitTimer = setTimeout(() => layer.classList.add("exit"), 820);
    criticalCutInTimer = setTimeout(() => layer.remove(), 1100);
}

// =============================================
// 宣言制：敵行動予告
// 味方フェーズ開始時に敵の次行動を表示し、敵フェーズでは予告マスへ実行する。
// =============================================
const DECLARATION_MODE = true;
let enemyDeclarations = new Map();

function clearDeclarationCells() {
    for (const cell of battleGrid.children) cell.classList.remove("declAttackCell");
    unitLayer.querySelectorAll(".declTargeted").forEach(el => el.classList.remove("declTargeted"));
}

/** Execute the forecasted action, then close the preview after processing finishes. */
function executePendingBattlePreview() {
    if (!_vsAttack) return;

    const { attacker, target, isMagic, spell } = _vsAttack;
    clearHighlights();

    try {
        if (isMagic) executeMagic(attacker, spell, target);
        else executeAttack(attacker, target);
    } catch (error) {
        console.error("Battle execution failed", error);
        hideBattlePreview();
        addLog(`・戦闘処理エラー: ${error?.message || "不明なエラー"}`);
        showMessage("SYSTEM", "攻撃処理中にエラーが発生しました。ログを確認してください。");
        return;
    }

    hideBattlePreview();
}

function clearDeclarations() {
    enemyDeclarations = new Map();
    const layer = document.getElementById("declLayer");
    if (layer) layer.innerHTML = "";
    clearDeclarationCells();
}

function getDeclLayer() {
    let layer = document.getElementById("declLayer");
    if (!layer) {
        layer = document.createElement("div");
        layer.id = "declLayer";
        unitLayer.parentNode.insertBefore(layer, unitLayer);
    }
    return layer;
}

function chooseEnemyTarget(enemy, allies) {
    if (!allies.length) return null;
    return allies.reduce((best, unit) => {
        const distance = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y);
        const bestDistance = Math.abs(best.x - enemy.x) + Math.abs(best.y - enemy.y);
        const score = targetPriorityScore(distance, calcBattleStats(unit).raw.app, unit.attentionBonus || 0);
        const bestScore = targetPriorityScore(bestDistance, calcBattleStats(best).raw.app, best.attentionBonus || 0);
        return score < bestScore ? unit : best;
    });
}

function planEnemyActions() {
    enemyDeclarations = new Map();
    if (!DECLARATION_MODE || battleOver || BATTLE_DEFINITIONS[currentBattleId]?.passive) {
        renderDeclarations();
        syncLandscapeBattleUi(selectedUnit);
        return;
    }

    const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
    const enemies = battleUnits.filter(u => u.side === "enemy" && u.hp > 0);
    if (aliveAllies.length === 0 || enemies.length === 0) {
        renderDeclarations();
        syncLandscapeBattleUi(selectedUnit);
        return;
    }

    const reserved = new Set();

    for (const enemy of enemies) {
        if ((enemy.statusEffects || []).some(e => e.type === "stun")) {
            enemyDeclarations.set(enemy.id, { type: "stun" });
            reserved.add(`${enemy.x},${enemy.y}`);
            continue;
        }

        const target = chooseEnemyTarget(enemy, aliveAllies);

        let dest = { x: enemy.x, y: enemy.y };
        const distNow = Math.abs(target.x - enemy.x) + Math.abs(target.y - enemy.y);
        if (distNow > enemy.attackRange) {
            const candidates = getMoveRange(enemy).filter(c => !reserved.has(`${c.col},${c.row}`));
            if (candidates.length > 0) {
                const best = candidates.reduce((b, c) => {
                    const d = Math.abs(c.col - target.x) + Math.abs(c.row - target.y);
                    const bd = Math.abs(b.col - target.x) + Math.abs(b.row - target.y);
                    return d < bd ? c : b;
                });
                if (Math.abs(best.col - target.x) + Math.abs(best.row - target.y) < distNow) {
                    dest = { x: best.col, y: best.row };
                }
            }
        }
        reserved.add(`${dest.x},${dest.y}`);

        const distAfter = Math.abs(target.x - dest.x) + Math.abs(target.y - dest.y);
        if (distAfter <= enemy.attackRange) {
            enemyDeclarations.set(enemy.id, {
                type: "attack",
                dest,
                targetId: target.id,
                targetName: target.name,
            });
        } else if (dest.x !== enemy.x || dest.y !== enemy.y) {
            enemyDeclarations.set(enemy.id, { type: "move", dest });
        } else {
            enemyDeclarations.set(enemy.id, { type: "wait" });
        }
    }
    renderDeclarations();
    syncLandscapeBattleUi(selectedUnit);
}

/** 攻撃レーザー用：進行方向に対して横へ膨らむ3次ベジェ。
 *  同じ対象へ複数の宣言が集まっても重ならないよう、idxごとに曲げる側と量をずらす。 */
function declArcPath(x1, y1, x2, y2, idx) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.max(0.001, Math.hypot(dx, dy));
    const nx = -dy / dist;
    const ny = dx / dist;
    const direction = idx % 2 === 0 ? -1 : 1;
    const spread = Math.min(5 + dist * 0.18 + Math.floor(idx / 2) * 2, 16) * direction;
    const clampX = v => Math.max(1, Math.min(GRID_COLS * 10 - 1, v));
    const clampY = v => Math.max(1, Math.min(GRID_ROWS * 10 - 1, v));
    const c1x = clampX(x1 + dx * 0.30 + nx * spread);
    const c1y = clampY(y1 + dy * 0.30 + ny * spread);
    const c2x = clampX(x1 + dx * 0.70 + nx * spread);
    const c2y = clampY(y1 + dy * 0.70 + ny * spread);
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

/** 宣言表示は「攻撃レーザーのみ」。
 *  MOV点線・バッジ・TARGETラベル等は盤面を汚すため出さない。
 *  攻撃の詳細はユニットパネル側（lsPrediction / 敵情報）で読める */
function renderDeclarations() {
    const layer = getDeclLayer();
    layer.innerHTML = "";
    clearDeclarationCells();
    if (!DECLARATION_MODE || enemyDeclarations.size === 0) return;

    // 1セル=10ユニットの等方座標系。viewBox をマップ縦横比に一致させ、
    // 非正方形マップでも弧が歪まないようにする
    const cx = v => (v + 0.5) * 10;
    const cy = v => (v + 0.5) * 10;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${GRID_COLS * 10} ${GRID_ROWS * 10}`);
    svg.setAttribute("preserveAspectRatio", "none");
    layer.appendChild(svg);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "declTargetArrow");
    marker.setAttribute("viewBox", "0 0 8 8");
    marker.setAttribute("refX", "6.5");
    marker.setAttribute("refY", "4");
    marker.setAttribute("markerWidth", "5");
    marker.setAttribute("markerHeight", "5");
    marker.setAttribute("orient", "auto");
    const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    markerPath.setAttribute("d", "M 0 0 L 8 4 L 0 8 L 2.2 4 Z");
    markerPath.setAttribute("class", "declArrowHead");
    marker.appendChild(markerPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    let idx = 0;
    for (const [id, decl] of enemyDeclarations) {
        const enemy = battleUnits.find(u => u.id === id && u.hp > 0);
        if (!enemy) continue;
        if (decl.type !== "attack" || !decl.targetId) continue;
        const target = battleUnits.find(u => u.id === decl.targetId && u.hp > 0 && u.side === "ally");
        if (!target) continue;

        document.getElementById(`unit_${target.id}`)?.classList.add("declTargeted");

        const startX = cx(enemy.x), startY = cy(enemy.y);
        const targetX = cx(target.x), targetY = cy(target.y);
        const dx = targetX - startX, dy = targetY - startY;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const pathStartX = startX + dx / dist * 2.8;
        const pathStartY = startY + dy / dist * 2.8;
        const pathEndX = targetX - dx / dist * 3.8;
        const pathEndY = targetY - dy / dist * 3.8;
        const pathData = declArcPath(pathStartX, pathStartY, pathEndX, pathEndY, idx);

        const auraPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        auraPath.setAttribute("d", pathData);
        auraPath.setAttribute("class", "declAttackAura");
        auraPath.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(auraPath);

        const attackPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        attackPath.setAttribute("d", pathData);
        attackPath.setAttribute("class", "declAttackLine");
        attackPath.setAttribute("vector-effect", "non-scaling-stroke");
        attackPath.setAttribute("marker-end", "url(#declTargetArrow)");
        svg.appendChild(attackPath);

        const flowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        flowPath.setAttribute("d", pathData);
        flowPath.setAttribute("class", "declAttackFlow");
        flowPath.setAttribute("vector-effect", "non-scaling-stroke");
        flowPath.style.setProperty("--decl-delay", `${idx * -0.16}s`);
        svg.appendChild(flowPath);
        idx++;
    }
}

function getDeclarationLabel(decl) {
    if (!decl) return null;
    if (decl.type === "attack") return `ATK ${decl.targetName || "対象"}を攻撃`;
    if (decl.type === "move") return "MOV 前進";
    if (decl.type === "stun") return "STN 行動不能";
    return "WAIT 待機";
}

async function executeDeclaredAction(enemy, decl) {
    if (decl.type === "stun") {
        addLog(`・${enemy.name}はスタン中のため行動できない`);
        await sleep(350);
        return;
    }

    let victim = null;
    if (decl.type === "attack") {
        victim = battleUnits.find(u => u.id === decl.targetId && u.hp > 0 && u.side === "ally") || null;
        if (!victim) {
            const aliveAllies = battleUnits.filter(u => u.side === "ally" && u.hp > 0);
            victim = chooseEnemyTarget(enemy, aliveAllies);
            if (victim) addLog(`・${enemy.name}は目標を ${victim.name} に切り替えた`);
        }
    }

    let executionDest = decl.dest;
    if (decl.type === "attack" && victim) {
        const currentDist = Math.abs(victim.x - enemy.x) + Math.abs(victim.y - enemy.y);
        if (currentDist > enemy.attackRange) {
            const candidates = getMoveRange(enemy);
            const best = candidates.reduce((choice, c) => {
                const d = Math.abs(c.col - victim.x) + Math.abs(c.row - victim.y);
                if (!choice || d < choice.distance) return { x: c.col, y: c.row, distance: d };
                return choice;
            }, null);
            if (best && best.distance < currentDist) executionDest = { x: best.x, y: best.y };
            else executionDest = { x: enemy.x, y: enemy.y };
        } else {
            executionDest = { x: enemy.x, y: enemy.y };
        }
    }

    if (executionDest && (executionDest.x !== enemy.x || executionDest.y !== enemy.y)) {
        const occupied = battleUnits.find(u => u.hp > 0 && u.id !== enemy.id && u.x === executionDest.x && u.y === executionDest.y);
        if (!occupied && !isTileBlocked(executionDest.x, executionDest.y)) {
            enemy.x = executionDest.x;
            enemy.y = executionDest.y;
            enemy.moved = true;
            addLog(`・${enemy.name}が目標を追って移動した`);
            renderUnits();
            setUnitActing(enemy.id, true);
            await sleep(550);
        } else {
            addLog(`・${enemy.name}は進路を塞がれて移動できない`);
            await sleep(450);
        }
    }

    if (decl.type !== "attack" || !victim) return;

    const dist = Math.abs(victim.x - enemy.x) + Math.abs(victim.y - enemy.y);
    if (dist > enemy.attackRange) {
        addLog(`・${enemy.name}は ${victim.name} に追いつけず攻撃できなかった`);
        await sleep(300);
        return;
    }

    const { val: atkStat, name: atkSkillName } = getAttackSkillVal(enemy);
    const targetStunned = (victim.statusEffects || []).some(e => e.type === "stun");
    const evadeStat = targetStunned ? 0 : getEvadeSkillVal(victim);
    const hit = getBattleHitResult(enemy, victim, atkStat, targetStunned);
    addLog(`・${enemy.name} → ${victim.name} 【${atkSkillName}${atkStat} vs 回避${evadeStat}】 ${hit.note} → ${hit.isHit ? "命中" : "失敗"}`);

    if (hit.isHit) {
        flashUnitHit(victim.id);
        resolvePhysicalHit(enemy, victim, atkSkillName);
        checkVictoryCondition();
        await sleep(700);
    }
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
    syncLandscapeBattleUi(null);

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
                const conRate  = calcBattleStats(u).raw.con * 3;
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

    // パッシブモード（チュートリアル等）：行動しない
    if (BATTLE_DEFINITIONS[currentBattleId]?.passive) {
        enemy.moved = true;
        enemy.acted = true;
        setUnitActing(enemy.id, false);
        addLog(`・${enemy.name}は様子を見ている`);
        return;
    }

    setUnitActing(enemy.id, true);   // 赤ハイライトON

    const declaration = DECLARATION_MODE ? enemyDeclarations.get(enemy.id) : null;
    if (declaration) {
        await executeDeclaredAction(enemy, declaration);
        enemyDeclarations.delete(enemy.id);
        renderDeclarations();
        enemy.moved = true;
        enemy.acted = true;
        setUnitActing(enemy.id, false);
        return;
    }

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

    // 距離を優先し、同程度ならAPP由来の注目度が高い味方を狙う。
    const target = chooseEnemyTarget(enemy, aliveAllies);

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
        const hit = getBattleHitResult(enemy, target, atkStat, targetStunned);
        addLog(`・${enemy.name} → ${target.name} 【${atkSkillName}${atkStat} vs 回避${evadeStat}】 ${hit.note} → ${hit.isHit ? "命中" : "失敗"}`);

        if (hit.isHit) {
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
function isBattleConditionMet(condition, aliveEnemies, aliveAllies) {
    switch (condition?.type) {
        case "defeatAll":
            return aliveEnemies.length === 0;
        case "allAlliesDefeated":
            return aliveAllies.length === 0;
        default:
            return false;
    }
}

function checkVictoryCondition() {
    const aliveEnemies = battleUnits.filter(u => u.side === "enemy" && u.hp > 0);
    const aliveAllies  = battleUnits.filter(u => u.side === "ally"  && u.hp > 0);
    const definition = BATTLE_DEFINITIONS[currentBattleId];
    const victory = definition?.victory || { type: "defeatAll" };
    const defeat = definition?.defeat || { type: "allAlliesDefeated" };

    if (isBattleConditionMet(victory, aliveEnemies, aliveAllies)) {
        battleOver = true;
        if (battleEntrySource === "scenario") {
            updatePartyStateFromBattle(partyState, battleUnits);
        }
        clearDeclarations();
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
    if (isBattleConditionMet(defeat, aliveEnemies, aliveAllies)) {
        battleOver = true;
        clearDeclarations();
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
    commandHeader.textContent = `${unit.name}  Lv ${unit.level}`;
    commandInfo.innerHTML     = "";   // textContent="" は空テキストノードを残すため innerHTML で確実に空にする
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
                     accuracyDown:"命中↓", gravityField:"重力場", support:"強化", evasionUp:"回避↑" };
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
                        <span class="unitInfoSubLabel">力</span>
                        <span class="unitInfoSubValue">${calcBattleStats(unit).power}</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">魔力</span>
                        <span class="unitInfoSubValue">${calcBattleStats(unit).magic}</span>
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
    commandHeader.textContent = `${unit.name}  Lv ${unit.level}`;
    commandInfo.innerHTML     = "";
    commandList.innerHTML     = "";
    const declLabel = getDeclarationLabel(enemyDeclarations.get(unit.id));

    const hpPct   = unit.hp / unit.maxHp;
    const mpPct   = unit.mp / unit.maxMp;
    const hpClass = hpPct <= 0.25 ? "critical" : hpPct <= 0.5 ? "low" : "";

    const bgSize = unit.statusBgSize || unit.portraitBgSize || "280%";
    const bgPos  = unit.statusBgPos  || unit.portraitBgPos  || "top center";
    const statusStr = (() => {
        if (!unit.statusEffects || unit.statusEffects.length === 0) return "―";
        const nm = { burn:"火傷", stun:"スタン", barrier:"結界", counter:"カウンター",
                     accuracyDown:"命中↓", gravityField:"重力場", support:"強化", evasionUp:"回避↑" };
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
                        <span class="unitInfoSubLabel">力</span>
                        <span class="unitInfoSubValue">${calcBattleStats(unit).power}</span>
                    </div>
                    <div class="unitInfoSubItem">
                        <span class="unitInfoSubLabel">魔力</span>
                        <span class="unitInfoSubValue">${calcBattleStats(unit).magic}</span>
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
            ${declLabel ? `<div class="unitInfoDeclRow">予告：${declLabel}</div>` : ""}
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
        case "アイテム":
            showItemRadial(unit);
            addLog(`・${unit.name}はアイテムを選択`);
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

function showItemRadial(unit) {
    if (isLandscapeBattleUi()) {
        actionState = null;
        clearHighlights();
        renderLandscapeSubCommandRail(unit, "item");
        return;
    }
    initRadialAtUnit(unit);
    const items = [
        ...(unit.items || []).map((item, idx) => ({
            label: item.name,
            html: `${item.name}<span class="radialBtnSub">使う</span>`,
            idx,
            isBack: false,
        })),
        { label: "戻る", html: `戻る<span class="radialBtnSub">BACK</span>`, isBack: true },
    ];
    const radius = Math.max(50, items.length * 10);
    buildRadialButtons(items, radius, (item) => {
        if (item.isBack) { renderBattleCommands(unit); return; }
        const used = unit.items.splice(item.idx, 1)[0];
        hideRadialMenu();
        if (used.type === "heal") {
            const restored = used.value;
            unit.hp = Math.min(unit.maxHp, unit.hp + restored);
            showDamagePopup(unit.id, restored, "heal");
            renderUnits();
            showMessage("SYSTEM", `${unit.name}は ${used.name} を使った！ HP +${restored}`);
            addLog(`・${unit.name}は ${used.name} を使用 → HP +${restored}（HP ${unit.hp}/${unit.maxHp}）`);
        }
        unit.acted = true;
        endUnitTurn(unit);
    });
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

function getMagicRangeSummary(unit) {
    const ranges = Object.keys(unit?.spells || {})
        .map(name => SPELLS_DATA[name]?.range)
        .filter(range => typeof range === "number" && Number.isFinite(range));
    if (!ranges.length) return "";
    const min = Math.min(...ranges);
    const max = Math.max(...ranges);
    return min === max ? `${max}` : `${min}-${max}`;
}

function getActionRangeSummary(unit) {
    const move = Number(unit?.move) || 0;
    const normalRange = Number(unit?.attackRange) || 1;
    const magicRange = getMagicRangeSummary(unit);
    const parts = [`移動 ${move}`, `通常 ${normalRange}`];
    if (magicRange) parts.push(`魔法 ${magicRange}`);
    return parts.join(" / ");
}

function getCombatArtSummary(unit, base = "attack") {
    const arts = getAvailableCombatArts(unit, base);
    if (!arts.length) return "なし";
    return arts.map(art => art.name).join(" / ");
}

function getPassiveSkillData(skillId) {
    if (!skillId || typeof PASSIVE_SKILLS === "undefined") return null;
    return PASSIVE_SKILLS[skillId] ? { id: skillId, ...PASSIVE_SKILLS[skillId] } : null;
}

function isPassiveSkillImplemented(skillId) {
    return IMPLEMENTED_PASSIVE_SKILL_IDS.has(skillId);
}

function getAvailablePassiveSkills(unit) {
    if (!unit || typeof PASSIVE_SKILLS === "undefined") return [];
    const known = new Set([
        ...(unit.learnedPassives || []),
        ...(unit.equippedPassives || []),
    ]);
    return [...known]
        .filter(id => isPassiveSkillImplemented(id))
        .map(id => getPassiveSkillData(id))
        .filter(Boolean);
}

function renderLandscapeStatusSheet(unit, bs) {
    const pct = (cur, max) => max > 0
        ? Math.max(0, Math.min(100, cur / max * 100))
        : 0;
    const metric = (label, value) => `
        <div class="adventureMetric"><span>${label}</span><b>${value}</b></div>`;
    const listRows = (entries, type) => {
        if (!entries.length) return '<div class="adventureEmpty">―</div>';
        return entries.map(([name, value]) => {
            if (type === "spell") {
                const spell = SPELLS_DATA[name];
                const detail = spell ? `射程${spell.range ?? "―"} / MP ${spell.mpCost ?? "―"}` : "";
                return `<div class="adventureListRow"><span>${name}</span><small>${detail}</small><b>${value}</b></div>`;
            }
            return `<div class="adventureListRow"><span>${name}</span><b>${value}</b></div>`;
        }).join("");
    };
    const abilityRows = (items, emptyText = "なし") => {
        if (!items.length) return `<div class="adventureEmpty">${emptyText}</div>`;
        return items.map(item => `
            <div class="adventureListRow ability">
              <span>${item.name}</span>
              <small>${item.desc || item.track || ""}</small>
              <b>${item.category || item.track || ""}</b>
            </div>`).join("");
    };
    const equipment = typeof unit.equipment === "string"
        ? unit.equipment
        : (unit.equipment?.weapon?.name || unit.weapon?.name || "未装備");
    const itemNames = (unit.items || []).map(item => item?.name || item).filter(Boolean);
    const statusNames = (unit.statusEffects || []).map(effect => effect?.name || effect?.id || effect).filter(Boolean);
    const portrait = getPortraitSrc(unit) || unit.tokenImage || "";
    const damaged = unit.maxHp > 0 && unit.hp / unit.maxHp <= 0.5;
    const portraitSize = damaged
        ? (unit.portraitDmgBgSize || unit.statusBgSize || unit.portraitBgSize || "cover")
        : (unit.statusBgSize || unit.portraitBgSize || "cover");
    const portraitPos = damaged
        ? (unit.portraitDmgBgPos || unit.statusBgPos || unit.portraitBgPos || "center top")
        : (unit.statusBgPos || unit.portraitBgPos || "center top");
    const sideName = unit.side === "ally" ? "味方" : "敵対";
    const counterNames = {
        auto: "自動選択",
        magic_first: "魔法優先",
        physical_only: "物理のみ",
        none: "反撃なし",
    };
    statusModalBody.innerHTML = `
      <div class="adventureSheet">
        <section class="adventureIdentity">
          <div class="adventurePortrait" style="background-image:url('${portrait}');background-size:${portraitSize};background-position:${portraitPos}"></div>
          <div class="adventureNameplate">
            <strong>${unit.name}</strong><span>LV ${unit.level}</span>
          </div>
          <dl class="adventureProfile">
            <div><dt>種族</dt><dd>${unit.race || "―"}</dd></div>
            <div><dt>一族</dt><dd>${unit.clan || "―"}</dd></div>
            <div><dt>所属</dt><dd>${sideName}</dd></div>
            <div><dt>秘伝</dt><dd>${unit.secretArt || "―"}</dd></div>
          </dl>
        </section>

        <section class="adventureVitals adventureRuled">
          <h3>VITAL <span>基礎情報</span></h3>
          <div class="adventureGauge hp">
            <span>HP</span><i><em style="width:${pct(unit.hp, unit.maxHp)}%"></em></i><b>${unit.hp} / ${unit.maxHp}</b>
          </div>
          <div class="adventureGauge mp">
            <span>MP</span><i><em style="width:${pct(unit.mp, unit.maxMp)}%"></em></i><b>${unit.mp} / ${unit.maxMp}</b>
          </div>
          <div class="adventureMetrics coreStats">
            ${metric("勇気", `${getEffectiveCourage(unit)}%`)}${metric("運", bs.raw.luck)}
            ${metric("魅力", bs.raw.app)}${metric("体格", bs.raw.siz)}
          </div>
        </section>

        <section class="adventureBattle adventureRuled">
          <h3>BATTLE <span>戦闘能力</span></h3>
          <div class="adventureMetrics battleStats">
            ${metric("物攻", bs.power)}${metric("魔攻", bs.magic)}
            ${metric("物防", bs.armor)}${metric("魔防", bs.ward)}
            ${metric("命中基礎", bs.baseAccuracy)}${metric("回避基礎", bs.baseEvasion)}
            ${metric("回避最終", bs.evasion)}${metric("反撃率", `${getCounterRate(unit)}%`)}
            ${metric("必殺", criticalValue(getEffectiveCourage(unit), unit.level))}${metric("必殺耐性", criticalAvoidance(bs.raw.app))}
          </div>
          <div class="adventureBattleNote">
            <span>方針</span><b>${counterNames[unit.counterMode] || "自動選択"}</b>
            <span>状態</span><b>${statusNames.join("・") || "通常"}</b>
          </div>
        </section>

        <section class="adventureLoadout adventureRuled">
          <h3>LOADOUT <span>装備・行動</span></h3>
          <div class="adventureLoadoutBlock"><span>武器</span><b>${equipment || "未装備"}</b></div>
          <div class="adventureLoadoutBlock"><span>行動</span><b>${getActionRangeSummary(unit)}</b></div>
          <div class="adventureLoadoutBlock"><span>所持品</span><b>${itemNames.join(" / ") || "なし"}</b></div>
          <div class="adventureLoadoutBlock"><span>発作</span><b>${unit.seizureType || "なし"}</b></div>
        </section>

        <section class="adventureSkills adventureRuled">
          <h3>TRAINING <span>修練度</span></h3>
          <div class="adventureList">${listRows(Object.entries(unit.skills || {}), "skill")}</div>
        </section>

        <section class="adventureBuild adventureRuled">
          <div class="adventureBuildPane">
            <h3>ARTS <span>戦技</span></h3>
            <div class="adventureList">${abilityRows(getAvailableCombatArts(unit), "なし")}</div>
          </div>
          <div class="adventureBuildPane">
            <h3>PASSIVE <span>スキル</span></h3>
            <div class="adventureList">${abilityRows(getAvailablePassiveSkills(unit), "なし")}</div>
          </div>
        </section>

        <div class="adventureSigil" aria-hidden="true"><span></span></div>

        <section class="adventureMagic adventureRuled">
          <h3>MAGIC <span>魔法</span></h3>
          <div class="adventureList">${listRows(Object.entries(unit.spells || {}), "spell")}</div>
        </section>
      </div>`;
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

    const sr = (label, val) =>
        `<div class="statRow"><span class="statLabel">${label}</span><span class="statVal">${val}</span></div>`;
    const hpBar = (cls, name, cur, max) => {
        const pct = max > 0 ? Math.max(0, Math.min(100, cur / max * 100)) : 0;
        return `<div class="hpBarWrap">
          <div class="hpBarLabel">
            <span class="hpBarLabelName">${name}</span>
            <span class="hpBarLabelVal">${cur} / ${max}</span>
          </div>
          <div class="hpBarTrack"><div class="hpBarFill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
    };
    const bs = calcBattleStats(unit);
    const raw = bs.raw;

    statusModalOverlay.classList.toggle("landscapeSheetOpen", isLandscapeBattleUi());
    if (isLandscapeBattleUi()) {
        renderLandscapeStatusSheet(unit, bs);
        return;
    }

    if (tabName === "basic") {
        statusModalBody.innerHTML = `
        <div class="statusSection">
          <h3>基本情報</h3>
          <div class="statusGrid">
            ${sr("Name", unit.name)}
            ${sr("種族", unit.race || "―")}
            ${sr("一族", unit.clan || "―")}
            ${sr("所属", unit.side === "ally" ? "味方" : "敵")}
            ${sr("Lv", unit.level)}
          </div>
        </div>
        <div class="statusSection">
          <h3>HP / MP</h3>
          ${hpBar("hp", "HP", unit.hp, unit.maxHp)}
          ${hpBar("mp", "MP", unit.mp, unit.maxMp)}
        </div>
        <div class="statusSection">
          <h3>基礎情報</h3>
          <div class="statusGrid">
            ${sr("勇気", `${getEffectiveCourage(unit)}%`)}
            ${sr("運", raw.luck)}
            ${sr("魅力", raw.app)}
            ${sr("体格", raw.siz)}
          </div>
        </div>
        <div class="statusSection">
          <h3>戦闘基本</h3>
          <div class="statusGrid">
            ${sr("物攻", bs.power)}
            ${sr("魔攻", bs.magic)}
            ${sr("物防", bs.armor)}
            ${sr("魔防", bs.ward)}
            ${sr("命中基礎", bs.baseAccuracy)}
            ${sr("回避基礎", bs.baseEvasion)}
            ${sr("回避最終", bs.evasion)}
            ${sr("反撃率", `${getCounterRate(unit)}%`)}
            ${sr("必殺", criticalValue(getEffectiveCourage(unit), unit.level))}
            ${sr("必殺耐性", criticalAvoidance(raw.app))}
            ${sr("戦技", getCombatArtSummary(unit))}
          </div>
        </div>`;
        return;
    }
    if (tabName === "skills") {
        const skillLines = Object.entries(unit.skills || {})
            .map(([name, v]) => sr(name, v)).join("");
        const spellLines = Object.entries(unit.spells || {}).map(([name, v]) => {
            const sp = SPELLS_DATA[name];
            const range = typeof sp?.range === "number" ? sp.range : "―";
            return `<div class="statRow">
              <span class="statLabel">${name}</span>
              <span class="statVal">${v}&nbsp;<span style="font-size:10px;opacity:0.6;font-weight:normal">射程${range}</span></span>
            </div>`;
        }).join("");
        const empty = '<div class="statRow"><span class="statVal">―</span></div>';
        statusModalBody.innerHTML = `
        <div class="statusSection">
          <h3>修練度</h3>
          <div class="statusGrid">${skillLines || empty}</div>
        </div>
        <div class="statusSection">
          <h3>魔法</h3>
          <div class="statusGrid">${spellLines || empty}</div>
        </div>
        <div class="statusSection">
          <h3>その他</h3>
          <div class="statusGrid wide">
            ${sr("発作タイプ", unit.seizureType || "―")}
            ${sr("秘伝", unit.secretArt || "―")}
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
    const phaseMeta = text === "味方フェーズ"
        ? { variant: "ally", eyebrow: `TURN ${turnCount} / ROYAL COMMAND`, title: "味方行動", sub: "ALLY PHASE" }
        : text === "敵フェーズ"
            ? { variant: "enemy", eyebrow: `TURN ${turnCount} / HOSTILE FORCE`, title: "敵軍行動", sub: "ENEMY PHASE" }
            : text === "勝利！"
                ? { variant: "victory", eyebrow: "BATTLE COMPLETE", title: "勝利", sub: "VICTORY" }
                : { variant: "defeat", eyebrow: "BATTLE TERMINATED", title: text, sub: "DEFEAT" };

    banner.dataset.variant = phaseMeta.variant;
    banner.setAttribute("aria-label", text);
    banner.innerHTML = `
        <div class="phaseBannerRail" aria-hidden="true"><i></i><b></b><i></i></div>
        <div class="phaseBannerCopy">
            <span class="phaseBannerEyebrow">${phaseMeta.eyebrow}</span>
            <strong>${phaseMeta.title}</strong>
            <span class="phaseBannerSub">${phaseMeta.sub}</span>
        </div>`;
    banner.classList.remove("phaseBannerEnter");
    void banner.offsetWidth;
    banner.classList.add("phaseBannerEnter");
    banner.classList.remove("hidden");
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => banner.classList.add("hidden"), 1650);
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
    setLandscapeHint(text);
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
    gameScreen.dataset.mode = "scenario";
    switchTopLayer("dialogue");
    battleGrid.style.display  = "none";   // グリッド線を非表示
    unitLayer.style.display   = "none";   // ユニットトークンを非表示
    document.getElementById("declLayer")?.style.setProperty("display", "none");
    requestAnimationFrame(scaleGame);
}

/** バトル用レイアウトに戻す */
function exitScenarioLayout() {
    battleGrid.style.display  = "";
    unitLayer.style.display   = "";
    document.getElementById("declLayer")?.style.removeProperty("display");
    requestAnimationFrame(scaleGame);
}

/**
 * シナリオキャラ立ち絵レイヤーを再描画する
 * @param {string} speaker - 現在の話者名（アクティブハイライト用）
 */
// シナリオ立ち絵5タップ検出用
let _scenTapCount = 0, _scenTapTimer = null, _scenTapName = null;

function updateScenarioCharLayer(speaker) {
    scenarioCharLayer.innerHTML = "";
    scenarioCharLayer.className = `count-${scenarioCharacters.length}`;
    const speakerBadge = document.getElementById("scenarioSpeakerBadge");
    const speakerPortrait = document.getElementById("scenarioSpeakerPortrait");
    const speakerIndex = scenarioCharacters.findIndex(entry =>
        (typeof entry === "string" ? entry : entry.name) === speaker
    );
    if (speakerBadge) {
        speakerBadge.classList.toggle("hidden", speakerIndex < 0 || speaker === "──");
        speakerBadge.dataset.side = speakerIndex >= Math.ceil(scenarioCharacters.length / 2)
            ? "right"
            : "left";
        dialogueBox.dataset.speakerSide = speakerBadge.dataset.side;
    }
    if (speakerPortrait) speakerPortrait.style.backgroundImage = "";
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
        if (sBgSize) {
            const landscapeMatch = window.innerWidth > window.innerHeight
                ? sBgSize.match(/^auto\s+(\d+(?:\.\d+)?)%$/)
                : null;
            portrait.style.backgroundSize = landscapeMatch
                ? `auto ${Math.round(Number(landscapeMatch[1]) * 1.18)}%`
                : sBgSize;
        }
        if (sBgPos)  portrait.style.backgroundPosition = sBgPos;

        if (name === speaker && speakerPortrait && image) {
            speakerPortrait.style.backgroundImage = `url('${image}')`;
        }

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

function startChapter(chapterId, startIdx = 0, initialCharacters = null) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch) { console.warn("Chapter not found:", chapterId); return; }
    currentChapter  = ch;
    currentSceneIdx = startIdx;
    scenarioActive  = true;
    gameMode        = "scenario";

    clearHighlights();
    hideRadialMenu();
    scenarioCharacters = initialCharacters ? initialCharacters.slice() : [];
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
    if (!forcedUiTheme && scene.uiTheme) setUiTheme(scene.uiTheme);
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

function playBattleScene(scene) {
    if (!BATTLE_DEFINITIONS[scene.battleId]) {
        console.warn("Battle definition not found:", scene.battleId);
        showMessage("SYSTEM", `戦闘データ ${scene.battleId} が見つかりません。`);
        advanceScene();
        return;
    }
    scenarioActive               = false;
    dialogueBox.dataset.scenario = "";
    exitScenarioLayout();
    startBattleSession(scene.battleId, { source: "scenario" });
}

function resumeScenarioAfterBattle() {
    if (!fromScenario) return;
    fromScenario   = false;
    battleEntrySource = "none";
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
    gameScreen.dataset.mode = "scenario";
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

function startBattleSession(battleId, options = {}) {
    const source = options.source || "manual";
    if (!BATTLE_DEFINITIONS[battleId]) {
        console.warn("Battle definition not found:", battleId);
        showMessage("SYSTEM", `戦闘データ ${battleId} が見つかりません。`);
        return false;
    }

    currentBattleId = battleId;
    battleEntrySource = source;
    fromScenario = source === "scenario";
    setBattleMode(battleId);
    return true;
}

function setBattleMode(battleId) {
    exitScenarioLayout();   // シナリオレイアウトが残っていたらリセット
    gameScreen.dataset.mode = "battle";
    gameScreen.dataset.battleSource = battleEntrySource;
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
    clearDeclarations();
    setEnemyDangerVisible(false);

    const def = battleId && BATTLE_DEFINITIONS[battleId];
    setUiTheme(forcedUiTheme || def?.uiTheme || "orcus");
    currentMapItems = (def?.mapItems || []).map(mi => ({ ...mi, item: { ...mi.item } }));
    createGrid(def?.cols ?? 10, def?.rows ?? 10, def?.tiles ?? []);
    if (def?.background) {
        bgImage.src = def.background;
        topPanelBg.src = def.background;
        // 横画面シェルは画面全体に背景を敷く（プロトタイプ準拠）
        landscapeBattleShell?.style.setProperty("--ls-bg", `url("${encodeURI(def.background)}")`);
    }
    const sourceData = def
        ? CHARACTERS_DATA.filter(c => def.unitIds.includes(c.id))
        : CHARACTERS_DATA;
    const usePersistentParty = battleEntrySource === "scenario";

    // CHARACTERS_DATA をディープコピーして live データとして使用
    battleUnits = sourceData.map(c => {
        const pos = def?.positions?.[c.id] ?? { x: c.x, y: c.y };
        const partyMember = usePersistentParty ? partyState.members[c.id] : null;
        const sourceCharacter = partyMember ? { ...c, level: partyMember.level } : c;
        const battleStats = calcBattleStats(sourceCharacter);
        const resources = getPartyBattleResources(
            partyState,
            sourceCharacter,
            battleStats,
            usePersistentParty && c.side === "ally"
        );
        return {
            ...sourceCharacter,
            x: pos.x,
            y: pos.y,
            level: resources.level,
            hp: resources.hp,
            maxHp: battleStats.hp,
            mp: resources.mp,
            maxMp: battleStats.mp,
            items: resources.items,
            learnedArts: resources.learnedArts,
            equippedArts: resources.equippedArts,
            learnedPassives: resources.learnedPassives,
            equippedPassives: resources.equippedPassives,
            buildChoices: resources.buildChoices,
            combatArtUses: {},
            moved: false,
            acted: false,
            statusEffects: [],
            spells: { ...c.spells },
            skills: { ...c.skills },
            physicalBonus: `力${battleStats.power}`,
            magicBonus:    `魔${battleStats.magic}`,
            battleStats,
        };
    });
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
    renderMapItems();
    planEnemyActions();
    renderIdlePanel();
    syncLandscapeBattleUi(null);
}

function renderMapItems() {
    for (const el of battleGrid.querySelectorAll(".mapItemToken")) el.remove();
    for (const mi of currentMapItems) {
        const cell = getCell(mi.y, mi.x);
        if (!cell) continue;
        const token = document.createElement("div");
        token.className = "mapItemToken";
        token.title = mi.item.name;
        cell.appendChild(token);
    }
}

// =============================================
// シナリオコマンド
// =============================================
const SCENARIO_CMD_ICONS = {
    "セーブ":    `<svg class="cmdIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/><rect x="3.5" y="1.5" width="4" height="3"/><rect x="3.5" y="7" width="5" height="2.5" rx="0.5"/></svg>`,
    "ロード":    `<svg class="cmdIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 2A4 4 0 1 0 10 6.5"/><polyline points="10,2.5 10,6.5 6,6.5"/></svg>`,
    "アイテム":  `<svg class="cmdIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 1.5 L10.5 6 L6 10.5 L1.5 6 Z"/><line x1="6" y1="3.5" x2="6" y2="8.5"/><line x1="3.5" y1="6" x2="8.5" y2="6"/></svg>`,
    "ステータス":`<svg class="cmdIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="3.5" r="1.8"/><path d="M2.5 10.5C2.5 8.3 4.1 7 6 7s3.5 1.3 3.5 3.5"/></svg>`,
    "ログ":      `<svg class="cmdIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="1.5" width="8" height="9" rx="1"/><line x1="4" y1="4.5" x2="8" y2="4.5"/><line x1="4" y1="6.5" x2="8" y2="6.5"/><line x1="4" y1="8.5" x2="7" y2="8.5"/></svg>`,
    "設定":      `<svg class="cmdIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.5 1.5M8 8l1.5 1.5M9.5 2.5L8 4M4 8l-1.5 1.5"/></svg>`,
};

function renderScenarioCommands() {
    commandHeader.textContent = "command";
    commandInfo.textContent   = "";
    commandList.innerHTML     = "";

    const grid = document.createElement("div");
    grid.className = "scenarioCmdGrid";
    commandList.appendChild(grid);

    for (const label of ["セーブ", "ロード", "アイテム", "ステータス", "ログ", "設定"]) {
        const btn = document.createElement("button");
        btn.className = "commandItem";
        btn.innerHTML = `${SCENARIO_CMD_ICONS[label] || ""}<span>${label}</span>`;
        btn.addEventListener("click", () => handleScenarioCommand(label));
        grid.appendChild(btn);
    }

    const audio = document.createElement("div");
    audio.className = "audioSliders";
    audio.innerHTML = `
      <div class="audioRow">
        <span class="audioNote">♩</span>
        <span class="audioLabel">BGM</span>
        <div class="sliderTrack" data-vol="bgm">
          <div class="sliderFill" style="width:70%"><div class="sliderKnob"></div></div>
        </div>
      </div>
      <div class="audioRow">
        <span class="audioNote">◈</span>
        <span class="audioLabel">SE</span>
        <div class="sliderTrack" data-vol="se">
          <div class="sliderFill" style="width:80%"><div class="sliderKnob"></div></div>
        </div>
      </div>`;
    commandList.appendChild(audio);

    audio.querySelectorAll(".sliderTrack").forEach(track => {
        const fill = track.querySelector(".sliderFill");
        const setVol = (clientX) => {
            const rect = track.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            fill.style.width = (x * 100) + "%";
        };
        let dragging = false;
        track.addEventListener("mousedown", e => { dragging = true; setVol(e.clientX); });
        document.addEventListener("mousemove", e => { if (dragging) setVol(e.clientX); });
        document.addEventListener("mouseup", () => { dragging = false; });
        track.addEventListener("touchstart", e => { e.preventDefault(); setVol(e.touches[0].clientX); }, { passive: false });
        track.addEventListener("touchmove", e => { e.preventDefault(); setVol(e.touches[0].clientX); }, { passive: false });
    });
}

// =============================================
// セーブ / ロード
// =============================================
const SL_KEY   = slot => `srpg_save_${slot}`;
const SL_SLOTS = 3;

function getSaveData(slot) {
    try { return JSON.parse(localStorage.getItem(SL_KEY(slot))); } catch { return null; }
}

function saveGame(slot) {
    if (!currentChapter || !scenarioActive) {
        showMessage("SYSTEM", "シナリオ中のみセーブできます。");
        return false;
    }
    const d = new Date();
    const savedAt = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    localStorage.setItem(SL_KEY(slot), JSON.stringify({
        saveVersion: 2,
        chapterId:  currentChapter.id,
        sceneIdx:   currentSceneIdx,
        bgSrc:      bgImage.getAttribute("src"),
        topBgSrc:   topPanelBg.getAttribute("src"),
        partyState: clonePartyState(partyState),
        savedAt,
        preview:    currentChapter.title,
    }));
    return true;
}

function loadGame(slot) {
    const data = getSaveData(slot);
    if (!data) return false;
    closeSaveLoadModal();

    const ch = CHAPTERS.find(c => c.id === data.chapterId);
    partyState = createPartyState(CHARACTERS_DATA, calcBattleStats, data.partyState);

    // 背景を復元（保存データ優先、なければシーン履歴を遡る）
    if (data.bgSrc) {
        bgImage.src    = data.bgSrc;
        topPanelBg.src = data.topBgSrc || data.bgSrc;
    } else if (ch) {
        for (let i = data.sceneIdx; i >= 0; i--) {
            if (ch.scenes[i]?.bg) {
                bgImage.src    = ch.scenes[i].bg;
                topPanelBg.src = ch.scenes[i].bg;
                break;
            }
        }
    }

    // 立ち絵を復元（シーン履歴を遡って直近の setCharacters を探す）
    let restoredChars = null;
    if (ch) {
        for (let i = data.sceneIdx; i >= 0; i--) {
            if (ch.scenes[i]?.setCharacters !== undefined) {
                restoredChars = ch.scenes[i].setCharacters.slice();
                break;
            }
        }
    }

    startChapter(data.chapterId, data.sceneIdx, restoredChars);
    return true;
}

let _slMode = "save";

function openSaveModal() { _slMode = "save"; _renderSlModal(); saveLoadModal.classList.add("active"); }
function openLoadModal() { _slMode = "load"; _renderSlModal(); saveLoadModal.classList.add("active"); }
function closeSaveLoadModal() { saveLoadModal.classList.remove("active"); }

function _renderSlModal() {
    const isSave = _slMode === "save";
    slotContainer.innerHTML = "";
    for (let i = 1; i <= SL_SLOTS; i++) {
        const data = getSaveData(i);
        const btn  = document.createElement("button");
        btn.className = "slSlot";
        if (data) {
            btn.innerHTML = `<span class="slSlotNum">${i}</span><div class="slSlotInfo"><div class="slSlotPreview">${data.preview}</div><div class="slSlotDate">${data.savedAt} &nbsp; Sc.${data.sceneIdx + 1}</div></div>`;
        } else {
            btn.innerHTML = `<span class="slSlotNum">${i}</span><div class="slSlotInfo"><span class="slSlotEmpty">空きスロット</span></div>`;
            if (!isSave) btn.disabled = true;
        }
        btn.addEventListener("click", () => {
            if (isSave) {
                if (saveGame(i)) {
                    closeSaveLoadModal();
                    showMessage("SYSTEM", `スロット ${i} にセーブしました。`);
                }
            } else {
                loadGame(i);
            }
        });
        slotContainer.appendChild(btn);
    }
    slTitleEl.textContent = isSave ? "SAVE" : "LOAD";
}

// モーダルDOM
const saveLoadModal = document.createElement("div");
saveLoadModal.id = "saveLoadModal";
const slPanel = document.createElement("div");
slPanel.className = "slPanel";
const slTitleEl = document.createElement("div");
slTitleEl.className = "slTitle";
const slotContainer = document.createElement("div");
const slClose = document.createElement("div");
slClose.className = "slClose";
slClose.textContent = "[ CLOSE ]";
slClose.addEventListener("click", closeSaveLoadModal);
saveLoadModal.addEventListener("click", e => { if (e.target === saveLoadModal) closeSaveLoadModal(); });
slPanel.append(slTitleEl, slotContainer, slClose);
saveLoadModal.appendChild(slPanel);
document.body.appendChild(saveLoadModal);

function handleScenarioCommand(label) {
    if (label === "セーブ") { openSaveModal(); return; }
    if (label === "ロード") { openLoadModal(); return; }
    if (label === "ステータス") {
        const first = CHARACTERS_DATA.find(c => c.side === "ally");
        if (first) openStatusModal(first.id);
        return;
    }
    if (label === "ログ") {
        showMessage("システム", "ログ機能は未実装です。");
        return;
    }
    showMessage("システム", `${label}を開きます。`);
    addLog(`・「${label}」を選択しました`);
}

// =============================================
// イベントリスナー
// =============================================
function setModeButtonActive(mode) {
    scenarioModeButton.classList.toggle("active", mode === "scenario");
    battleModeButton.classList.toggle("active",   mode === "battle");
}

scenarioModeButton.addEventListener("click", () => { startChapter("prologue"); setModeButtonActive("scenario"); });
dialogueBox.addEventListener("click", () => { if (scenarioActive) advanceScene(); });
document.addEventListener("keydown", (e) => {
    if (!scenarioActive) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advanceScene(); }
});
battleModeButton.addEventListener("click", () => {
    startBattleSession(currentBattleId, { source: "manual" });
    setModeButtonActive("battle");
});
setModeButtonActive("scenario");

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
let mapViewMode = "top";
const MAP_ZOOM_MIN = 0.6, MAP_ZOOM_MAX = 4.0;

function applyMapTransform() {
    const viewTransform = mapViewMode === "iso"
        ? "perspective(520px) rotateX(48deg) rotateZ(-8deg) scale(1.16)"
        : "";
    battleCanvas.style.transform =
        `translate(${mapPanX}px,${mapPanY}px) scale(${mapZoom}) ${viewTransform}`.trim();
}

function setMapViewMode(mode) {
    mapViewMode = mode === "iso" ? "iso" : "top";
    battleBoard.classList.toggle("mapViewIso", mapViewMode === "iso");
    document.getElementById("mapViewToggle").textContent = mapViewMode === "iso" ? "2D" : "視点";
    applyMapTransform();
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
document.getElementById("mapViewToggle").addEventListener("click", e => {
    e.stopPropagation();
    setMapViewMode(mapViewMode === "iso" ? "top" : "iso");
});
dangerRangeToggle?.addEventListener("click", e => {
    e.stopPropagation();
    setEnemyDangerVisible(!enemyDangerVisible);
    setLandscapeHint(enemyDangerVisible
        ? "敵全体の移動後攻撃範囲を表示中。"
        : "敵全体の危険域を非表示にしました。");
});

// =============================================
// スケール調整（デザインサイズ390×844を画面にフィット）
// =============================================
function scaleGame() {
    const viewport = window.visualViewport || window;
    const viewportW = viewport.width || window.innerWidth;
    const viewportH = viewport.height || window.innerHeight;
    const isLandscapeGame = viewportW > viewportH;
    const baseW = isLandscapeGame ? 844 : 390;
    const baseH = isLandscapeGame ? 390 : 844;
    const mobileReserve = !isLandscapeGame && viewportW <= 480
        ? Math.min(36, Math.max(18, viewportH * 0.035))
        : 0;
    const s = Math.min(viewportW / baseW, (viewportH - mobileReserve) / baseH);
    document.getElementById("gameScreen").style.transform = `scale(${s})`;
    syncLandscapeBattleUi(selectedUnit);
}
window.addEventListener("resize", scaleGame);
window.visualViewport?.addEventListener("resize", scaleGame);

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
    const hasSave = Array.from({length: SL_SLOTS}, (_, i) => getSaveData(i + 1)).some(Boolean);
    homeContinueBtn.disabled = !hasSave;
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
    hideHomeScreen(() => {
        partyState = createPartyState(CHARACTERS_DATA, calcBattleStats);
        startChapter("prologue");
    });
});

homeContinueBtn.addEventListener("click", () => {
    const hasSave = Array.from({length: SL_SLOTS}, (_, i) => getSaveData(i + 1)).some(Boolean);
    if (!hasSave) {
        showMessage("SYSTEM", "セーブデータがありません。");
        return;
    }
    hideHomeScreen(() => openLoadModal());
});

homeSettingsBtn.addEventListener("click", () => {
    showMessage("SYSTEM", "設定は準備中です。");
});

function launchDebugBattle(battleId, source) {
    if (!BATTLE_DEFINITIONS[battleId]) {
        console.warn("Debug battle definition not found:", battleId);
        return;
    }
    hideHomeScreen(() => {
        partyState = createPartyState(CHARACTERS_DATA, calcBattleStats);
        startBattleSession(battleId, { source });
        setModeButtonActive("battle");
        addLog(`・デバッグ起動 ${battleId}`);
    });
}

debugStoryBattleBtn?.addEventListener("click", () => {
    launchDebugBattle("battle_tutorial", "manual");
});

debugTestBattleBtn?.addEventListener("click", () => {
    launchDebugBattle("battle_ch1", "test");
});

// =============================================
// 初期化
// =============================================
const bootBattleId = BATTLE_DEFINITIONS[initialBattleId] ? initialBattleId : currentBattleId;
const bootSource = initialBattleId && BATTLE_DEFINITIONS[initialBattleId] ? "test" : "bootstrap";
startBattleSession(bootBattleId, { source: bootSource });
renderIdlePanel();
buildLoadingScreen();  // ローディング画面を構築
if (initialBattleId && BATTLE_DEFINITIONS[initialBattleId]) {
    homeScreen.style.display = "none";
    setModeButtonActive("battle");
    addLog(`・テスト戦闘 ${initialBattleId} を直接開始`);
} else {
    showHomeScreen();      // ホーム画面（ローディング画面の下に先に準備）
}
scaleGame();

// 2.8秒後にローディング画面をフェードアウト
setTimeout(() => {
    const ls = document.getElementById('loadingScreen');
    ls.classList.add('ls-fade-out');
    setTimeout(() => { ls.style.display = 'none'; }, 1000);
}, 2800);

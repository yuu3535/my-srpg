// =====================================================================
//  briefingUi.js ― 出撃準備（ブリーフィング）画面
//
//  戦闘開始前に挟むフェーズ。円形のメニューから「ユニット選択」「身支度」などを選ぶ。
//  現在は試験の戦闘（isTrialBattleSession）だけで開く。game.js の後に読み込む。
//  身支度（スキル・戦技のセット入れ替え）は trialStatSystem.js の純粋処理を使う。
//  ショップ・支援・セーブ・システムは未実装（押すと「準備中」）。
// =====================================================================

const BRIEFING_ITEMS = Object.freeze([
    { id: "units",   label: "ユニット選択", help: "出撃するユニットを選択します" },
    { id: "gear",    label: "身支度",       help: "スキル・戦技のセットを入れ替えます" },
    { id: "save",    label: "セーブ",       help: "セーブは準備中です", pending: true },
    { id: "system",  label: "システム",     help: "システム設定は準備中です", pending: true },
    { id: "back",    label: "戻る",         help: "出撃をやめてホーム画面へ戻ります" },
    { id: "shop",    label: "ショップ",     help: "ショップは準備中です", pending: true },
    { id: "support", label: "支援",         help: "支援会話は準備中です", pending: true },
    { id: "map",     label: "マップ・配置", help: "マップと敵の配置を確認します" },
]);

const BRIEFING_CATEGORY_LABELS = Object.freeze({
    classSkills: "通常兵種スキル",
    causeSkills: "因果スキル",
    combatArts: "戦技",
});

const BRIEFING_ART_KIND_LABELS = Object.freeze({
    physicalArt: "物理", magicArt: "魔法", art: "戦技", exclusiveArt: "専用",
});

const briefingState = {
    active: false,
    view: "menu",        // menu / units / gear / map
    index: 0,
    gearUnitId: null,
    root: null,
};

function isBriefingActive() {
    return briefingState.active;
}

function briefingAllies() {
    return battleUnits.filter(unit => unit.side === "ally");
}

// ── 円形メニュー（SVGの装飾＋HTMLのボタン） ──

function buildBriefingRing() {
    const ns = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs = {}) => {
        const el = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    };
    const svg = mk("svg", { viewBox: "-170 -170 340 340", class: "brfRingSvg", "aria-hidden": "true" });
    const defs = mk("defs");
    defs.innerHTML = `
        <radialGradient id="brfBand" cx="0" cy="0" r="170" gradientUnits="userSpaceOnUse">
            <stop offset="0.86" stop-color="#1c1030"/><stop offset="1" stop-color="#3a1f56"/>
        </radialGradient>
        <linearGradient id="brfWedge" x1="0" y1="-150" x2="0" y2="-62" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#7a45c2" stop-opacity="0.95"/><stop offset="1" stop-color="#3a1a66" stop-opacity="0.75"/>
        </linearGradient>`;
    svg.appendChild(defs);

    // 外周の帯と目盛り
    svg.appendChild(mk("circle", { r: 166, fill: "url(#brfBand)", stroke: "#c8922a", "stroke-width": 1.2 }));
    const ticks = mk("g", { class: "brfTicks" });
    for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const long = i % 12 === 0;
        const r1 = 152, r2 = long ? 162 : 157;
        ticks.appendChild(mk("line", {
            x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2,
            stroke: "#c8922a", "stroke-opacity": long ? 0.85 : 0.4, "stroke-width": long ? 1.4 : 0.7,
        }));
    }
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ticks.appendChild(mk("rect", {
            x: -3.2, y: -3.2, width: 6.4, height: 6.4,
            transform: `translate(${Math.sin(a) * 159} ${-Math.cos(a) * 159}) rotate(45)`,
            fill: "#e0b048", stroke: "#6b4a12", "stroke-width": 0.6,
        }));
    }
    svg.appendChild(ticks);

    // 本体の盤
    svg.appendChild(mk("circle", { r: 150, fill: "rgba(12,9,18,0.94)", stroke: "#c8922a", "stroke-opacity": 0.7, "stroke-width": 0.8 }));

    // 選択中の扇形（回転で移動する）
    const wedge = mk("g", { class: "brfWedge" });
    const arc = (r, deg) => {
        const a = deg * Math.PI / 180;
        return `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    };
    wedge.appendChild(mk("path", {
        d: `M ${arc(66, -22.5)} L ${arc(149, -22.5)} A 149 149 0 0 1 ${arc(149, 22.5)} L ${arc(66, 22.5)} A 66 66 0 0 0 ${arc(66, -22.5)} Z`,
        fill: "url(#brfWedge)", stroke: "#e0b048", "stroke-width": 1.1,
    }));
    wedge.appendChild(mk("path", {
        d: `M ${arc(140, -18)} A 140 140 0 0 1 ${arc(140, 18)}`,
        fill: "none", stroke: "#f1d48d", "stroke-opacity": 0.55, "stroke-width": 0.8,
    }));
    svg.appendChild(wedge);

    // 区切り線（二重線）
    for (let i = 0; i < 8; i++) {
        const deg = i * 45 + 22.5;
        for (const offset of [-1.1, 1.1]) {
            svg.appendChild(mk("line", {
                x1: arc(66, deg + offset / 3).split(" ")[0], y1: arc(66, deg + offset / 3).split(" ")[1],
                x2: arc(149, deg + offset / 6).split(" ")[0], y2: arc(149, deg + offset / 6).split(" ")[1],
                stroke: "#c8922a", "stroke-opacity": 0.28, "stroke-width": 0.6,
            }));
        }
    }

    // 内側の輪と目盛り
    svg.appendChild(mk("circle", { r: 64, fill: "none", stroke: "#c8922a", "stroke-width": 1.6 }));
    const inner = mk("g", { class: "brfInnerTicks" });
    for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        inner.appendChild(mk("line", {
            x1: Math.sin(a) * 55, y1: -Math.cos(a) * 55, x2: Math.sin(a) * 61, y2: -Math.cos(a) * 61,
            stroke: "#c8922a", "stroke-opacity": i % 4 === 0 ? 0.9 : 0.45, "stroke-width": i % 4 === 0 ? 1.4 : 0.7,
        }));
    }
    svg.appendChild(inner);
    svg.appendChild(mk("circle", { r: 53, fill: "rgba(30,24,34,0.96)", stroke: "#c8922a", "stroke-opacity": 0.55, "stroke-width": 0.8 }));
    // 中心の控えめな紋章
    svg.appendChild(mk("path", {
        d: "M0 -34 L6 -8 L30 0 L6 8 L0 34 L-6 8 L-30 0 L-6 -8 Z",
        fill: "none", stroke: "#c8922a", "stroke-opacity": 0.22, "stroke-width": 1,
    }));
    return svg;
}

function createBriefingRoot() {
    const root = document.createElement("div");
    root.id = "briefingOverlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "出撃準備");
    root.innerHTML = `
        <div class="brfRibbon"><span>ブリーフィング</span></div>
        <div class="brfMenu">
            <div class="brfRing"></div>
            <div class="brfItems"></div>
            <button type="button" class="brfStart" data-id="start">
                <i aria-hidden="true">✦</i><span>戦闘開始</span><i aria-hidden="true">✦</i>
            </button>
        </div>
        <div class="brfPanel hidden" role="region"></div>
        <button type="button" class="brfMapReturn hidden">出撃準備に戻る</button>
        <div class="brfHelp"><span class="brfHelpText"></span></div>
    `;
    root.querySelector(".brfRing").appendChild(buildBriefingRing());

    const items = root.querySelector(".brfItems");
    BRIEFING_ITEMS.forEach((item, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `brfItem${item.pending ? " pending" : ""}`;
        btn.dataset.index = String(index);
        const angle = index * 45 * Math.PI / 180;
        btn.style.left = `${50 + Math.sin(angle) * 32}%`;
        btn.style.top = `${50 - Math.cos(angle) * 32}%`;
        btn.innerHTML = `<span>${item.label}</span>`;
        btn.addEventListener("mouseenter", () => setBriefingIndex(index));
        btn.addEventListener("focus", () => setBriefingIndex(index));
        btn.addEventListener("click", () => activateBriefingItem(item));
        items.appendChild(btn);
    });

    const start = root.querySelector(".brfStart");
    start.addEventListener("mouseenter", () => setBriefingHelp("この編成で戦闘を開始します"));
    start.addEventListener("focus", () => setBriefingHelp("この編成で戦闘を開始します"));
    start.addEventListener("click", startBriefingBattle);
    root.querySelector(".brfMapReturn").addEventListener("click", () => showBriefingView("menu"));
    return root;
}

function setBriefingHelp(text) {
    const el = briefingState.root?.querySelector(".brfHelpText");
    if (el) el.textContent = text;
}

function setBriefingIndex(index) {
    const count = BRIEFING_ITEMS.length;
    const next = ((index % count) + count) % count;
    // 最短方向に回すため、角度は累積で持つ
    const prev = briefingState.index;
    let delta = next - (((prev % count) + count) % count);
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    briefingState.index = prev + delta;
    const root = briefingState.root;
    if (!root) return;
    root.querySelector(".brfWedge").style.transform = `rotate(${briefingState.index * 45}deg)`;
    root.querySelectorAll(".brfItem").forEach(btn => {
        btn.classList.toggle("selected", Number(btn.dataset.index) === next);
    });
    setBriefingHelp(BRIEFING_ITEMS[next].help);
}

function activateBriefingItem(item) {
    if (item.pending) {
        setBriefingHelp(item.help);
        return;
    }
    if (item.id === "units") showBriefingView("units");
    else if (item.id === "gear") showBriefingView("gear");
    else if (item.id === "map") showBriefingView("map");
    else if (item.id === "back") leaveBriefing();
}

function showBriefingView(view) {
    const root = briefingState.root;
    if (!root) return;
    briefingState.view = view;
    root.dataset.view = view;
    const panel = root.querySelector(".brfPanel");
    panel.classList.toggle("hidden", view === "menu" || view === "map");
    root.querySelector(".brfMapReturn").classList.toggle("hidden", view !== "map");
    if (view === "units") renderBriefingUnits();
    if (view === "gear") renderBriefingGear();
    if (view === "map") setBriefingHelp("マップと敵の配置を確認できます。ユニットを押すと情報を表示します");
    if (view === "menu") {
        setBriefingIndex(briefingState.index);
        root.querySelectorAll(".brfItem")[((briefingState.index % 8) + 8) % 8]?.focus({ preventScroll: true });
    }
}

// ── ユニット選択 ──

function renderBriefingUnits() {
    const panel = briefingState.root.querySelector(".brfPanel");
    const allies = briefingAllies();
    const deployed = allies.filter(unit => !unit.briefingBench).length;
    panel.innerHTML = `
        <header class="brfPanelHead"><h3>ユニット選択</h3><span>出撃 ${deployed} / ${allies.length}</span>
            <button type="button" class="brfClose">決定</button></header>
        <div class="brfUnitList">
            ${allies.map(unit => `
                <button type="button" class="brfUnitCard${unit.briefingBench ? " bench" : ""}" data-id="${unit.id}">
                    ${briefingFace(unit)}
                    <span class="brfUnitName"><b>${unit.name}</b><small>${formatUnitLevelLabel(unit)}</small></span>
                    <em>${unit.briefingBench ? "待機" : "出撃"}</em>
                </button>`).join("")}
        </div>`;
    panel.querySelector(".brfClose").addEventListener("click", () => showBriefingView("menu"));
    panel.querySelectorAll(".brfUnitCard").forEach(card => {
        card.addEventListener("click", () => {
            const unit = allies.find(u => u.id === card.dataset.id);
            if (!unit) return;
            if (!unit.briefingBench && allies.filter(u => !u.briefingBench).length <= 1) {
                setBriefingHelp("最低1人は出撃させてください");
                return;
            }
            unit.briefingBench = !unit.briefingBench;
            renderBriefingUnits();
            setBriefingHelp(`${unit.name}を${unit.briefingBench ? "待機" : "出撃"}にしました`);
        });
    });
    setBriefingHelp("押すと出撃・待機を切り替えます");
}

function briefingFace(unit) {
    const src = getPortraitSrc(unit) || unit.tokenImage || "";
    const style = src
        ? `background-image:url('${src}');background-size:${unit.portraitBgSize || "cover"};background-position:${unit.portraitBgPos || "center top"}`
        : "";
    return `<i class="brfFace" style="${style}"></i>`;
}

// ── 身支度（スキル・戦技のセット入れ替え） ──

function briefingGearUnits() {
    return briefingAllies().filter(unit => unit.trialStats && TRIAL_ABILITY_SOURCE[unit.id] && !unit.briefingBench);
}

function renderBriefingGear() {
    const panel = briefingState.root.querySelector(".brfPanel");
    const units = briefingGearUnits();
    if (!units.some(unit => unit.id === briefingState.gearUnitId)) briefingState.gearUnitId = units[0]?.id || null;
    const unit = units.find(u => u.id === briefingState.gearUnitId);
    if (!unit) {
        panel.innerHTML = `<header class="brfPanelHead"><h3>身支度</h3><button type="button" class="brfClose">戻る</button></header>
            <p class="brfEmpty">身支度できるユニットがいません</p>`;
        panel.querySelector(".brfClose").addEventListener("click", () => showBriefingView("menu"));
        return;
    }
    const selection = unit.trialLoadoutSelection || null;
    const loadout = trialSkillLoadoutFor(unit.id, unit.trialLevel, TRIAL_CLASS_LEVEL, selection);
    const learned = trialLearnedAbilitiesFor(unit.id, unit.trialLevel, TRIAL_CLASS_LEVEL);
    const equippedNames = category => loadout[category].filter(Boolean).map(item => item.name);

    const chip = (category, item) => {
        const on = equippedNames(category).includes(item.name);
        const slot = on ? equippedNames(category).indexOf(item.name) + 1 : "";
        const kind = item.artKind ? `<small>${BRIEFING_ART_KIND_LABELS[item.artKind] || ""}</small>` : "";
        return `<button type="button" class="brfChip${on ? " on" : ""}" data-category="${category}" data-name="${item.name}"
            title="${item.name}：${item.desc}"><em>${slot}</em><span>${item.name}</span>${kind}</button>`;
    };
    const section = (category, emptyText) => {
        const list = learned[category];
        const max = TRIAL_LOADOUT_SLOT_COUNTS[category];
        return `
            <section class="brfGearSection">
                <h4>${BRIEFING_CATEGORY_LABELS[category]}<span>${equippedNames(category).length} / ${max}</span></h4>
                <div class="brfChips">${list.length ? list.map(item => chip(category, item)).join("") : `<p class="brfNone">${emptyText}</p>`}</div>
            </section>`;
    };
    const unique = loadout.classUnique[0];
    const exclusiveNote = learned.exclusive
        ? `${learned.exclusive.name}（専用兵種のときに使えます）`
        : "マスタースキル・専用兵種の最終スキル";

    panel.innerHTML = `
        <header class="brfPanelHead"><h3>身支度</h3><span>スキル・戦技のセット</span>
            <button type="button" class="brfClose">決定</button></header>
        <div class="brfGear">
            <nav class="brfGearUnits" aria-label="ユニット">
                ${units.map(u => `
                    <button type="button" class="brfGearUnit${u.id === unit.id ? " selected" : ""}" data-id="${u.id}">
                        ${briefingFace(u)}<span><b>${u.name}</b><small>${formatUnitLevelLabel(u)}</small></span>
                    </button>`).join("")}
            </nav>
            <div class="brfGearBody">
                <section class="brfGearSection fixed">
                    <h4>個人スキル<span>外せません</span></h4>
                    <div class="brfPersonal" title="${loadout.personal ? `${loadout.personal.name}：${loadout.personal.desc}` : ""}">
                        <b>${loadout.personal?.name || "なし"}</b><small>${loadout.personal?.desc || ""}</small>
                    </div>
                </section>
                <div class="brfGearCols">
                    <div>
                        ${section("classSkills", "兵種Lvが上がると習得します（兵種Lvは未実装）")}
                        <section class="brfGearSection fixed">
                            <h4>兵種固有<span>${unique ? "1 / 1" : "0 / 1"}</span></h4>
                            <p class="brfNone">${unique ? unique.name : exclusiveNote}</p>
                        </section>
                    </div>
                    <div>
                        ${section("causeSkills", "因果Lvが上がると習得します")}
                        ${section("combatArts", "因果Lvが上がると習得します")}
                    </div>
                </div>
            </div>
        </div>`;

    panel.querySelector(".brfClose").addEventListener("click", () => showBriefingView("menu"));
    panel.querySelectorAll(".brfGearUnit").forEach(btn => btn.addEventListener("click", () => {
        briefingState.gearUnitId = btn.dataset.id;
        renderBriefingGear();
    }));
    panel.querySelectorAll(".brfChip").forEach(btn => {
        const describe = () => {
            const item = learned[btn.dataset.category].find(i => i.name === btn.dataset.name);
            if (item) setBriefingHelp(`${item.name}：${item.desc}`);
        };
        btn.addEventListener("mouseenter", describe);
        btn.addEventListener("focus", describe);
        btn.addEventListener("click", () => {
            const result = trialToggleLoadoutSelection(unit.id, unit.trialLevel, selection, btn.dataset.category, btn.dataset.name);
            if (!result.changed) {
                if (result.reason === "full") setBriefingHelp(`${BRIEFING_CATEGORY_LABELS[btn.dataset.category]}の枠がいっぱいです。外してから選んでください`);
                return;
            }
            unit.trialLoadoutSelection = result.selection;
            refreshTrialLoadout(unit);
            renderBriefingGear();
            setBriefingHelp(`${btn.dataset.name}を${result.reason === "added" ? "セットしました" : "外しました"}`);
            panel.querySelector(`.brfChip[data-category="${btn.dataset.category}"][data-name="${btn.dataset.name}"]`)?.focus({ preventScroll: true });
        });
    });
    setBriefingHelp("押すとセット・解除します。枠の数まで選べます");
}

// ── 開く・閉じる ──

function openBriefing() {
    const shell = document.getElementById("landscapeBattleShell");
    if (!shell) return;
    briefingState.root?.remove();
    briefingState.root = createBriefingRoot();
    shell.appendChild(briefingState.root);
    briefingState.active = true;
    briefingState.index = 0;
    briefingState.gearUnitId = null;
    for (const unit of briefingAllies()) unit.briefingBench = false;
    // 戦闘準備で出る「味方行動」の帯は、戦闘開始のときに出し直す
    const banner = document.getElementById("phaseBanner");
    if (banner) {
        clearTimeout(banner._hideTimer);
        banner.classList.add("hidden");
    }
    showBriefingView("menu");
}

function closeBriefing() {
    briefingState.active = false;
    briefingState.root?.remove();
    briefingState.root = null;
}

function startBriefingBattle() {
    // 待機にしたユニットは盤面から外す
    const benched = battleUnits.filter(unit => unit.side === "ally" && unit.briefingBench);
    if (benched.length) {
        battleUnits = battleUnits.filter(unit => !(unit.side === "ally" && unit.briefingBench));
        addLog(`・待機: ${benched.map(unit => unit.name).join("、")}`);
    }
    closeBriefing();
    addLog("・出撃準備を終えて戦闘開始");
    renderUnits();
    syncLandscapeBattleUi(null);
    if (typeof showPhaseBanner === "function") showPhaseBanner("味方フェーズ");
}

function leaveBriefing() {
    closeBriefing();
    if (typeof showHomeScreen === "function") showHomeScreen();
}

document.addEventListener("keydown", e => {
    if (!briefingState.active || !briefingState.root) return;
    if (briefingState.view === "menu") {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            setBriefingIndex(briefingState.index + 1);
            briefingState.root.querySelectorAll(".brfItem")[((briefingState.index % 8) + 8) % 8]?.focus({ preventScroll: true });
            e.preventDefault();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            setBriefingIndex(briefingState.index - 1);
            briefingState.root.querySelectorAll(".brfItem")[((briefingState.index % 8) + 8) % 8]?.focus({ preventScroll: true });
            e.preventDefault();
        }
    } else if (e.key === "Escape") {
        showBriefingView("menu");
        e.preventDefault();
    }
});

// URLから試験の戦闘を直接起動したとき（game.js の起動処理はこのファイルより先に走る）
if (typeof isTrialBattleSession === "function" && typeof currentBattleId !== "undefined"
    && isTrialBattleSession(currentBattleId) && !briefingState.active) {
    openBriefing();
}

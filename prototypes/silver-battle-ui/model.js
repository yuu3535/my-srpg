// 見本だけの状態遷移。本編の能力値・戦闘計算・保存データは使用しない。
(function (root) {
  const CHARACTERS = [
    { id: 'arshe', name: 'アルシェ', level: 25, job: 'ロード', hp: 31, mp: 18, move: 5, range: '1', stats: [18, 8, 16, 17, 14, 11], weapon: '仮の剣（特注）', weaponIcon: 'weapon_sword', portrait: 'assets/arshe-portrait.png', unit: 'assets/arshe-unit.png', skill: '速さの心得', description: '自分の回避 +10%', skillIcon: '07_加速', damage: 24, strikes: 2, hit: 100, crit: 33 },
    { id: 'mage', name: '魔法使い（仮）', level: 18, job: '魔法使い', hp: 26, mp: 24, move: 5, range: '1–2', stats: [6, 18, 14, 13, 8, 16], weapon: '魔法の杖（仮）', weaponIcon: 'weapon_staff', portrait: 'assets/mage-portrait.png', unit: 'assets/mage-unit.png', skill: '詠唱破棄', description: '表示密度を確認する仮のスキル', skillIcon: '09_詠唱破棄', damage: 14, strikes: 1, hit: 92, crit: 8 },
    { id: 'albus', name: 'アルバス', level: 25, job: '魔法使い', hp: 28, mp: 30, move: 5, range: '1–2', stats: [7, 24, 20, 16, 10, 24], weapon: '魔法の杖（仮）', weaponIcon: 'weapon_staff', portrait: '../../Character/アルバスアイコン.png', unit: '../../unity-prototype/Assets/Art/SD/albas.png', skill: '詠唱破棄', description: '表示密度を確認する仮のスキル', skillIcon: '09_詠唱破棄', damage: 22, strikes: 1, hit: 100, crit: 12 },
    { id: 'ringholm', name: 'リングホルム', level: 20, job: '魔法使い', hp: 25, mp: 24, move: 5, range: '1–2', stats: [8, 17, 16, 14, 9, 18], weapon: '魔法の杖（仮）', weaponIcon: 'weapon_staff', portrait: '../../Character/リングホルムアイコン.png', unit: '../../unity-prototype/Assets/Art/SD/ringholm.png', skill: '戦闘指揮', description: '表示密度を確認する仮のスキル', skillIcon: '17_戦闘指揮', damage: 15, strikes: 1, hit: 94, crit: 10 }
  ];
  const initialPositions = { arshe: [535, 345], mage: [398, 395], albus: [750, 456], ringholm: [614, 391] };
  const enemies = [{ id: 'guard', name: '森の番人', hp: 20, level: 18, position: [685, 259] }, { id: 'sentinel', name: '城門の番人', hp: 20, level: 18, position: [441, 176] }, { id: 'watch', name: '橋の番人', hp: 20, level: 18, position: [835, 339] }];
  function initialState() {
    return { phase: 'normal', selected: 'arshe', rosterOpen: true, target: 'guard', positions: Object.fromEntries(Object.entries(initialPositions).map(([k, v]) => [k, [...v]])), allyHp: Object.fromEntries(CHARACTERS.map(c => [c.id, c.hp])), enemyHp: Object.fromEntries(enemies.map(e => [e.id, e.hp])), defeated: [], result: null };
  }
  function forecastFor(state) {
    const character = CHARACTERS.find(c => c.id === state.selected);
    const enemy = enemies.find(e => e.id === state.target);
    const attacker = { ...character, hp: state.allyHp[character.id] };
    const defender = { ...enemy, hp: state.enemyHp[enemy.id] };
    const damage = Math.min(defender.hp, attacker.damage * attacker.strikes);
    // UI用の固定例。魔法も射程が合えば反撃対象。正式な交戦計画ではない。
    const counter = attacker.damage < defender.hp;
    return { attacker, defender, damage, counter, attackerAfter: counter ? Math.max(0, attacker.hp - 12) : attacker.hp, defenderAfter: Math.max(0, defender.hp - damage) };
  }
  function reduce(state, action) {
    if (action.type === 'RESET') return initialState();
    if (state.phase === 'attacking') {
      if (action.type !== 'FINISH') return state;
      const plan = forecastFor(state);
      return { ...state, phase: 'normal', result: plan, allyHp: { ...state.allyHp, [state.selected]: plan.attackerAfter }, enemyHp: { ...state.enemyHp, [state.target]: plan.defenderAfter }, defeated: plan.defenderAfter === 0 ? [...state.defeated, state.target] : state.defeated };
    }
    switch (action.type) {
      case 'ROSTER': return { ...state, rosterOpen: !state.rosterOpen };
      case 'SELECT': return CHARACTERS.some(c => c.id === action.id) ? { ...state, selected: action.id, phase: 'normal', result: null } : state;
      case 'MOVE': return state.phase === 'normal' ? { ...state, positions: { ...state.positions, [state.selected]: [...action.position] }, result: null } : state;
      case 'FORECAST': {
        const target = action.id || enemies.find(e => !state.defeated.includes(e.id))?.id;
        return target && enemies.some(e => e.id === target) && !state.defeated.includes(target) ? { ...state, phase: 'forecast', target, result: null } : state;
      }
      case 'CANCEL': return { ...state, phase: 'normal', result: null };
      case 'CONFIRM': return state.phase === 'forecast' ? { ...state, phase: 'attacking' } : state;
      default: return state;
    }
  }
  const api = { CHARACTERS, enemies, initialState, forecastFor, reduce };
  if (typeof module !== 'undefined') module.exports = api;
  else root.UIStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);

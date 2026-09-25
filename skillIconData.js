// =====================================================================
//  skillIconData.js ― スキル・戦技のアイコンと枠の対応（自動生成・純粋データ）
//
//  tools/build_skill_icons.py が アイコン素材/採用版/ から作る。手で直さないこと。
//  icons: 能力名 → 画像 / frames: personal（個人スキル）・passive（スキル）・active（戦技）
// =====================================================================

const SKILL_ICON_DATA = Object.freeze({
  "icons": {
    "祈り": "assets/icons/skills/祈り.png",
    "破壊": "assets/icons/skills/破壊.png",
    "結界": "assets/icons/skills/結界.png",
    "封印": "assets/icons/skills/封印.png",
    "落雷": "assets/icons/skills/落雷.png",
    "復讐": "assets/icons/skills/復讐.png",
    "加速": "assets/icons/skills/加速.png",
    "転移": "assets/icons/skills/転移.png",
    "詠唱破棄": "assets/icons/skills/詠唱破棄.png",
    "カウンター": "assets/icons/skills/カウンター.png",
    "デュアル+": "assets/icons/skills/デュアル+.png",
    "応援": "assets/icons/skills/応援.png",
    "器用": "assets/icons/skills/器用.png",
    "気付け薬": "assets/icons/skills/気付け薬.png",
    "先手必勝": "assets/icons/skills/先手必勝.png",
    "冷静": "assets/icons/skills/冷静.png",
    "戦闘指揮": "assets/icons/skills/戦闘指揮.png",
    "虚像": "assets/icons/skills/虚像.png",
    "後手必勝": "assets/icons/skills/後手必勝.png",
    "アシスト": "assets/icons/skills/アシスト.png"
  },
  "frames": {
    "personal": "assets/icons/skills/frame_personal.png",
    "passive": "assets/icons/skills/frame_passive.png",
    "active": "assets/icons/skills/frame_active.png"
  }
});

if (typeof module !== "undefined") {
    module.exports = { SKILL_ICON_DATA };
}

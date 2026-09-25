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
    "カウンター": "assets/icons/skills/カウンター.png"
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

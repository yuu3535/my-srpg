// =====================================================================
//  abilityData.js ― 兵種・スキル・戦技のデータ（自動生成・純粋データ）
//
//  tools/build_ability_data.py が兵種表CSVから作る。手で直さないこと。
//  正本: Regarding character growth rates, skills, and combat arts/*.csv
//  kind: skill / physicalArt / magicArt / art（物理・魔法の区別なし）/ exclusiveArt（専用戦技）
//  statBonus: 無条件の能力値上昇だけを読み取ったもの。条件付きの効果は null
// =====================================================================

const ABILITY_DATA = Object.freeze({
  "classLines": {
    "戦列下級": {
      "family": "戦列兵",
      "tier": "下級",
      "branch": "-",
      "skills": [
        {
          "name": "HP+5",
          "desc": "HP+5",
          "need": 5,
          "kind": "skill",
          "statBonus": {
            "hp": 5
          }
        },
        {
          "name": "深呼吸",
          "desc": "勇気値が減っている場合、2ターンごとに+5回復",
          "need": 10,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "武道",
          "desc": "技÷2の確率で、物理攻撃威力が2倍になることがる",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "戦上手",
          "desc": "武器装備時HP+5",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "戦列攻撃上級": {
      "family": "戦列兵",
      "tier": "上級",
      "branch": "攻撃特化",
      "skills": [
        {
          "name": "力+10",
          "desc": "力+10",
          "need": 5,
          "kind": "skill",
          "statBonus": {
            "atk": 10
          }
        },
        {
          "name": "必殺+10",
          "desc": "必殺+10",
          "need": 10,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "軍神",
          "desc": "周囲3マス以内にいる味方の基礎8ステ+3",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "武の神髄",
          "desc": "武器装備時攻撃+5、命中+5",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "戦列防御上級": {
      "family": "戦列兵",
      "tier": "上級",
      "branch": "防御特化",
      "skills": [
        {
          "name": "受け流し",
          "desc": "相手の力・魔攻-10",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "防御+10",
          "desc": "防御+10",
          "need": 10,
          "kind": "skill",
          "statBonus": {
            "def": 10
          }
        },
        {
          "name": "守護",
          "desc": "デュアルしている相手が稀(発生確率は支援レベル依存)にノーダメージ",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "守りの神髄",
          "desc": "武器装備時防御+5、魔防+5",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "術下級": {
      "family": "術兵",
      "tier": "下級",
      "branch": "-",
      "skills": [
        {
          "name": "魔法耐性",
          "desc": "魔防÷2%で発動、魔法ダメージを半減する。",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        null,
        {
          "name": "魔導",
          "desc": "技÷2の確率で、魔法威力2倍になることがある",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "魔法上手",
          "desc": "魔法装備時、魔攻・魔防+2",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "術軍師上級": {
      "family": "術兵",
      "tier": "上級",
      "branch": "軍師系",
      "skills": [
        {
          "name": "威光",
          "desc": "魅力÷2で発動、力・魔攻の威力1.5倍/戦技",
          "need": 5,
          "kind": "art",
          "statBonus": null
        },
        {
          "name": "魅力+10",
          "desc": "魅力+10",
          "need": 10,
          "kind": "skill",
          "statBonus": {
            "cha": 10
          }
        },
        {
          "name": "詠唱破棄",
          "desc": "魔法使用時、MPが半減する",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "導きの神髄",
          "desc": "魅力+5、魔攻+5",
          "need": "master",
          "kind": "skill",
          "statBonus": {
            "cha": 5,
            "mag": 5
          }
        }
      ]
    },
    "術魔法上級": {
      "family": "術兵",
      "tier": "上級",
      "branch": "魔法特化",
      "skills": [
        {
          "name": "魔光",
          "desc": "魔攻÷2で発動、魔法攻撃の威力1.5倍/戦技",
          "need": 5,
          "kind": "art",
          "statBonus": null
        },
        {
          "name": "魔防+10",
          "desc": "魔防+10",
          "need": 10,
          "kind": "skill",
          "statBonus": {
            "res": 10
          }
        },
        {
          "name": "魔攻+10",
          "desc": "魔攻+10",
          "need": 15,
          "kind": "skill",
          "statBonus": {
            "mag": 10
          }
        },
        {
          "name": "魔の神髄",
          "desc": "魔法装備時魔攻+5、魔防+5",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "騎兵下級": {
      "family": "騎兵",
      "tier": "下級",
      "branch": "-",
      "skills": [
        {
          "name": "救援",
          "desc": "デュアル時、前衛と後衛の全能力+1",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "追い込み",
          "desc": "追撃発生時与えるダメージ+3",
          "need": 10,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "庇う",
          "desc": "勇気％の確率でデュアルしている相手を庇い、受けたダメージを半減する",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "騎乗上手",
          "desc": "速さ+5",
          "need": "master",
          "kind": "skill",
          "statBonus": {
            "spd": 5
          }
        }
      ]
    },
    "騎馬上級": {
      "family": "騎兵",
      "tier": "上級",
      "branch": "騎馬",
      "skills": [
        {
          "name": "移動+1",
          "desc": "移動+1",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "速さ+10",
          "desc": "速さ+10",
          "need": 10,
          "kind": "skill",
          "statBonus": {
            "spd": 10
          }
        },
        {
          "name": "全身全霊",
          "desc": "戦技使用時、命中-20、必殺+10",
          "need": 15,
          "kind": "art",
          "statBonus": null
        },
        {
          "name": "突撃",
          "desc": "５マス直線の敵を騎馬でまとめて轢くアタック戦技、力・速さ依存で火力アップ",
          "need": "master",
          "kind": "art",
          "statBonus": null
        }
      ]
    },
    "飛行上級": {
      "family": "騎兵",
      "tier": "上級",
      "branch": "飛行",
      "skills": [
        {
          "name": "移動+2",
          "desc": "移動+2",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "威圧",
          "desc": "相手の命中-10、自分の回避+10",
          "need": 10,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "殺戮",
          "desc": "ドラゴンライダー)/疾駆(スカイナイト)(自分から攻撃して敵を倒すと、1ターンに1度だけ再行動できる",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "ブレス",
          "desc": "ユニットから見て正面横３マスの範囲攻撃、魔攻依存で火力アップ",
          "need": "master",
          "kind": "art",
          "statBonus": null
        }
      ]
    },
    "隠密下級": {
      "family": "隠密兵",
      "tier": "下級",
      "branch": "-",
      "skills": [
        {
          "name": "鍵開け",
          "desc": "扉や罠や宝箱を解除できる",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "一攫千金",
          "desc": "敵撃破時にちょっとだけお金が増える",
          "need": 10,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "忍び足",
          "desc": "敵に狙われにくくなる",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "隠密上手",
          "desc": "回避+5、技+5",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "隠密暗殺上級": {
      "family": "隠密兵",
      "tier": "上級",
      "branch": "暗殺",
      "skills": [
        {
          "name": "技+10",
          "desc": "技+10",
          "need": 5,
          "kind": "skill",
          "statBonus": {
            "tec": 10
          }
        },
        {
          "name": "回避+10",
          "desc": "回避+10",
          "need": 10,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "伏兵",
          "desc": "戦闘開始時、自分のHPが半分以下なら、敵から攻撃された場合も自分から先に攻撃を行う",
          "need": 15,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "急所",
          "desc": "技÷2で攻撃威力２倍",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    },
    "隠密遊撃上級": {
      "family": "隠密兵",
      "tier": "上級",
      "branch": "遊撃",
      "skills": [
        {
          "name": "砲台術",
          "desc": "砲台使用時命中+10",
          "need": 5,
          "kind": "skill",
          "statBonus": null
        },
        {
          "name": "技+10",
          "desc": "技+10",
          "need": 10,
          "kind": "skill",
          "statBonus": {
            "tec": 10
          }
        },
        {
          "name": "投擲",
          "desc": "1マス以上離れた５マス以内の敵１人を中心に５連ダメージ、装備種類によって物理か魔法か威力判定が変わる、装備÷２の威力×５連ダメージ/戦技",
          "need": 15,
          "kind": "art",
          "statBonus": null
        },
        {
          "name": "技の神髄",
          "desc": "技＋5、命中＋10",
          "need": "master",
          "kind": "skill",
          "statBonus": null
        }
      ]
    }
  },
  "characterClasses": {
    "アルシェ": [
      {
        "slot": "戦列下級",
        "name": "王子",
        "aptitude": "万能",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "ブレイバー",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "カラミティ",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "ライダー",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "斥候",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "専用兵種",
        "name": "アルシエル",
        "aptitude": "専用",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      }
    ],
    "リングホルム": [
      {
        "slot": "戦列下級",
        "name": "ならずもの",
        "aptitude": "得意",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "傭兵",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "カンナギ",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦巫女",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "リーパー",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "騎馬上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "飛行上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "隠密下級",
        "name": "盗人",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "専用兵種",
        "name": "プロガトリア",
        "aptitude": "専用",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      }
    ],
    "アルバス": [
      {
        "slot": "戦列下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "戦列防御上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "ロード",
        "aptitude": "得意",
        "initial": true,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "カラミティ",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "ドラゴンライダー",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "斥候",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "専用兵種",
        "name": "フォスフォロス",
        "aptitude": "専用",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      }
    ],
    "フィロ": [
      {
        "slot": "戦列下級",
        "name": "戦士",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "ブレイバー",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "アークメイジ",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "スカイナイト",
        "aptitude": "得意",
        "initial": true,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      }
    ],
    "アン": [
      {
        "slot": "戦列下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "戦列防御上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "標準",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "アークメイジ",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "スカイナイト",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "村人)",
        "aptitude": "得意",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      }
    ],
    "カリマ": [
      {
        "slot": "戦列下級",
        "name": "王子",
        "aptitude": "万能",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "ブレイバー",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "カラミティ",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "ライダー",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "斥候",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "万能",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "専用兵種",
        "name": "フラグメント",
        "aptitude": "専用",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      }
    ],
    "ベル": [
      {
        "slot": "戦列下級",
        "name": "戦士",
        "aptitude": "標準",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "ブレイバー",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "術軍師上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "術魔法上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "ドラゴンライダー",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "斥候",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      }
    ],
    "ヘンリー": [
      {
        "slot": "戦列下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "戦列防御上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "術下級",
        "name": "宣教師",
        "aptitude": "得意",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "カラミティ",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "ドラゴンライダー",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "斥候",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "標準",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      }
    ],
    "キャリー": [
      {
        "slot": "戦列下級",
        "name": "戦士",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "ブレイバー",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "カラミティ",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "騎馬上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "飛行上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "隠密下級",
        "name": "コルテザン)",
        "aptitude": "標準",
        "initial": true,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "アサシン",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "シューター",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      }
    ],
    "ラディン": [
      {
        "slot": "戦列下級",
        "name": "戦士",
        "aptitude": "得意",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "戦列攻撃上級",
        "name": "ブレイバー",
        "aptitude": "得意",
        "initial": true,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "戦列防御上級",
        "name": "ガーディアン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術下級",
        "name": "魔導師",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "術軍師上級",
        "name": "戦術士",
        "aptitude": "得意",
        "initial": false,
        "recommended": true,
        "selfAccess": "可"
      },
      {
        "slot": "術魔法上級",
        "name": "カラミティ",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎兵下級",
        "name": "ナイト",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "騎馬上級",
        "name": "パラディン",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "飛行上級",
        "name": "ドラゴンライダー",
        "aptitude": "標準",
        "initial": false,
        "recommended": false,
        "selfAccess": "可"
      },
      {
        "slot": "隠密下級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "隠密暗殺上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      },
      {
        "slot": "隠密遊撃上級",
        "name": "A支援1人から教わったもの",
        "aptitude": "苦手",
        "initial": false,
        "recommended": false,
        "selfAccess": "不可（縁適性で解禁候補）"
      }
    ]
  },
  "causeTable": {
    "アルシェ": {
      "personal": {
        "name": "双蛇の逆針",
        "kind": "skill",
        "desc": "味方が倒されたり、攻撃を外したりしたとき、一手単位で行動をやり巻き戻せる。１回の戦闘につき、回数は最初3回までだが章が進むごとに1ずつ増える。"
      },
      "abilities": [
        {
          "name": "黒陽の加護",
          "kind": "skill",
          "desc": "獲得兵種経験値1.5倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "両断",
          "kind": "physicalArt",
          "desc": "物理攻撃1.5倍",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "祈り",
          "kind": "skill",
          "desc": "戦闘中、１度だけ幸運%でHPが0になりそうなとき、1耐える。",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "デュアル+",
          "kind": "skill",
          "desc": "デュアル発生率+5",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "カウンター",
          "kind": "skill",
          "desc": "(HP上限値+防御)÷4%の確率で、ダメージ受けた際受けたダメージの半分を相手に負わせる",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "落雷",
          "kind": "magicArt",
          "desc": "強烈な雷撃の魔法攻撃、自分の魔攻÷2で相手の追撃・反撃・移動を封じる。",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "封印",
          "kind": "magicArt",
          "desc": "魔防÷2の射程範囲の内の敵１人の移動を封じる",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "万雷",
          "kind": "magicArt",
          "desc": "直線3マス以内の敵を巻き込んで攻撃、自分の魔攻÷2で相手の追撃・反撃・移動を封じる。",
          "level": 45,
          "statBonus": null
        },
        {
          "name": "奈落の王",
          "kind": "skill",
          "desc": "自分の力・魔攻・速さ・魅力+10",
          "level": 50,
          "statBonus": {
            "atk": 10,
            "mag": 10,
            "spd": 10,
            "cha": 10
          }
        }
      ]
    },
    "リングホルム": {
      "personal": {
        "name": "殺気",
        "kind": "skill",
        "desc": "自分から攻撃したとき命中+10・相手の回避−10・必殺+10"
      },
      "abilities": [
        {
          "name": "黒の一族",
          "kind": "skill",
          "desc": "火魔法の命中+20、火魔法の攻撃の際ダメージ1.5倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "召喚「ヒトダマ」",
          "kind": "magicArt",
          "desc": "契約している幻獣「ヒトダマ」を召喚する。召喚に2ターンかかる。",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "円舞",
          "kind": "physicalArt",
          "desc": "攻撃時に、隣接するすべての敵に物理ダメ－ジを与える",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "死神",
          "kind": "skill",
          "desc": "周囲4マス以内の敵の回避・命中-10、速さ-5",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "カウンター",
          "kind": "skill",
          "desc": "(HP上限値+防御)÷4%の確率で、ダメージ受けた際受けたダメージの半分を相手に負わせる",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "復讐",
          "kind": "art",
          "desc": "攻撃時、自分のＨＰの減っている分を威力に加算する",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "戦闘指揮",
          "kind": "skill",
          "desc": "「戦闘指揮」したターンの味方の命中・回避・必殺・必殺耐性+5",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "月詠",
          "kind": "exclusiveArt",
          "desc": "攻撃時、自分を中心とした5マス以内の全ての敵のHPを20%削る",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "剣の舞",
          "kind": "skill",
          "desc": "武器種「剣」装備時、自身の力・魔攻・命中+10",
          "level": 45,
          "statBonus": null
        },
        {
          "name": "勇者の器",
          "kind": "skill",
          "desc": "自分の力・技・速さ・魅力+10",
          "level": 50,
          "statBonus": {
            "atk": 10,
            "tec": 10,
            "spd": 10,
            "cha": 10
          }
        }
      ]
    },
    "アルバス": {
      "personal": {
        "name": "野望",
        "kind": "skill",
        "desc": "自分から攻撃した際、魅力×2%で相手の反撃を封じる。相手の命中-10・相手の回避−10・必殺+10"
      },
      "abilities": [
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "詠唱破棄",
          "kind": "skill",
          "desc": "(魔攻+魔防)÷4の確率で魔法武器耐久とMP消費無し",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "回復",
          "kind": "magicArt",
          "desc": "回復魔法使用時に、回復量×3",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "王威",
          "kind": "skill",
          "desc": "周囲4マス以内の味方の回避・命中・必殺耐性+10",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "加速",
          "kind": "magicArt",
          "desc": "自分または味方が1度再行動できる。",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "魔法射程+1",
          "kind": "skill",
          "desc": "魔法の射程+1",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "転移",
          "kind": "magicArt",
          "desc": "味方を指定した位置に移動できる。範囲は魔力÷2",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "生命吸収",
          "kind": "exclusiveArt",
          "desc": "攻撃時、自分を中心とした6マス以内の全ての敵のHPを10%削り、その分自分のHP、MPを回復する。",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "魔神の器",
          "kind": "skill",
          "desc": "武器種「魔法」装備時、自身の魔攻・魔防・命中+10",
          "level": 45,
          "statBonus": null
        },
        {
          "name": "破滅の王",
          "kind": "skill",
          "desc": "自分のHP・魔攻・技・魅力+10",
          "level": 50,
          "statBonus": {
            "hp": 10,
            "mag": 10,
            "tec": 10,
            "cha": 10
          }
        }
      ]
    },
    "アン": {
      "personal": {
        "name": "頑張り屋",
        "kind": "skill",
        "desc": "味方が3マス以内にいると、命中+5"
      },
      "abilities": [
        {
          "name": "おまけ",
          "kind": "skill",
          "desc": "攻撃した際に幸運%で50ジェニー(お金)を獲得できる。",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "応援",
          "kind": "skill",
          "desc": "「応援」した味方の基礎ステ+1",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "結界",
          "kind": "magicArt",
          "desc": "魔防÷2の装甲を2マス以内の自分または味方１人に与える",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "献身",
          "kind": "skill",
          "desc": "隣接する味方の防御・魔防+5",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "器用",
          "kind": "skill",
          "desc": "技・魅力+10",
          "level": 25,
          "statBonus": {
            "tec": 10,
            "cha": 10
          }
        },
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "気つけ薬",
          "kind": "skill",
          "desc": "回復薬の効果+5",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "デュアル+",
          "kind": "skill",
          "desc": "デュアル発生率+5",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "祈り",
          "kind": "skill",
          "desc": "戦闘中、１度だけ幸運%でHPが0になりそうなとき、1耐える",
          "level": 45,
          "statBonus": null
        }
      ]
    },
    "フィロ": {
      "personal": {
        "name": "エリート",
        "kind": "skill",
        "desc": "力・魔防・速さ・魅力+3"
      },
      "abilities": [
        {
          "name": "白の一族",
          "kind": "skill",
          "desc": "氷魔法の命中+20、氷魔法の攻撃の際ダメージ1.5倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "先手必勝",
          "kind": "skill",
          "desc": "自分から攻撃するとき速さ+5",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "騎士の矜持",
          "kind": "skill",
          "desc": "デュアル時、自分が前衛の場合必殺+10、後衛の場合デュアル相手の防御・魔防+5",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "破天",
          "kind": "physicalArt",
          "desc": "命中+10、飛行ユニットへのダメージが2倍",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "封印",
          "kind": "magicArt",
          "desc": "魔防÷2の射程範囲の内の敵１人の移動を封じる",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "冷静",
          "kind": "skill",
          "desc": "技・速さ+10",
          "level": 35,
          "statBonus": {
            "tec": 10,
            "spd": 10
          }
        },
        {
          "name": "復讐",
          "kind": "art",
          "desc": "攻撃時、自分のＨＰの減っている分を威力に加算する",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "アシスト",
          "kind": "skill",
          "desc": "隣接する味方の命中・必殺+5",
          "level": 45,
          "statBonus": null
        }
      ]
    },
    "カリマ": {
      "personal": {
        "name": "双蛇の逆針",
        "kind": "skill",
        "desc": "味方が倒されたり、攻撃を外したりしたとき、一手単位で行動をやり巻き戻せる。１回の戦闘につき、回数は最初3回までだが章が進むごとに1ずつ増える。"
      },
      "abilities": [
        {
          "name": "白陽の加護",
          "kind": "skill",
          "desc": "獲得兵種経験値1.5倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "結界",
          "kind": "magicArt",
          "desc": "魔防÷2の装甲を2マス以内の自分または味方１人に与える",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "祈り",
          "kind": "skill",
          "desc": "戦闘中、１度だけ幸運%でHPが0になりそうなとき、1耐える。",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "デュアル+",
          "kind": "skill",
          "desc": "デュアル発生率+5",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "アシスト",
          "kind": "skill",
          "desc": "隣接する味方の命中・必殺+5",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "虚像",
          "kind": "magicArt",
          "desc": "相手の命中-20",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "封印",
          "kind": "magicArt",
          "desc": "魔防÷2の射程範囲の内の敵１人の移動を封じる",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "落雷",
          "kind": "magicArt",
          "desc": "強烈な雷撃の魔法攻撃、自分の魔攻÷2で相手の追撃・反撃・移動を封じる。",
          "level": 45,
          "statBonus": null
        },
        {
          "name": "神炎の器",
          "kind": "skill",
          "desc": "自分の防御・魔防・速さ・魅力+10",
          "level": 50,
          "statBonus": {
            "def": 10,
            "res": 10,
            "spd": 10,
            "cha": 10
          }
        }
      ]
    },
    "ギュンター": {
      "personal": {
        "name": "忠誠心",
        "kind": "skill",
        "desc": "オルクスの味方が盤面にいるとき全ステ+1、アルバスがいる時は全基礎ステ+2"
      },
      "abilities": [
        {
          "name": "大振り",
          "kind": "physicalArt",
          "desc": "命中-30、物理ダメージ2倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "召喚「ベルゼブブの眷属」",
          "kind": "magicArt",
          "desc": "契約している幻獣「ベルゼブブの眷属」を召喚する。召喚に2ターンかかる。",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "先手必勝",
          "kind": "skill",
          "desc": "自分から攻撃するとき速さ+5",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "向上心",
          "kind": "skill",
          "desc": "力・速さ+5",
          "level": 20,
          "statBonus": {
            "atk": 5,
            "spd": 5
          }
        },
        {
          "name": "結界",
          "kind": "magicArt",
          "desc": "魔防÷2の装甲を2マス以内の自分または味方１人に与える",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "大食らい",
          "kind": "skill",
          "desc": "敵将への攻撃時必殺+5",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "破天",
          "kind": "physicalArt",
          "desc": "命中+10、飛行ユニットへのダメージが2倍",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "奇襲",
          "kind": "physicalArt",
          "desc": "攻撃時相手の回避-50。自分の追撃は発生しない。",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "転移",
          "kind": "magicArt",
          "desc": "味方を指定した位置に移動できる。範囲は魔力÷2",
          "level": 45,
          "statBonus": null
        }
      ]
    },
    "ヘンリー": {
      "personal": {
        "name": "宣教活動",
        "kind": "skill",
        "desc": "味方が３マス以内にいると自分の魔防・魅力+6"
      },
      "abilities": [
        {
          "name": "黄の一族",
          "kind": "skill",
          "desc": "土魔法の命中+20、土魔法の攻撃の際ダメージ1.5倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "召喚「パイモンの眷属」",
          "kind": "magicArt",
          "desc": "契約している幻獣「パイモンの眷属」を召喚する。召喚に2ターンかかる。",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "祝福",
          "kind": "skill",
          "desc": "幸運%で発動。自分が攻撃を受けた後、HPが10回復する。",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "結界",
          "kind": "magicArt",
          "desc": "魔防÷2の装甲を2マス以内の自分または味方１人に与える",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "後手必勝",
          "kind": "skill",
          "desc": "相手から攻撃された時速さ+5",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "地形無効",
          "kind": "skill",
          "desc": "地形から受ける効果を受けない",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "冷静",
          "kind": "skill",
          "desc": "技・速さ+10",
          "level": 40,
          "statBonus": {
            "tec": 10,
            "spd": 10
          }
        },
        {
          "name": "封印",
          "kind": "magicArt",
          "desc": "魔防÷2の射程範囲の内の敵１人の移動を封じる",
          "level": 45,
          "statBonus": null
        }
      ]
    },
    "キャリー": {
      "personal": {
        "name": "夜の華",
        "kind": "skill",
        "desc": "味方が3マス以内にいると防御・魔防・魅力+3"
      },
      "abilities": [
        {
          "name": "悪夢",
          "kind": "magicArt",
          "desc": "魔法攻撃の際に、相手のHPではなく、相手の勇気値を減らす。",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "応援",
          "kind": "skill",
          "desc": "「応援」した味方の基礎ステ+1",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "ささやき",
          "kind": "skill",
          "desc": "隣接する相手の命中・回避-10",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "誘惑",
          "kind": "magicArt",
          "desc": "1ターンだけ相手の必殺-50、命中-20",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "気つけ薬",
          "kind": "skill",
          "desc": "回復薬の効果+5",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "虚像",
          "kind": "magicArt",
          "desc": "相手の命中-20",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "器用",
          "kind": "skill",
          "desc": "技・魅力+10",
          "level": 35,
          "statBonus": {
            "tec": 10,
            "cha": 10
          }
        },
        {
          "name": "復讐",
          "kind": "art",
          "desc": "攻撃時、自分のＨＰの減っている分を威力に加算する",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "詠唱破棄",
          "kind": "skill",
          "desc": "(魔攻+魔防)÷4の確率で魔法武器耐久とMP消費無し",
          "level": 45,
          "statBonus": null
        }
      ]
    },
    "ラディン": {
      "personal": {
        "name": "怠惰",
        "kind": "skill",
        "desc": "毎ターン命中・回避が1ずつ上昇10ターン経過後、効果は切れる"
      },
      "abilities": [
        {
          "name": "翠の一族",
          "kind": "skill",
          "desc": "風魔法の命中+20、風魔法の攻撃の際ダメージ1.5倍",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "加速",
          "kind": "magicArt",
          "desc": "自分または味方が1度再行動できる。",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "後手必勝",
          "kind": "skill",
          "desc": "相手から攻撃された時速さ+5",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "英雄",
          "kind": "skill",
          "desc": "周囲3マス以内の味方の力・魔攻・速さ・命中+5",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "戦闘指揮",
          "kind": "skill",
          "desc": "「戦闘指揮」したターンの味方の命中・回避・必殺・必殺耐性+5",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "復讐",
          "kind": "art",
          "desc": "攻撃時、自分のＨＰの減っている分を威力に加算する",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "カウンター",
          "kind": "skill",
          "desc": "(HP上限値+防御)÷4%の確率で、ダメージ受けた際受けたダメージの半分を相手に負わせる",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "鎌風",
          "kind": "art",
          "desc": "風魔法使用時、(力+魔攻)÷2の威力",
          "level": 45,
          "statBonus": null
        }
      ]
    },
    "サタン": {
      "personal": {
        "name": "厄災の王",
        "kind": "skill",
        "desc": "相手の回避・命中・必殺・必殺耐性-20"
      },
      "abilities": [
        {
          "name": "破壊",
          "kind": "magicArt",
          "desc": "魔法攻撃のときに、装甲を破壊できる",
          "level": 5,
          "statBonus": null
        },
        {
          "name": "呪縛",
          "kind": "skill",
          "desc": "相手から受けるダメージを半減",
          "level": 10,
          "statBonus": null
        },
        {
          "name": "魔骸",
          "kind": "skill",
          "desc": "自分の装甲+10",
          "level": 15,
          "statBonus": null
        },
        {
          "name": "詠唱破棄",
          "kind": "skill",
          "desc": "(魔攻+魔防)÷4の確率で魔法武器耐久とMP消費無し",
          "level": 20,
          "statBonus": null
        },
        {
          "name": "召喚「屍兵」",
          "kind": "magicArt",
          "desc": "倒された味方の死体を操り再び味方として使役する。召喚に2ターンかかる",
          "level": 25,
          "statBonus": null
        },
        {
          "name": "闇の霧",
          "kind": "skill",
          "desc": "相手から受ける、専用スキル・戦技を無効化",
          "level": 30,
          "statBonus": null
        },
        {
          "name": "虚像",
          "kind": "magicArt",
          "desc": "相手の命中-20",
          "level": 35,
          "statBonus": null
        },
        {
          "name": "両断",
          "kind": "physicalArt",
          "desc": "物理攻撃1.5倍",
          "level": 40,
          "statBonus": null
        },
        {
          "name": "怒り",
          "kind": "skill",
          "desc": "HP半分以下の時、必殺+10",
          "level": 45,
          "statBonus": null
        },
        {
          "name": "悪意の邪蛇",
          "kind": "skill",
          "desc": "自分の力・魔攻・魔防・技+10",
          "level": 50,
          "statBonus": {
            "atk": 10,
            "mag": 10,
            "res": 10,
            "tec": 10
          }
        }
      ]
    }
  }
});

if (typeof module !== "undefined") {
    module.exports = { ABILITY_DATA };
}

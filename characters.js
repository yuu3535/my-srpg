// ============================================================
//  characters.js  ―  全キャラクターデータ
//
//  side      : "ally" | "enemy"
//  x / y     : グリッド座標（x=列, y=行, 0始まり）
//  spells    : { 日本語魔法名: 成功値 }
//  skills    : { 日本語特技名: 成功値 }
//  physicalBonus : DB（物理ダメージボーナス式）
//  magicBonus    : MB（魔法ダメージボーナス式）
// ============================================================

const CHARACTERS_DATA = [

    // ============================================================
    // 味方
    // ============================================================

    {
        id: "ringholm",
        name: "リングホルム",
        side: "ally",
        race: "ヒト",
        clan: "黒の一族",

        x: 1, y: 7,

        level: 5,
        hp: 23, maxHp: 23,
        mp: 28, maxMp: 28,

        str: 26, con: 23, dex: 22, pow: 28, edu: 24, int: 25, siz: 10,
        courage: 90, luck: 35,

        move: 3, attackRange: 1,
        physicalBonus: "1d6", magicBonus: "2d6",

        moved: false, acted: false,
        char: "リ",
        tokenImage: "Character/リングホルムアイコン.png",
        portraitImage: "立ち絵AI生成/リングホルム1.png",  portraitBgSize: "340%",  portraitBgPos: "center -30px",

        spells: {
            火: 9,
            カウンター: 9,
            虚像: 9,
            破壊: 9,
            ヒトダマ: 7,
        },
        skills: {
            応急手当: 8,
            隠密: 5,
            回避: 9,
            説得: 6,
            戦闘指揮: 8,
            盗む: 6,
            武器: 9,
            武道: 9,
            目星: 6,
        },

        seizureType: "破壊衝動",
        secretArt: "黒炎",
        statusEffects: [],
    },

    {
        id: "arshe",
        name: "アルシェ",
        side: "ally",
        race: "ヒト",
        clan: "天使の落胤",

        x: 2, y: 7,

        level: 4,
        hp: 22, maxHp: 22,
        mp: 26, maxMp: 26,

        str: 22, con: 20, dex: 23, pow: 26, edu: 24, int: 20, siz: 13,
        courage: 90, luck: 90,

        move: 3, attackRange: 1,
        physicalBonus: "1d6", magicBonus: "2d6",

        moved: false, acted: false,
        char: "ア",
        tokenImage: "Character/アルシェアイコン.png",
        portraitImage: "立ち絵AI生成/アルシェ1.png",  portraitBgSize: "300%",  portraitBgPos: "60% top",

        spells: {
            火: 7,
            カウンター: 7,
            結界: 6,
            破壊: 7,
            封印: 8,
            落雷: 9,
        },
        skills: {
            暗器: 7,
            隠密: 6,
            回避: 7,
            説得: 6,
            投擲: 7,
            武器: 7,
            武道: 6,
            変装: 6,
            魔導: 6,
        },

        seizureType: "共鳴",
        secretArt: "祈り",
        statusEffects: [],
    },

    {
        id: "ivan",
        name: "イヴァン",
        side: "ally",
        race: "エルフ",
        clan: "白の一族",

        x: 3, y: 7,

        level: 4,
        hp: 21, maxHp: 21,
        mp: 29, maxMp: 29,

        str: 17, con: 18, dex: 23, pow: 29, edu: 23, int: 20, siz: 15,
        courage: 70, luck: 30,

        move: 3, attackRange: 2,
        physicalBonus: "1d4", magicBonus: "2d6",

        moved: false, acted: false,
        char: "イ",
        tokenImage: "Character/イヴァンアイコン.png",
        portraitImage: "立ち絵AI生成/イヴァン1.png",  portraitBgSize: "310%",  portraitBgPos: "center -50px",

        spells: {
            氷: 9,
            加速: 8,
            カウンター: 7,
            結界: 9,
            破壊: 8,
            "フギン＆ムギン": 9,
        },
        skills: {
            海洋学: 7,
            回避: 7,
            機械工学: 7,
            図書館: 8,
            武器: 8,
            魔導: 7,
            歴史: 6,
        },

        seizureType: "結晶化",
        secretArt: "凍結",
        statusEffects: [],
    },

    {
        id: "egun",
        name: "エギュン",
        side: "ally",
        race: "魔物",
        clan: "王族",

        x: 0, y: 8,

        level: 3,
        hp: 15, maxHp: 15,
        mp: 22, maxMp: 22,

        str: 18, con: 16, dex: 20, pow: 22, edu: 19, int: 19, siz: 8,
        courage: 80, luck: 80,

        move: 3, attackRange: 1,
        physicalBonus: "1d4", magicBonus: "2d6",

        moved: false, acted: false,
        char: "エ",
        tokenImage: "Character/エギュンアイコン.png",
        portraitImage: "立ち絵AI生成/エギュン1.png",  portraitBgSize: "320%",  portraitBgPos: "center -45px",

        spells: {
            水: 8,
            治癒: 7,
            結界: 7,
            破壊: 7,
            グレムリン: 8,
        },
        skills: {
            言いくるめ: 5,
            隠密: 3,
            回避: 7,
            聞き耳: 6,
            心理学: 9,
            水泳: 8,
            爪: 7,
            武道: 7,
        },

        seizureType: "なし",
        secretArt: "なし",
        statusEffects: [],
    },

    {
        id: "karima",
        name: "カリマ",
        side: "ally",
        race: "ヒト",
        clan: "天使の落胤",

        x: 1, y: 8,

        level: 4,
        hp: 21, maxHp: 21,
        mp: 27, maxMp: 27,

        str: 21, con: 20, dex: 27, pow: 27, edu: 25, int: 23, siz: 13,
        courage: 90, luck: 90,

        move: 3, attackRange: 1,
        physicalBonus: "1d6", magicBonus: "2d6",

        moved: false, acted: false,
        char: "カ",
        tokenImage: "Character/カリマ　立ち絵 (2).png",

        spells: {
            火: 5,
            治癒: 6,
            加速: 7,
            虚像: 5,
            結界: 7,
            補助: 6,
            落雷: 9,
        },
        skills: {
            隠密: 7,
            回避: 7,
            説得: 6,
            投擲: 7,
            変装: 9,
            捕縛: 7,
            魔導: 7,
            目星: 7,
            武器: 7,
        },

        seizureType: "共鳴",
        secretArt: "祈り",
        statusEffects: [],
    },

    {
        id: "karura",
        name: "カルラ",
        side: "ally",
        race: "エルフ",
        clan: "白の一族",

        x: 2, y: 8,

        level: 1,
        hp: 12, maxHp: 12,
        mp: 19, maxMp: 19,

        str: 8, con: 12, dex: 14, pow: 19, edu: 14, int: 16, siz: 12,
        courage: 70, luck: 45,

        move: 3, attackRange: 1,
        physicalBonus: "0", magicBonus: "1d6",

        moved: false, acted: false,
        char: "カ",
        tokenImage: "Character/カルラ 立ち絵 (2).png",

        spells: {
            氷: 9,
            治癒: 6,
            悪夢: 6,
            虚像: 6,
            結界: 5,
        },
        skills: {
            回避: 5,
            家事: 5,
            戯れる: 5,
            変装: 7,
            投擲: 5,
            図書館: 6,
            ナビゲート: 6,
            魔導: 6,
        },

        seizureType: "結晶化",
        secretArt: "凍結",
        statusEffects: [],
    },

    {
        id: "jack",
        name: "ジャック",
        side: "ally",
        race: "魔物",
        clan: "なし",

        x: 3, y: 8,

        level: 4,
        hp: 21, maxHp: 21,
        mp: 24, maxMp: 24,

        str: 25, con: 23, dex: 22, pow: 24, edu: 20, int: 17, siz: 14,
        courage: 65, luck: 60,

        move: 3, attackRange: 1,
        physicalBonus: "1d6", magicBonus: "2d6",

        moved: false, acted: false,
        char: "ジ",
        tokenImage: "Character/ジャックアイコン.png",
        portraitImage: "立ち絵AI生成/ジャック1.png",  portraitBgSize: "360%",

        spells: {
            治癒: 7,
            悪夢: 7,
            虚像: 8,
            結界: 7,
            暗器召喚: 7,
        },
        skills: {
            言いくるめ: 6,
            応急手当: 6,
            回避: 7,
            家事: 7,
            精神分析: 7,
            投擲: 9,
            武道: 5,
            キック: 6,
        },

        seizureType: "なし",
        secretArt: "なし",
        statusEffects: [],
    },

    {
        id: "baldo",
        name: "バルド",
        side: "ally",
        race: "竜人",
        clan: "なし",

        x: 4, y: 7,

        level: 4,
        hp: 28, maxHp: 28,
        mp: 25, maxMp: 25,

        str: 28, con: 23, dex: 25, pow: 25, edu: 19, int: 18, siz: 14,
        courage: 75, luck: 60,

        move: 3, attackRange: 1,
        physicalBonus: "2d6", magicBonus: "2d6",

        moved: false, acted: false,
        char: "バ",
        tokenImage: "Character/バルドアイコン.png",
        portraitImage: "立ち絵AI生成/バルド1.png",

        spells: {
            水: 8,
            風: 7,
            カウンター: 7,
            破壊: 7,
            封印: 7,
        },
        skills: {
            言いくるめ: 5,
            回避: 5,
            水泳: 9,
            跳躍: 7,
            爪: 7,
            ナビゲート: 6,
            尾撃: 6,
            武道: 8,
        },

        seizureType: "なし",
        secretArt: "なし",
        statusEffects: [],
    },

    {
        id: "roy",
        name: "ロイ",
        side: "ally",
        race: "魔物",
        clan: "吸血鬼",

        x: 4, y: 8,

        level: 3,
        hp: 19, maxHp: 19,
        mp: 16, maxMp: 16,

        str: 15, con: 26, dex: 17, pow: 16, edu: 18, int: 17, siz: 11,
        courage: 45, luck: 55,

        move: 3, attackRange: 1,
        physicalBonus: "1d4", magicBonus: "1d6",

        moved: false, acted: false,
        char: "ロ",
        tokenImage: "Character/ロイ　通常 (2).png",

        spells: {
            火: 5,
            治癒: 8,
            付与: 7,
            悪夢: 5,
        },
        skills: {
            回避: 6,
            家事: 8,
            芸術: 8,
            投擲: 5,
            図書館: 6,
            武器: 8,
            目星: 7,
        },

        seizureType: "督責",
        secretArt: "吸血",
        statusEffects: [],
    },

    {
        id: "albas",
        name: "アルバス",
        side: "ally",
        race: "魔物",
        clan: "王族",

        x: 0, y: 7,

        level: 5,
        hp: 28, maxHp: 28,
        mp: 36, maxMp: 36,

        str: 18, con: 29, dex: 36, pow: 36, edu: 28, int: 26, siz: 15,
        courage: 65, luck: 65,

        move: 3, attackRange: 1,
        physicalBonus: "1d6", magicBonus: "3d6",

        moved: false, acted: false,
        char: "ア",
        tokenImage: "Character/アルバスアイコン.png",
        portraitImage: "立ち絵AI生成/アルバス1.png",  portraitBgSize: "300%",  portraitBgPos: "center -20px",

        spells: {
            治癒: 9,
            加速: 8,
            結界: 8,
            転移: 8,
            破壊: 8,
            変身: 8,
            生命: 5,
            ジズ: 6,
            バハムート: 9,
            レヴィア: 9,
        },
        skills: {
            言いくるめ: 7,
            言語: 8,
            集中: 7,
            説得: 8,
            生物学: 9,
            跳躍: 7,
            目星: 7,
            魔導: 9,
        },

        seizureType: "なし",
        secretArt: "なし",
        statusEffects: [],
    },

    // ============================================================
    // 敵
    // ============================================================

    {
        id: "dylan",
        name: "ディラン",
        side: "enemy",
        race: "竜人",
        clan: "黒の一族",

        x: 5, y: 1,

        level: 4,
        hp: 26, maxHp: 26,
        mp: 24, maxMp: 24,

        str: 33, con: 26, dex: 26, pow: 17, edu: 23, int: 18, siz: 15,
        courage: 60, luck: 25,

        move: 3, attackRange: 1,
        physicalBonus: "2d6", magicBonus: "2d6",

        moved: false, acted: false,
        char: "デ",
        tokenImage: "Character/ディラン立ち絵.png",

        spells: {
            火: 9,
            破壊: 9,
            分霊: 9,
        },
        skills: {
            回避: 7,
            聞き耳: 8,
            跳躍: 8,
            追跡: 6,
            爪: 9,
            武道: 9,
            ブレス: 7,
            目星: 6,
        },

        seizureType: "破壊衝動",
        secretArt: "黒炎",
        statusEffects: [],
    },

    {
        id: "herel",
        name: "ヘレル",
        side: "enemy",
        race: "ヒト",
        clan: "星の一族",

        x: 7, y: 1,

        level: 4,
        hp: 18, maxHp: 18,
        mp: 23, maxMp: 23,

        str: 18, con: 20, dex: 21, pow: 23, edu: 20, int: 21, siz: 13,
        courage: 70, luck: 90,

        move: 3, attackRange: 1,
        physicalBonus: "1d4", magicBonus: "2d6",

        moved: false, acted: false,
        char: "ヘ",
        tokenImage: "Character/ヘレル立ち絵.png",

        spells: {
            隕石: 8,
            重力: 7,
            破壊: 6,
            浮遊: 7,
            分霊: 8,
        },
        skills: {
            言いくるめ: 6,
            隠密: 6,
            回避: 6,
            挑発: 5,
            天文学: 3,
            図書館: 6,
            魔導: 8,
            目星: 6,
            歴史: 7,
        },

        seizureType: "天災",
        secretArt: "なし",
        statusEffects: [],
    },

];

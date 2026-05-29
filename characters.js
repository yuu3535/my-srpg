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

        x: 2, y: 7,

        level: 5,
        hp: 23, maxHp: 23,
        mp: 28, maxMp: 28,

        str: 26, con: 23, dex: 22, pow: 28, edu: 24, int: 25, siz: 10,
        courage: 90, luck: 35,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "リ",
        tokenImage: "立ち絵AI生成/リングホルムドット.png",
        portraitImage: "立ち絵AI生成/リングホルム1.png",  portraitBgSize: "340%",  portraitBgPos: "center -30px",
        portraitImageDamaged: "立ち絵AI生成/リングホルム被弾.png",

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
        counterMode: "auto",      // 期待値で物理/魔法を自動選択
        statusEffects: [],
    },

    {
        id: "arshe",
        name: "アルシェ",
        side: "ally",
        race: "ヒト",
        clan: "天使の落胤",

        x: 3, y: 7,

        level: 4,
        hp: 22, maxHp: 22,
        mp: 26, maxMp: 26,

        str: 22, con: 20, dex: 23, pow: 26, edu: 24, int: 20, siz: 13,
        courage: 90, luck: 90,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ア",
        tokenImage: "立ち絵AI生成/幼少期アルシェドット.png",
        portraitImage: "立ち絵AI生成/アルシェ1.png",  portraitBgSize: "300%",  portraitBgPos: "60% top",
        portraitImageDamaged: "立ち絵AI生成/幼少期アルシェ被弾.png",

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
        counterMode: "auto",      // 期待値で物理/魔法を自動選択
        statusEffects: [],
    },

    {
        id: "albas",
        name: "アルバス",
        side: "ally",
        race: "魔物",
        clan: "王族",

        x: 4, y: 7,

        level: 5,
        hp: 28, maxHp: 28,
        mp: 36, maxMp: 36,

        str: 18, con: 29, dex: 36, pow: 36, edu: 28, int: 26, siz: 15,
        courage: 65, luck: 65,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ア",
        tokenImage: "立ち絵AI生成/アルバスドット.png",
        portraitImage: "立ち絵AI生成/アルバス1.png",  portraitBgSize: "300%",  portraitBgPos: "center -20px",
        portraitImageDamaged: "立ち絵AI生成/アルバス被弾.png",

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
        counterMode: "magic_first", // MPがある限り最高火力魔法で反撃
        statusEffects: [],
    },

    // ============================================================
    // 敵
    // ============================================================

    {
        id: "forest_guard",
        name: "森の番人",
        side: "enemy",
        race: "ヒト",
        clan: "なし",

        x: 3, y: 2,

        level: 2,
        hp: 14, maxHp: 14,
        mp: 8, maxMp: 8,

        str: 18, con: 18, dex: 17, pow: 12, edu: 12, int: 12, siz: 14,
        courage: 50, luck: 40,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "番",
        tokenImage: "立ち絵AI生成/モブ/アルストロ兵ドット.png",
        portraitImage: "立ち絵AI生成/モブ/アルストロ兵1.png",  portraitBgSize: "280%",  portraitBgPos: "center top",
        portraitImageDamaged: "立ち絵AI生成/モブ/アルストロ兵1被弾.png",

        spells: {},
        skills: {
            回避: 5,
            武器: 7,
            武道: 5,
        },

        seizureType: "なし",
        secretArt: "なし",
        counterMode: "physical_only", // 呪文なし、物理のみ
        statusEffects: [],
    },

    {
        id: "dylan",
        name: "ディラン",
        side: "enemy",
        race: "竜人",
        clan: "黒の一族",

        x: 4, y: 1,

        level: 4,
        hp: 26, maxHp: 26,
        mp: 24, maxMp: 24,

        str: 33, con: 26, dex: 26, pow: 17, edu: 23, int: 18, siz: 15,
        courage: 60, luck: 25,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "デ",
        tokenImage: "立ち絵AI生成/モブ/アルストロ将軍ドット.png",
        portraitImage: "立ち絵AI生成/モブ/アルストロ将軍1.png",  portraitBgSize: "280%",  portraitBgPos: "center top",
        portraitImageDamaged: "立ち絵AI生成/モブ/アルストロ将軍1被弾.png",

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
        counterMode: "auto",      // 物理(爪)も魔法(火)も強い、期待値で選択
        statusEffects: [],
    },

    {
        id: "herel",
        name: "ヘレル",
        side: "enemy",
        race: "ヒト",
        clan: "星の一族",

        x: 5, y: 2,

        level: 4,
        hp: 18, maxHp: 18,
        mp: 23, maxMp: 23,

        str: 18, con: 20, dex: 21, pow: 23, edu: 20, int: 21, siz: 13,
        courage: 70, luck: 90,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ヘ",
        tokenImage: "立ち絵AI生成/モブ/アルストロ兵魔法ドット.png",
        portraitImage: "立ち絵AI生成/モブ/アルストロ兵1魔法.png",  portraitBgSize: "280%",  portraitBgPos: "center top",
        portraitImageDamaged: "立ち絵AI生成/モブ/アルストロ兵1魔法被弾.png",

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
        counterMode: "magic_first", // 物理弱い、魔法(破壊)で反撃優先
        statusEffects: [],
    },

];

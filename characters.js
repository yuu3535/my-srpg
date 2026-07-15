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
        stats: { hp: { base: 12, gains: [2, 3, 3, 3] } },

        str: { base: 16, gains: [3, 3, 2, 2] },
        con: { base: 13, gains: [3, 1, 3, 3] },
        dex: { base: 15, gains: [3, 2, 1, 1] },
        pow: { base: 16, gains: [3, 3, 3, 3] },
        edu: { base: 14, gains: [2, 3, 2, 3] },
        int: { base: 14, gains: [3, 3, 3, 2] },
        siz: 10, app: 16,
        courage: 90, luck: 35,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "リ",
        tokenImage: "立ち絵AI生成/リングホルムドット.png",
        portraitImage: "立ち絵AI生成/リングホルム1.png",
        portraitBgSize: "360%",  portraitBgPos: "52% -20px",
        portraitDmgBgSize: "340%", portraitDmgBgPos: "center -10px",
        statusBgSize: "280%", statusBgPos: "center -25px",
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
        learnedPassives: ["sakki"],
        equippedPassives: ["sakki"],
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
        stats: { hp: { base: 13, gains: [3, 3, 3] } },

        str: { base: 14, gains: [3, 3, 2] },
        con: { base: 13, gains: [2, 3, 2] },
        dex: { base: 18, gains: [1, 3, 1] },
        pow: { base: 18, gains: [3, 3, 2] },
        edu: { base: 16, gains: [3, 3, 2] },
        int: { base: 14, gains: [2, 2, 2] },
        siz: 13, app: 15,
        courage: 90, luck: 90,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ア",
        tokenImage: "立ち絵AI生成/幼少期アルシェドット.png",
        portraitImage: "立ち絵AI生成/アルシェ1.png",
        portraitBgSize: "300%",  portraitBgPos: "60% top",
        portraitDmgBgSize: "250%", portraitDmgBgPos: "46% 5px",
        statusBgSize: "300%", statusBgPos: "60% top",
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
        stats: { hp: { base: 18, gains: [2, 2, 3, 3] } },

        str: { base: 12, gains: [1, 2, 2, 1] },
        con: { base: 21, gains: [3, 1, 1, 3] },
        dex: { base: 24, gains: [3, 3, 3, 3] },
        pow: { base: 24, gains: [3, 3, 3, 3] },
        edu: { base: 18, gains: [2, 3, 3, 2] },
        int: { base: 16, gains: [2, 2, 3, 3] },
        siz: 15, app: 17,
        courage: 65, luck: 65,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ア",
        tokenImage: "立ち絵AI生成/アルバスドット.png",
        portraitImage: "立ち絵AI生成/アルバス1.png",
        portraitBgSize: "400%",  portraitBgPos: "55% -15px",
        portraitDmgBgSize: "400%", portraitDmgBgPos: "49% -20px",
        statusBgSize: "355%", statusBgPos: "55% -25px",
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
    // プロローグ専用（Lv1）
    // ============================================================

    {
        id: "young_arshe",
        name: "アルシェ",
        side: "ally",
        race: "ヒト",
        clan: "天使の落胤",

        x: 2, y: 7,

        level: 1,
        hp: 13, maxHp: 13,
        mp: 18, maxMp: 18,
        stats: { hp: { base: 13, gains: [3, 3, 3] } },

        str: { base: 14, gains: [3, 3, 2] },
        con: { base: 13, gains: [2, 3, 2] },
        dex: { base: 18, gains: [1, 3, 1] },
        pow: { base: 18, gains: [3, 3, 2] },
        edu: { base: 16, gains: [3, 3, 2] },
        int: { base: 14, gains: [2, 2, 2] },
        siz: 13, app: 15,
        courage: 90, luck: 90,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ア",
        tokenImage: "立ち絵AI生成/幼少期アルシェドット.png",
        portraitImage: "立ち絵AI生成/幼少期アルシェ1.png",
        portraitBgSize: "300%",  portraitBgPos: "60% top",
        portraitDmgBgSize: "250%", portraitDmgBgPos: "46% 5px",
        statusBgSize: "300%", statusBgPos: "60% top",
        portraitImageDamaged: "立ち絵AI生成/幼少期アルシェ被弾.png",

        spells: {
            カウンター: 8,
            破壊: 6,
            封印: 6,
            火: 5,
            落雷: 4,
        },
        skills: {
            武器: 9,
            回避: 6,
            投擲: 6,
            武道: 4,
            暗器: 4,
            隠密: 4,
            説得: 4,
            魔導: 4,
            変装: 3,
        },

        seizureType: "共鳴",
        secretArt: "祈り",
        counterMode: "auto",
        statusEffects: [],
    },

    {
        id: "young_karima",
        name: "カリマ",
        side: "ally",
        race: "ヒト",
        clan: "天使の落胤",

        x: 3, y: 7,

        level: 1,
        hp: 12, maxHp: 12,
        mp: 18, maxMp: 18,

        str: 14, con: 12, dex: 18, pow: 18, edu: 16, int: 14, siz: 13, app: 15,
        courage: 90, luck: 90,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "カ",
        tokenImage: "立ち絵AI生成/幼少期カリマドット.png",
        portraitImage: "立ち絵AI生成/幼少期カリマ1.png",
        portraitBgSize: "300%",  portraitBgPos: "55% top",
        portraitDmgBgSize: "250%", portraitDmgBgPos: "50% 5px",
        statusBgSize: "300%", statusBgPos: "55% top",
        portraitImageDamaged: "立ち絵AI生成/幼少期カリマ1.png",

        spells: {
            加速: 9,
            治癒: 7,
            結界: 7,
            補助: 4,
            虚像: 3,
            落雷: 3,
        },
        skills: {
            魔導: 9,
            回避: 6,
            目星: 6,
            投擲: 5,
            変装: 4,
            捕縛: 4,
            隠密: 4,
            説得: 4,
            武器: 4,
        },

        seizureType: "共鳴",
        secretArt: "祈り",
        counterMode: "magic_first",
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

        str: 18, con: 18, dex: 17, pow: 12, edu: 12, int: 12, siz: 14, app: 10,
        courage: 50, luck: 40,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "番",
        tokenImage: "立ち絵AI生成/モブ/アルストロ兵ドット.png",
        portraitImage: "立ち絵AI生成/モブ/アルストロ兵1.png",
        portraitBgSize: "350%",  portraitBgPos: "53% -40px",
        portraitDmgBgSize: "355%", portraitDmgBgPos: "34% -30px",
        statusBgSize: "275%", statusBgPos: "54% -35px",
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

        str: 33, con: 26, dex: 26, pow: 17, edu: 23, int: 18, siz: 15, app: 10,
        courage: 60, luck: 25,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "デ",
        tokenImage: "立ち絵AI生成/モブ/アルストロ将軍ドット.png",
        portraitImage: "立ち絵AI生成/モブ/アルストロ将軍1.png",
        portraitBgSize: "280%",  portraitBgPos: "center top",
        portraitDmgBgSize: "285%", portraitDmgBgPos: "center top",
        statusBgSize: "285%", statusBgPos: "46% -25px",
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
        id: "gunter",
        name: "ギュンター",
        side: "enemy",
        race: "ヒト",
        clan: "なし",

        x: 3, y: 2,

        level: 4,
        hp: 24, maxHp: 24,
        mp: 27, maxMp: 27,

        str: 30, con: 27, dex: 30, pow: 27, edu: 25, int: 19, siz: 15, app: 14,
        courage: 70, luck: 50,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ギ",
        tokenImage: "立ち絵AI生成/ギュンタードット絵.png",
        portraitImage: "立ち絵AI生成/ギュンター立ち絵.png",
        portraitBgSize: "280%",  portraitBgPos: "center top",
        portraitDmgBgSize: "280%", portraitDmgBgPos: "center top",
        statusBgSize: "280%", statusBgPos: "center top",
        portraitImageDamaged: "立ち絵AI生成/ギュンター立ち絵.png",

        spells: {
            転移: 9,
            水: 8,
            破壊: 8,
            カウンター: 7,
            結界: 6,
        },
        skills: {
            隠密: 8,
            回避: 8,
            武器: 8,
            武道: 8,
            跳躍: 8,
            追跡: 7,
            聞き耳: 6,
        },

        seizureType: "なし",
        secretArt: "なし",
        learnedPassives: ["chuuseishin"],
        equippedPassives: ["chuuseishin"],
        counterMode: "auto",
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

        str: 18, con: 20, dex: 21, pow: 23, edu: 20, int: 21, siz: 13, app: 13,
        courage: 70, luck: 90,

        move: 3, attackRange: 1,

        moved: false, acted: false,
        char: "ヘ",
        tokenImage: "立ち絵AI生成/モブ/アルストロ兵魔法ドット.png",
        portraitImage: "立ち絵AI生成/モブ/アルストロ兵1魔法.png",
        portraitBgSize: "285%",  portraitBgPos: "center -25px",
        portraitDmgBgSize: "250%", portraitDmgBgPos: "44% -15px",
        statusBgSize: "250%", statusBgPos: "34% -20px",
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

if (typeof module !== "undefined") {
    module.exports = CHARACTERS_DATA;
}

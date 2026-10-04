using System;
using System.Linq;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 場所の配置表（マップ担当の docs/10-design/map/layouts/*.json）を、Unity が読める形にしたもの。
    /// tools/map_layout.py unity が書き出す（Assets/Data/Maps/*.json）。マス目は {x, y}（上が北・行0）
    /// </summary>
    [Serializable]
    public class MapLayoutFile
    {
        public string mapId;
        public string name;
        public bool indoor;
        public string timeOfDay;
        public int columns, rows;
        public string[] terrain;
        public MapSymbol[] symbols;
        public MapArea[] battleAreas;
        public MapObject[] objects;
        public MapProp[] props;       // 板の絵の小物（通行に影響しない）
        public MapLight[] lights;     // 点の光
        public MapExit[] exits;
        public MapState[] states;
        public MapInspect[] inspect;   // 場面によらず調べられる所

        public MapState State(string id) => states?.FirstOrDefault(s => s.id == id);
    }

    [Serializable] public class MapCell { public int x, y; public Vector2Int V => new Vector2Int(x, y); }

    [Serializable]
    public class MapSymbol
    {
        public string symbol, name;
        public int[] color;    // r, g, b（下絵の色）
        public string rules;   // 決まりの上書き（配置表の legend にあるものだけ）: "walk=1,flyEnter=1,flyStop=0,height=0.3"
    }

    [Serializable] public class MapArea { public string id, battleId; public int x, y, w, h; public bool Contains(Vector2Int c) => c.x >= x && c.x < x + w && c.y >= y && c.y < y + h; }

    [Serializable]
    public class MapObject
    {
        public string id, kind;
        public MapCell[] cells;
        public bool blocks;
        public float height;   // 見た目の高さ（配置表になければ 0.6）
    }

    /// <summary>板の絵の小物。edge はマスのどの辺に置くか（north / east / south / west / center）</summary>
    [Serializable] public class MapProp { public string id, kind, edge; public int x, y; public Vector2Int Cell => new Vector2Int(x, y); }

    /// <summary>点の光。color は violet（紫の魔灯）/ warm（暖かい炎）/ window（窓の光）</summary>
    [Serializable] public class MapLight { public string kind, color; public int x, y; public Vector2Int Cell => new Vector2Int(x, y); }

    [Serializable]
    public class MapExit
    {
        public string id, label, toMap, facing;
        public string lockedText;   // 条件を満たさないときに出す一言（なければ、足りない物・会う人から作る）
        public MapCell[] cells;
        public bool hasTarget;
        public MapCell toCell;
        public string[] requires;   // "item:黒陽の双剣" / "block:prologue_1_1.b06"
    }

    [Serializable]
    public class MapState
    {
        public string id, scene;
        public MapPerson player;
        public string[] onEnter;
        public MapPerson[] people;
        public MapTalkArea[] talkAreas;
        public MapInspect[] inspect;
        public MapGoal[] goals;
        public string thenPlace2D, thenState2D;   // 入ったときの会話のあと、2Dの場所（Assets/Data/Corridors/<place>.json）のこの場面へ移る
    }

    [Serializable] public class MapPerson { public string id, name, facing, talkBlock; public int x, y; public Vector2Int Cell => new Vector2Int(x, y); }

    [Serializable]
    public class MapTalkArea
    {
        public string id, block, trigger;
        public int x, y, w, h;
        public bool required, ambient, once;
        public bool Contains(Vector2Int c) => c.x >= x && c.x < x + w && c.y >= y && c.y < y + h;
    }

    [Serializable]
    public class MapInspect
    {
        public string id, block, text, label;
        public MapCell[] cells;
        public bool required;   // 先へ進むのに要る（印を目立たせる）
    }

    [Serializable]
    public class MapGoal
    {
        public string id, exit, block, thenBattleArea, thenBlock;
        public MapCell[] cells;
        public MapCell talkAt;      // 着いたら、このマスまで歩いてから会話（イベントの場面の位置。原作者 2026-10-05）
        public bool hasTalkAt;
    }
}

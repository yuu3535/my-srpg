using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Srpg.Battle
{
    /// <summary>
    /// 探索の新しい画面（探索の仕様書 explore_spec.md・探索の札 E。2026-11-14 総合担当）。
    /// 押した所の当たり判定（ExploreHit）→ 歩いて選ぶ（縁が光って札が出る）→ もう一度押すか札を押すと調べる・話す。
    /// 出口は押して開く札にせず、端まで歩けば出る（途中の扉は「EXIT 〇〇へ」の案内の範囲を押すと、歩いて出入りする。原作者 2026-11-14）。
    /// 何があるかはシナリオの場面が決める（原作者 2026-11-14「シナリオにあわせる」）。見た目は ExploreOverlay
    /// </summary>
    public partial class Explore2DController
    {
        private ExploreOverlay overlay;
        private readonly List<ExploreOverlay.Item> viewItems = new List<ExploreOverlay.Item>();
        private readonly Dictionary<string, Action> executes = new Dictionary<string, Action>();
        private readonly Dictionary<string, MapExit> exitOf = new Dictionary<string, MapExit>();
        private string selectedId, alsoId;
        private float endHold;
        private bool endArmed = true;
        public const string HintFlag = "explore:hint";

        /// <summary>確認用: 今の当たり判定の一覧（部屋の座標）</summary>
        public IReadOnlyList<ExploreOverlay.Item> Targets => viewItems;
        public string SelectedId => selectedId;
        public ExploreOverlay Overlay => overlay;

        private void SetupModern()
        {
            if (overlay != null) return;
            view.Modern = true;
            overlay = ExploreOverlay.Create(this, view);
            overlay.Tapped = OnScreenTap;
            overlay.CardPressed = () => { if (selectedId != null && !Busy) { var id = selectedId; overlay.PressCard(() => Execute(id)); } };
            overlay.AlsoPressed = SwitchToAlso;
            overlay.ArrowTapped = OnArrowTap;
        }

        private static string GotKey(string mapId, string id) => $"got:{mapId}:{id}";
        private bool Got(string id) => map != null && played.Contains(GotKey(map.mapId, id));

        /// <summary>今の場面の、調べる・話す・出口を作り直す</summary>
        private void RefreshTargets()
        {
            if (overlay == null || view == null || map == null) return;
            viewItems.Clear(); executes.Clear(); exitOf.Clear();
            float feet = view.FeetY, hh = view.HeroHeight;
            foreach (var p in State?.people ?? Array.Empty<MapPerson>())
            {
                if (string.IsNullOrEmpty(p.talkBlock) || !personX.TryGetValue(p.id, out var x)) continue;
                var spot = SpotOf(p.id);
                var person = p;
                var it = new ExploreOverlay.Item
                {
                    target = new ExploreHit.Target
                    {
                        id = p.id, kind = ExploreHit.Kind.Talk,
                        hit = RectOf(spot?.hit, new Rect(x * 2f - 80f, (feet - hh) * 2f - 20f, 160f, hh * 2f + 40f)),
                        point = PointOf(spot?.point, new Vector2(x * 2f, (feet - hh * 0.75f) * 2f)),
                    },
                    verb = "話す", name = NameOf(p),
                };
                viewItems.Add(it);
                executes[p.id] = () => Talk(person);
            }
            foreach (var i in InspectSpots())
            {
                float x = CellsX(i.id, i.cells);
                if (x == float.MaxValue || viewItems.Any(v => v.target.id == i.id)) continue;
                // 調べたときの文がまだ無い所は出さない（御伽噺の本は、シナリオの進行で場所を決める。原作者 2026-11-14「後で決めてもいい？」）
                if (string.IsNullOrEmpty(i.block) && string.IsNullOrEmpty(i.text)) continue;
                var spot = SpotOf(i.id);
                bool gives = spot?.kind == "item" || (spot?.kind != "tips" && !string.IsNullOrEmpty(i.block) && (scenario?.Block(i.block)?.Shown.Any(l => !string.IsNullOrEmpty(l.item)) ?? false));
                bool got = gives && Got(i.id);
                var inspect = i;
                var it = new ExploreOverlay.Item
                {
                    target = new ExploreHit.Target
                    {
                        id = i.id, kind = gives && !got ? ExploreHit.Kind.Item : ExploreHit.Kind.Tips,
                        hit = RectOf(spot?.hit, new Rect(x * 2f - 110f, feet * 2f - 340f, 220f, 360f)),
                        point = PointOf(spot?.point, new Vector2(x * 2f, feet * 2f - 260f)),
                    },
                    verb = "調べる", name = InspectName(i), got = got,
                    rim = spot?.rim, rimRect = RectOf(spot?.rimRect, Rect.zero), delay = spot?.rimDelay ?? 0f,
                };
                viewItems.Add(it);
                string empty = !string.IsNullOrEmpty(spot?.emptyText) ? spot.emptyText : "もう何もない。";
                executes[i.id] = () =>
                {
                    if (gives && Got(inspect.id)) { PlayLines(new[] { new ScenarioLine { type = "narration", text = empty } }); return; }
                    if (gives) played.Add(GotKey(map.mapId, inspect.id));
                    Inspect(inspect);
                    if (gives) RefreshTargets();   // 取ったら光らない（チップスと同じ扱い）
                };
            }
            foreach (var e in map.exits ?? Array.Empty<MapExit>())
            {
                float x = CellsX(e.id, e.cells);
                if (x == float.MaxValue) continue;
                x = Mathf.Clamp(x, 0f, view.Length);
                var spot = SpotOf(e.id);
                bool rightEnd = Mathf.Abs(x - view.WalkMaxX) < 140f || x > view.WalkMaxX;
                bool leftEnd = !rightEnd && (Mathf.Abs(x - view.WalkMinX) < 140f || x < view.WalkMinX);
                var t = new ExploreHit.Target
                {
                    id = e.id, kind = ExploreHit.Kind.Exit,
                    hit = RectOf(spot?.hit, new Rect(x * 2f - 110f, feet * 2f - 380f, 220f, 420f)),
                    point = PointOf(spot?.point, new Vector2(x * 2f, feet * 2f - 220f)),
                };
                if (rightEnd || leftEnd)
                {
                    t.stripRight = rightEnd;
                    t.stripX = spot != null && spot.strip != 0f ? spot.strip : rightEnd ? view.WalkMaxX * 2f + 60f : view.WalkMinX * 2f - 60f;
                }
                string name = ExitLabel(e);
                string jp = !string.IsNullOrEmpty(spot?.label) ? spot.label : name.Contains("へ") ? name : name + "へ";   // 「訓練場へ下りる階段」はそのまま
                viewItems.Add(new ExploreOverlay.Item
                {
                    target = t, exitJp = jp, exitEn = !string.IsNullOrEmpty(spot?.en) ? spot.en : "EXIT",
                    plate = RectOf(spot?.plate, Rect.zero),
                });
                exitOf[e.id] = e;
            }
            overlay.SetItems(viewItems);
            overlay.SetPlace(DialogueView.Chapter, !string.IsNullOrEmpty(map.name) ? map.name : Place);
            if (selectedId != null && viewItems.All(v => v.target.id != selectedId)) Deselect();
            else if (selectedId != null) overlay.Select(viewItems.First(v => v.target.id == selectedId), null);
        }

        private static Rect RectOf(float[] v, Rect fallback) => v != null && v.Length >= 4 ? new Rect(v[0], v[1], v[2], v[3]) : fallback;
        private static Vector2 PointOf(float[] v, Vector2 fallback) => v != null && v.Length >= 2 ? new Vector2(v[0], v[1]) : fallback;

        private ExploreOverlay.Item ItemOf(string id) => viewItems.FirstOrDefault(v => v.target.id == id);

        private void Deselect()
        {
            selectedId = null;
            alsoId = null;
            overlay?.ClearSelect();
        }

        // ── 押した ──

        /// <summary>部屋を押した（画面の点）。仕様書 §3.1 の順で決める</summary>
        public void OnScreenTap(Vector2 screen)
        {
            if (view == null || overlay == null || Busy || overlay.Exiting || State == null) return;
            if (overlay.HintOn) { overlay.HintOn = false; played.Add(HintFlag); }
            var u = view.WorldOf(screen);
            TapWorld(new Vector2(u.x * 2f, u.y * 2f), overlay.OverlayOf(screen).x);
        }

        /// <summary>部屋の座標の p を押したのと同じ（確認用にも）。floorX＝床の印を出す画面の横の位置（NaN なら出さない）</summary>
        public void TapWorld(Vector2 p, float floorX = float.NaN)
        {
            if (Busy || overlay == null || overlay.Exiting) return;
            // 床（アルシェの足元の少し上から下）を押したら歩く。物の近くの床でも選ばない
            var r = ExploreHit.Pick(p, viewItems.Select(v => v.target).ToList(), selectedId, 110f, view.FeetY * 2f - 30f);
            switch (r.action)
            {
                case ExploreHit.Action.Exit: Deselect(); GoExit(r.id); break;
                case ExploreHit.Action.Execute: { var id = r.id; overlay.PressCard(() => Execute(id)); break; }
                case ExploreHit.Action.Select: WalkToSelect(r.id, r.also); break;
                default:
                    Deselect();
                    if (!float.IsNaN(floorX)) overlay.FloorMark(floorX);
                    view.WalkToTap(p.x / 2f, p.y / 2f);
                    break;
            }
        }

        /// <summary>その物まで歩いてから選ぶ（縁が光って札が出る）。歩いている途中で別の所を押したら行き先を変える</summary>
        private void WalkToSelect(string id, string alsoId)
        {
            var it = ItemOf(id);
            if (it == null) return;
            Deselect();
            float tx = it.target.point.x / 2f;
            float stand = it.target.kind == ExploreHit.Kind.Talk ? (view.PlayerX <= tx ? tx - StandOff : tx + StandOff) : tx;
            stand = Mathf.Clamp(stand, view.WalkMinX, view.WalkMaxX);
            view.WalkTo(stand, () =>
            {
                view.Face(tx);
                selectedId = id;
                this.alsoId = alsoId;
                overlay.Select(it, alsoId != null ? ItemOf(alsoId) : null);
            }, null, scripted: false);
        }

        private void SwitchToAlso()
        {
            // 札の下の「ALSO」: 重なっているもう1つに切り替える（もとの物が ALSO へ回る）
            var cur = ItemOf(selectedId);
            var next = alsoId != null ? ItemOf(alsoId) : null;
            if (cur == null || next == null) return;
            selectedId = next.target.id;
            alsoId = cur.target.id;
            overlay.Select(next, cur);
        }

        /// <summary>選んでいる物を実行（調べる／話す）。選択は外す（閉じたら探索に戻る）</summary>
        private void Execute(string id)
        {
            Deselect();
            if (Busy) return;
            if (executes.TryGetValue(id, out var act)) act();
        }

        // ── 矢印・端・出口 ──

        private void OnArrowTap(int dir)
        {
            if (Busy || overlay.Exiting) return;
            Deselect();
            view.WalkTo(dir < 0 ? view.WalkMinX : view.WalkMaxX, null, null, scripted: false);   // その方向の端まで歩く
        }

        /// <summary>その向きの端にある出口（なければ null）</summary>
        private MapExit EndExit(int dir)
        {
            foreach (var it in viewItems)
            {
                var t = it.target;
                if (t.kind != ExploreHit.Kind.Exit || float.IsNaN(t.stripX) || t.stripRight != dir > 0) continue;
                return exitOf.TryGetValue(t.id, out var e) ? e : null;
            }
            return null;
        }

        /// <summary>出口へ歩いて出る（端の出口は端まで）</summary>
        private void GoExit(string id)
        {
            if (!exitOf.TryGetValue(id, out var exit)) return;
            var t = ItemOf(id)?.target;
            float stand = t != null && !float.IsNaN(t.stripX) ? (t.stripRight ? view.WalkMaxX : view.WalkMinX) : Mathf.Clamp(CellsX(exit.id, exit.cells), view.WalkMinX, view.WalkMaxX);
            endArmed = false;
            view.WalkTo(stand, () => UseExit(exit), null, scripted: true);
        }

        /// <summary>場所を移る（新しい画面は 2.3秒の暗転と「EN ── 行き先」。古い画面は短い暗転）</summary>
        private void Transit(MapExit exit, Action enter)
        {
            if (overlay == null || !Application.isPlaying) { StartCoroutine(Move(enter)); return; }
            moving = true;
            Deselect();
            var it = ItemOf(exit.id);
            overlay.PlayExit(it?.exitEn ?? "EXIT", it?.exitJp ?? ExitLabel(exit), enter, () => moving = false);
        }

        /// <summary>毎コマ（Update から）: 見せる・矢印・端で押し続けたら出る・Enter で実行</summary>
        private void UpdateModern(bool busy)
        {
            bool hidden = busy || Menu.Hub2Menu.Blocking || Menu.SupportSelectView.Talking || SaveMenu.IsOpen || SettingsMenu.IsOpen;
            overlay.Visible = !hidden || overlay.Exiting;
            // 矢印は、その向きにまだ部屋が続くとき（カメラがまだ動けるとき）だけ。端では出さない（右の端は出口の案内が見えている）
            overlay.ShowLeft = !hidden && !view.CamAtMin;
            overlay.ShowRight = !hidden && !view.CamAtMax;
            if (!overlay.HintOn && !played.Contains(HintFlag) && !hidden && !overlay.Exiting) overlay.HintOn = true;
            if (hidden && overlay.HintOn) overlay.HintOn = false;
            if (hidden || overlay.Exiting) { endHold = 0f; return; }
            // 端で、その向きに押し続けたら（端に着いてから 0.35秒）出る
            var kb = Keyboard.current;
            int push = overlay.RunDir;
            if (push == 0 && kb != null) push = kb.rightArrowKey.isPressed || kb.dKey.isPressed ? 1 : kb.leftArrowKey.isPressed || kb.aKey.isPressed ? -1 : 0;
            bool atEnd = push > 0 ? view.AtMax : push < 0 && view.AtMin;
            if (!view.AtMax && !view.AtMin) endArmed = true;
            if (atEnd && endArmed && EndExit(push) is MapExit ex)
            {
                endHold += Time.unscaledDeltaTime;
                if (endHold >= 0.35f) { endHold = 0f; endArmed = false; view.Hold(0); view.Running = false; UseExit(ex); }
            }
            else endHold = 0f;
            // パソコン: Enter・スペースで選んでいる物を実行
            if (kb != null && selectedId != null && (kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame))
            {
                var id = selectedId;
                overlay.PressCard(() => Execute(id));
            }
            // 選んでいる物から離れたら（矢印で歩いたなど）、選択を外す
            if (selectedId != null && ItemOf(selectedId) is ExploreOverlay.Item cur && Mathf.Abs(cur.target.point.x / 2f - view.PlayerX) > 260f) Deselect();
        }
    }
}

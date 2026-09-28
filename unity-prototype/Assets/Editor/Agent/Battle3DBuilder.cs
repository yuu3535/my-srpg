using System;
using System.IO;
using System.Linq;
using Srpg.Battle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// Unity版の戦闘（M1）を3Dの盤面で動かすシーンを組み立てる（Claude Code がコマンドから実行する）。
    ///
    ///   Unity.exe -batchmode -projectPath unity-prototype -executeMethod Srpg.EditorAgent.Battle3DBuilder.BuildAll -quit -logFile -
    ///
    /// 原作者 2026-09-27: マップは3Dの盤面に置き換える（docs/10-design/map/MAP_BOARD_METHOD_DECISION_2026-09-27.md）。
    /// 1. 3D用の描画設定・模様・陣営の枠・木の絵を用意する（Board3DTestBuilder と同じもの）
    /// 2. シーン Assets/Scenes/Battle3D.unity を作り直し、ビルドの最初のシーンにする
    /// 3. Assets/Previews/Battle3D_*.png を書き出す（全体・アルシェを選んだところ・動かしたところ・狙われた印・真上）
    /// データは tools/export_unity_battle.js（ブラウザ版から書き出し）で用意しておく。
    /// </summary>
    public static class Battle3DBuilder
    {
        private const string DataPath = "Assets/Data/Battles/battle_trial_adopted.json";
        private const string PlanPath = "Assets/Data/Battles/battle_trial_adopted_plan.json";   // 戦闘の状態（tools/export_unity_battle_plan.mjs）
        private const string ScenePath = "Assets/Scenes/Battle3D.unity";
        private const string UiDataPath = "Assets/Data/Battles/battle_trial_adopted_ui.json";   // 表示（tools/export_unity_battle_ui.mjs）
        private const string UiDir = "Assets/Art/UI";
        private const string PortraitDir = "Assets/Art/Portraits";

        // 画面のUIに使う素材（ブラウザ版の assets/ui から写す）と、9分割の枠の幅（左・下・右・上。元の絵の px）
        private static readonly (string name, Vector4 border)[] HudSprites =
        {
            ("panel_even", new Vector4(26, 26, 26, 26)),
            ("panel_even_enemy", new Vector4(26, 26, 26, 26)),
            ("button_b2_normal", new Vector4(64, 0, 64, 0)),
            ("button_b2_pressed", new Vector4(64, 0, 64, 0)),
            ("button_b2_disabled", new Vector4(64, 0, 64, 0)),
            ("button_f3_normal", new Vector4(24, 0, 24, 0)),
            ("button_f3_pressed", new Vector4(24, 0, 24, 0)),
            ("fc_band", Vector4.zero),
            ("fc_emblem_sword", Vector4.zero),
            ("heading_flourish", Vector4.zero),
            ("roster_frame", new Vector4(8, 20, 8, 20)),
            ("face_frame", Vector4.zero),
            ("face_frame_selected", Vector4.zero),
            ("face_frame_done", Vector4.zero),
            ("mark_selected", Vector4.zero),
            ("mark_target", Vector4.zero),
            ("mark_intent", Vector4.zero),
            ("weapon_sword", Vector4.zero),
            ("weapon_lance", Vector4.zero),
            ("weapon_axe", Vector4.zero),
            ("weapon_bow", Vector4.zero),
            ("weapon_staff", Vector4.zero),
            ("weapon_magic", Vector4.zero),
        };

        public static void BuildAll()
        {
            try
            {
                int rendererIndex = Board3DTestBuilder.EnsureUniversalRenderer();
                Board3DTestBuilder.WriteTreePicture();
                Board3DTestBuilder.CopyUiFrames();
                BuildScene(rendererIndex);
                Debug.Log("[Battle3DBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        private static void BuildScene(int rendererIndex)
        {
            var data = JsonUtility.FromJson<BattleDataFile>(File.ReadAllText(DataPath));
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Board3DTestBuilder.CreateStage(rendererIndex, out var camera, out var light, out _);

            var viewObject = new GameObject("Board3D");
            var view = viewObject.AddComponent<Board3DView>();
            Board3DTestBuilder.ConfigureView(view, camera, light, data.units.Select(u => u.id), buildOnStart: false, startOverview: false);
            var viewSo = new SerializedObject(view);
            viewSo.FindProperty("showCellInfo").boolValue = false;   // 左上は戦闘の表示（フェーズ・ログ）
            // 盤面は国境監視路（Battle3DController.layout）。地面は描いてもらった1枚絵（あれば）
            const string groundPath = Board3DTestBuilder.GroundDir + "/watchroad_ground.png";
            if (File.Exists(groundPath))
            {
                AssetDatabase.ImportAsset(groundPath, ImportAssetOptions.ForceSynchronousImport);
                var groundImporter = (TextureImporter)AssetImporter.GetAtPath(groundPath);
                groundImporter.wrapMode = TextureWrapMode.Clamp;
                groundImporter.filterMode = FilterMode.Trilinear;
                groundImporter.mipmapEnabled = true;
                groundImporter.maxTextureSize = 4096;
                groundImporter.textureCompression = TextureImporterCompression.Uncompressed;
                groundImporter.SaveAndReimport();
                viewSo.FindProperty("groundTexture").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Texture2D>(groundPath);
            }
            viewSo.ApplyModifiedPropertiesWithoutUndo();

            var controllerObject = new GameObject("Battle3D");
            var controller = controllerObject.AddComponent<Battle3DController>();
            var so = new SerializedObject(controller);
            so.FindProperty("battleJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(DataPath);
            so.FindProperty("planJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(PlanPath);
            so.FindProperty("view").objectReferenceValue = view;
            so.FindProperty("uiJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(UiDataPath);   // 攻撃の選択肢
            so.ApplyModifiedPropertiesWithoutUndo();
            var hud = CreateHud(controller, camera);

            // 見え方は T5 の C を原作の素材の色に寄せたもの（MAP_COLOR_MOOD_DIRECTION_2026-09-27.md）
            Board3DTestBuilder.SetMood(string.IsNullOrEmpty(data.timeOfDay) ? Board3DMood.Dusk : data.timeOfDay);   // 戦闘データの時間帯
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;

            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;

            controller.Setup();
            view.SetView(true, 0, true);
            camera.Render();   // 最初の1枚は陰影の準備が間に合わず暗くなるので、一度空撮りする
            Board3DTestBuilder.Render(camera, rt, "Battle3D_board");

            // アルシェのマスを画面上で押して選ぶ → 移動範囲が出る
            var arshe = controller.Units.First(u => u.source.id == "arshe");
            TapOnScreen(view, camera, arshe.cell);
            if (controller.Selected != arshe) throw new InvalidOperationException("アルシェを押して選べなかった");
            Board3DTestBuilder.Render(camera, rt, "Battle3D_select");

            // 2マス奥を押して動かし、待機
            // いちばん奥へ動ける（地形の決まりで行けるマスから選ぶ）
            var dest = controller.MoveCells.OrderBy(c => c.y).ThenBy(c => Mathf.Abs(c.x - arshe.cell.x)).First();
            TapOnScreen(view, camera, dest);
            if (arshe.cell != dest) throw new InvalidOperationException("移動範囲のマスを押して動かせなかった");
            controller.ChooseWait();
            // 敵に狙われている印（赤い丸）
            controller.SetTargeted("ringholm", true);
            view.SetCloseView(30f, -45f, view.Map.TopCenter(new Vector2Int(4, 5)) + Vector3.up * 0.4f, 2.6f);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_moved_targeted");
            controller.SetTargeted("ringholm", false);

            // アルバスが敵のアルバスへ攻撃する: 動いて「攻撃」→ 攻撃の範囲（赤）→ 相手を選んで戦闘予測 → 実行
            view.SetView(true, 0, true);
            var albas = controller.Units.First(u => u.source.id == "albas");
            // 敵のアルバスを、橋の向こうの近くに置いて戦わせる（画像のため）
            controller.TeleportForTest("albas_rival", albas.cell + new Vector2Int(0, -3));
            TapOnScreen(view, camera, albas.cell);
            TapOnScreen(view, camera, albas.cell + new Vector2Int(0, -2));
            controller.ChooseAttack();
            Board3DTestBuilder.Render(camera, rt, "Battle3D_attack_range");
            controller.ShowForecast("albas_rival");
            if (controller.CurrentForecast == null) throw new InvalidOperationException("戦闘予測が出なかった");
            var forecast = controller.CurrentForecast;
            controller.RollsOverride = new Srpg.Battle.Plan.ForecastRolls();   // 画像を毎回同じにするため、予測どおりに当てる
            controller.ConfirmAttack();
            var rival = controller.Units.First(u => u.source.id == "albas_rival");
            if (rival.plan.hp != forecast.defenderHpAfter) throw new InvalidOperationException($"予測と実際が違う（{rival.plan.hp} / {forecast.defenderHpAfter}）");
            Debug.Log($"[Battle3DBuilder] アルバス→敵のアルバス: 予測 HP {forecast.defenderHpAfter}、実際 {rival.plan.hp}");

            // 敵の番（待たずに進める）
            controller.EndTurn();
            Debug.Log("[Battle3DBuilder] " + string.Join(" / ", controller.Log.Skip(Math.Max(0, controller.Log.Count - 12))));
            Board3DTestBuilder.Render(camera, rt, "Battle3D_after_enemy");
            controller.RollsOverride = null;

            view.SetView(false, 0, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_top");
            view.SetView(true, 4, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_turn180");
            view.SetView(true, 1, true);   // 正面（原作者 2026-09-27）
            Board3DTestBuilder.Render(camera, rt, "Battle3D_front");

            // 寄りの画面（原作者 2026-09-27: 戦闘は寄りが基本。全体はボタンで見る）
            controller.Setup();
            view.SetView(true, 0, true);
            view.SetOverview(false, true);
            controller.FocusOnAllies(true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_close");
            controller.Select("arshe");
            Board3DTestBuilder.Render(camera, rt, "Battle3D_close_select");
            view.SetView(true, 1, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_close_front");
            view.SetView(false, 0, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_close_top");
            // 赤い丸（狙われている印）の位置: 斜めと真上で、キャラの絵に合っているか
            foreach (var ally in controller.Units.Where(u => u.Side == "ally")) controller.SetTargeted(ally.Id, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_ring_top");
            view.SetView(true, 0, true);
            Board3DTestBuilder.Render(camera, rt, "Battle3D_ring_tilt");
            foreach (var ally in controller.Units.Where(u => u.Side == "ally")) controller.SetTargeted(ally.Id, false);

            // 画面のUI（1段目: コマンド・ユニットと武器のカード・戦闘予測の帯）
            controller.Setup();
            view.SetView(true, 0, true);
            controller.FocusOnAllies(true);
            hud.Build();
            RenderWithHud(hud, camera, rt, "Battle3D_ui_idle");
            hud.OpenStatus();
            RenderWithHud(hud, camera, rt, "Battle3D_ui_status");
            hud.CloseStatus();
            controller.Select("albas");
            RenderWithHud(hud, camera, rt, "Battle3D_ui_select");
            // コマンド「魔法」の一覧（入れ替えた一覧）
            hud.GetComponentsInChildren<UnityEngine.UI.Button>(true).First(x => x.name == "Command_魔法").onClick.Invoke();
            RenderWithHud(hud, camera, rt, "Battle3D_ui_magic_list");
            // 補助の魔法「回復」: 届く味方（緑）から対象を選ぶ
            hud.GetComponentsInChildren<UnityEngine.UI.Button>(true).First(x => x.name == "Command_回復").onClick.Invoke();
            RenderWithHud(hud, camera, rt, "Battle3D_ui_support");
            controller.CancelTargeting();
            // 転移: 味方を選んだあと、行き先のマスを選ぶところ
            var albasSel = controller.Units.First(u => u.source.id == "albas");
            controller.ChooseSupport(controller.SupportsOf(albasSel).First(o => o.label == "転移"));
            controller.TapCell(controller.Units.First(u => u.source.id == "ringholm").cell);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_transfer");
            controller.CancelTargeting();
            // 持ち物: リングホルムがポーション小を拾ったところ
            controller.Select("ringholm");
            controller.TapCell(controller.MapItems.Keys.First());
            hud.Refresh();
            hud.GetComponentsInChildren<UnityEngine.UI.Button>(true).First(x => x.name == "Command_持ち物").onClick.Invoke();
            RenderWithHud(hud, camera, rt, "Battle3D_ui_items");
            controller.UndoMove();
            controller.Select("albas");
            // 敵の攻撃の前の予測（見るだけ）
            controller.PreviewEnemyAttack("albas_rival");
            if (controller.EnemyPreview == null) throw new InvalidOperationException("UIの確認: 敵の攻撃の予測が出なかった");
            RenderWithHud(hud, camera, rt, "Battle3D_ui_enemy_preview");
            controller.ClearEnemyPreview();
            controller.Select("albas");
            var albasUi = controller.Units.First(u => u.source.id == "albas");
            controller.TeleportForTest("albas_rival", albasUi.cell + new Vector2Int(0, -3));
            controller.TapCell(albasUi.cell + new Vector2Int(0, -2));
            RenderWithHud(hud, camera, rt, "Battle3D_ui_acting");
            controller.ChooseAttack();
            controller.ShowForecast("albas_rival");
            if (controller.CurrentForecast == null) throw new InvalidOperationException("UIの確認: 戦闘予測が出なかった");
            view.FocusOnPoint((view.Map.TopCenter(albasUi.cell) + view.Map.TopCenter(controller.Target.cell)) * 0.5f, true);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_forecast");
            // 攻撃の切り替え（‹ ›）: 次の攻撃の予測。攻撃の選択肢が2つ以上ある味方（アルシェ）で撮る（レビュー 2026-09-28: アルバスは1つで、切り替えが撮れていなかった）
            controller.CancelForecast();
            controller.CancelTargeting();
            controller.UndoMove();
            var arsheUi = controller.Units.First(u => u.source.id == "arshe");
            var rivalUi = controller.Units.First(u => u.source.id == "albas_rival");
            controller.TeleportForTest("albas_rival", arsheUi.cell + new Vector2Int(0, -1));
            controller.Select("arshe");
            controller.ChooseAttack();
            controller.ShowForecast("albas_rival");
            if (controller.ForecastOptions.Count < 2) throw new InvalidOperationException("UIの確認: アルシェの攻撃の選択肢が2つ以上ない");
            controller.CycleForecastOption(1);
            view.FocusOnPoint((view.Map.TopCenter(arsheUi.cell) + view.Map.TopCenter(rivalUi.cell)) * 0.5f, true);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_forecast_next");
            // 封じの付く落雷: 予測の帯の上に「MP・封じ」の1行が出る（レビュー 2026-09-28 D1）
            for (int i = 0; i < controller.ForecastOptions.Count && controller.CurrentOption?.label != "落雷"; i++) controller.CycleForecastOption(1);
            if (controller.CurrentOption?.label == "落雷") RenderWithHud(hud, camera, rt, "Battle3D_ui_forecast_seal");
            else Debug.LogWarning("UIの確認: アルシェの落雷が戦闘予測の選択肢にない");
            controller.CycleForecastOption(-1);
            // 味方全員を待機させて敵の番へ（敵が予告どおりに動いたあと、次の味方の番の予告と赤い丸）
            controller.CancelForecast();
            controller.CancelTargeting();
            controller.ChooseWait();
            foreach (var ally in controller.Units.Where(u => u.Side == "ally" && u.Alive && !u.acted).ToList())
            {
                controller.Select(ally.Id);
                controller.ChooseWait();
            }
            // 味方が全員行動したら敵の番は自動で進む（ターン2の味方の番になっている）
            if (controller.Turn != 2 || controller.CurrentPhase != Battle3DController.Phase.Ally)
                throw new InvalidOperationException($"UIの確認: 敵の番のあとターン2になっていない（ターン{controller.Turn}・{controller.CurrentPhase}）");
            controller.FocusOnAllies(true);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_turn2");
            // 交換（原作者 2026-09-28: 落ちている物を拾うより、味方どうしの交換）: カリマのポーションをアルシェがもらう
            controller.Setup();
            view.SetView(true, 0, true);
            var arsheTrade = controller.Units.First(u => u.source.id == "arshe");
            var besideArshe = new[] { Vector2Int.right, Vector2Int.left, Vector2Int.up, Vector2Int.down }.Select(d => arsheTrade.cell + d)
                .First(c => view.Map.InBounds(c) && view.Map.CanStop(c, false) && !controller.Units.Any(u => u.Alive && u.cell == c));
            controller.TeleportForTest("young_karima", besideArshe);
            controller.GiveItemForTest("young_karima", new ItemData { id = "small_potion", name = "ポーション小", type = "heal", value = 5 });
            controller.Select("arshe");
            controller.TapCell(arsheTrade.cell);
            view.FocusOn(arsheTrade.cell, true);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_trade_command");
            controller.ChooseTrade();
            if (controller.TradePartner == null) throw new InvalidOperationException("交換の確認: 隣のカリマが相手にならなかった");
            RenderWithHud(hud, camera, rt, "Battle3D_ui_trade");
            controller.TakeItem(0);
            if (arsheTrade.items.Count != 1) throw new InvalidOperationException("交換の確認: ポーションをもらえなかった");
            RenderWithHud(hud, camera, rt, "Battle3D_ui_trade_after");
            controller.EndTrade();

            // 召喚「ヒトダマ」: ターン1に陣を置く → ターン3の始まりに出る → リングホルムが倒れたら消える（敵の攻撃は全部外れにする）
            controller.Setup();
            view.SetView(true, 0, true);
            hud.Build();
            controller.RollsOverride = new Srpg.Battle.Plan.FixedRolls(Enumerable.Repeat(100, 2000), Enumerable.Repeat(1, 2000));
            var ringholmS = controller.Units.First(u => u.source.id == "ringholm");
            var summonEntry = controller.UiOf(ringholmS).magicList.First(m => !string.IsNullOrEmpty(m.summonUnitId));
            controller.Select("ringholm");
            controller.ChooseSummon(summonEntry);
            controller.TapCell(controller.TargetCells.First());   // 隣の空いているマス（地形の決まりで置けるマス）
            if (controller.PendingSummons.Count != 1 || controller.PendingSummons[0].dueTurn != 3)
                throw new InvalidOperationException("召喚の確認: ターン1に陣を置いてターン3に出る予定にならなかった");
            view.FocusOn(ringholmS.cell, true);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_summon_circle");
            controller.EndTurn();
            if (controller.Units.Any(u => u.source.id == "hitodama")) throw new InvalidOperationException("召喚の確認: ターン2に出てしまった");
            controller.EndTurn();
            var hitodama = controller.Units.FirstOrDefault(u => u.source.id == "hitodama");
            if (controller.Turn != 3 || hitodama == null || !hitodama.Alive) throw new InvalidOperationException($"召喚の確認: ターン3にヒトダマが出なかった（ターン{controller.Turn}）");
            controller.Select("hitodama");
            view.FocusOn(hitodama.cell, true);
            RenderWithHud(hud, camera, rt, "Battle3D_ui_summon");
            Debug.Log($"[Battle3DBuilder] ヒトダマ: HP {hitodama.plan.hp}/{hitodama.plan.maxHp} MP {hitodama.plan.mp} 魔攻 {hitodama.plan.stats.mag} 能力 {string.Join(",", hitodama.plan.abilityNames)}");
            ringholmS.plan.hp = 0;
            controller.CheckBattleEnd();
            if (hitodama.Alive) throw new InvalidOperationException("召喚の確認: リングホルムが倒れてもヒトダマが消えなかった");
            controller.RollsOverride = null;
            hud.Clear();
            view.SetOverview(true, true);
            view.SetView(true, 0, true);

            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
            hud.Clear();         // UIは再生したときに作る（作った絵はシーンに保存できないため）
            controller.Setup();  // シーンには始まりの状態を保存する（盤面の見た目はこのあと消す）
            view.ClearBoard();   // 盤面は再生したときに作る（作ったマテリアルはシーンに保存できないため）
            EditorSceneManager.SaveScene(scene, ScenePath);

            // 3Dの戦闘を最初のシーンにする
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            AssetDatabase.SaveAssets();
        }

        /// <summary>画面上でそのマスを押したことにする（押す判定から戦闘の処理までを通して確かめる）</summary>
        /// <summary>画面のUIを作り、素材（ブラウザ版の assets/ui・立ち絵・コマンドのアイコン）をつなぐ</summary>
        internal static Battle3DHud CreateHud(Battle3DController controller, Camera camera, string uiDataPath = UiDataPath)
        {
            Directory.CreateDirectory(UiDir);
            var sprites = new System.Collections.Generic.List<(string name, Sprite sprite)>();
            foreach (var (name, border) in HudSprites)
            {
                string dest = $"{UiDir}/{name}.png";
                // 中身が同じなら写さない（読み込み中の絵は上書きできないことがある）
                string source = $"../assets/ui/{name}.png";
                if (!File.Exists(dest) || !File.ReadAllBytes(source).AsSpan().SequenceEqual(File.ReadAllBytes(dest)))
                    File.Copy(source, dest, true);
                sprites.Add((name, ImportSprite(dest, border)));
            }
            foreach (var path in Directory.GetFiles($"{UiDir}/Icons", "*.png"))
                sprites.Add(("icon_" + Path.GetFileNameWithoutExtension(path), ImportSprite(path.Replace(Path.DirectorySeparatorChar, '/'), Vector4.zero)));
            var portraitList = new System.Collections.Generic.List<(string name, Texture2D texture)>();
            foreach (var path in Directory.GetFiles(PortraitDir, "*.png"))
            {
                string asset = path.Replace(Path.DirectorySeparatorChar, '/');
                AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport);
                var importer = (TextureImporter)AssetImporter.GetAtPath(asset);
                importer.textureType = TextureImporterType.Default;
                importer.alphaIsTransparency = true;
                importer.mipmapEnabled = false;
                importer.maxTextureSize = 1024;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
                portraitList.Add((Path.GetFileNameWithoutExtension(path), AssetDatabase.LoadAssetAtPath<Texture2D>(asset)));
            }

            var hudObject = new GameObject("Battle3DHud");
            var hud = hudObject.AddComponent<Battle3DHud>();
            var so = new SerializedObject(hud);
            so.FindProperty("controller").objectReferenceValue = controller;
            so.FindProperty("targetCamera").objectReferenceValue = camera;
            so.FindProperty("uiJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(uiDataPath);
            // 明朝体はゲームに同梱する（原作者 2026-09-27。Noto Serif JP の 400・700。OFL）
            so.FindProperty("regularFont").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/NotoSerifJP-Regular.ttf");
            so.FindProperty("boldFont").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Font>("Assets/Fonts/NotoSerifJP-Bold.ttf");
            var spritesProp = so.FindProperty("sprites");
            spritesProp.arraySize = sprites.Count;
            for (int i = 0; i < sprites.Count; i++)
            {
                spritesProp.GetArrayElementAtIndex(i).FindPropertyRelative("name").stringValue = sprites[i].name;
                spritesProp.GetArrayElementAtIndex(i).FindPropertyRelative("sprite").objectReferenceValue = sprites[i].sprite;
            }
            var portraitsProp = so.FindProperty("portraits");
            portraitsProp.arraySize = portraitList.Count;
            for (int i = 0; i < portraitList.Count; i++)
            {
                portraitsProp.GetArrayElementAtIndex(i).FindPropertyRelative("name").stringValue = portraitList[i].name;
                portraitsProp.GetArrayElementAtIndex(i).FindPropertyRelative("texture").objectReferenceValue = portraitList[i].texture;
            }
            so.ApplyModifiedPropertiesWithoutUndo();

            var controllerSo = new SerializedObject(controller);
            controllerSo.FindProperty("hud").objectReferenceValue = hud;
            controllerSo.ApplyModifiedPropertiesWithoutUndo();
            return hud;
        }

        private static Sprite ImportSprite(string asset, Vector4 border)
        {
            AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(asset);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = 100;
            importer.spriteBorder = border;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Sprite>(asset);
        }

        /// <summary>UIを今の状態にしてから撮る</summary>
        internal static void RenderWithHud(Battle3DHud hud, Camera camera, RenderTexture rt, string name)
        {
            hud.Refresh();
            hud.UpdateOverlays();
            hud.UpdateTerrain();
            Canvas.ForceUpdateCanvases();
            Board3DTestBuilder.Render(camera, rt, name);
        }

        private static void TapOnScreen(Board3DView view, Camera camera, Vector2Int cell)
        {
            var screen = view.CellToScreen(cell);
            if (!view.TryPickCell(screen, out var picked) || picked != cell)
                throw new InvalidOperationException($"マス {cell} を押せなかった（{picked}）");
            // ▶で押したときと同じく、押したマスを戦闘の処理へ渡す（CellTapped → Battle3DController.TapCell）
            UnityEngine.Object.FindFirstObjectByType<Battle3DController>().TapCell(picked);
        }
    }
}

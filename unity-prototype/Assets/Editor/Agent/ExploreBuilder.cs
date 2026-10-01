using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Srpg.Battle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Srpg.EditorAgent
{
    /// <summary>
    /// 探索のシーン（Assets/Scenes/Explore3D.unity。プロローグ1-1 計画の段4）を組み立て、
    /// 自室で起きてから訓練場に着くまでを自動で進めて撮る（途中で止まったら失敗にする）。▶で遊ぶときは同じシーンを開く
    /// </summary>
    public static class ExploreBuilder
    {
        private const string ScenePath = "Assets/Scenes/Explore3D.unity";
        private const string MapDir = "Assets/Data/Maps";
        private const string ScenarioPath = "Assets/Data/Scenario/prologue_1_1.json";
        // 段5: 訓練場の戦闘（ブラウザ版から書き出したデータ。tools/export_unity_battle*.* battle_prologue_training）と手引き
        private const string BattleId = "battle_prologue_training";
        private const string BattlePath = "Assets/Data/Battles/" + BattleId + ".json";
        private const string BattlePlanPath = "Assets/Data/Battles/" + BattleId + "_plan.json";
        private const string BattleUiPath = "Assets/Data/Battles/" + BattleId + "_ui.json";
        private const string TutorialPath = "Assets/Data/Scenario/prologue_training_tutorial.json";
        private static readonly string[] BattleTokens = { "young_arshe", "gunter" };

        [MenuItem("Srpg/探索のシーンを組み立てて、訓練場まで歩いて撮る")]
        public static void BuildAll()
        {
            try
            {
                int rendererIndex = Board3DTestBuilder.EnsureUniversalRenderer();
                var (explore, camera) = BuildScene(rendererIndex);
                Walkthrough(explore, camera);
                // 保存するシーンは始まる前の状態（盤面は再生したときに作る）
                EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
                Debug.Log("[ExploreBuilder] done");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                throw;
            }
        }

        private static (ExploreController, Camera) BuildScene(int rendererIndex)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Board3DTestBuilder.CreateStage(rendererIndex, out var camera, out var light, out _);
            var view = new GameObject("Board3D").AddComponent<Board3DView>();
            foreach (var id in BattleTokens) PrepareToken(id);
            Board3DTestBuilder.ConfigureView(view, camera, light, new[] { "arshe", "young_karima", "carrie" }.Concat(BattleTokens), buildOnStart: false, startOverview: false);
            var viewSo = new SerializedObject(view);
            viewSo.FindProperty("backdrop").objectReferenceValue = null;   // 城の場所は森の遠景を出さない（城の遠景が届くまで）
            viewSo.FindProperty("showCellInfo").boolValue = false;
            viewSo.ApplyModifiedPropertiesWithoutUndo();
            var dialogue = DialogueBuilder.CreateView(camera);

            // 段5: 訓練場の戦闘（探索と同じ盤面で戦う。始まるまで隠しておく）
            var battleObject = new GameObject("Battle3D");
            var battle = battleObject.AddComponent<Battle3DController>();
            var battleSo = new SerializedObject(battle);
            battleSo.FindProperty("battleJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(BattlePath);
            battleSo.FindProperty("planJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(BattlePlanPath);
            battleSo.FindProperty("uiJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(BattleUiPath);
            battleSo.FindProperty("view").objectReferenceValue = view;
            battleSo.FindProperty("layout").stringValue = "";
            battleSo.FindProperty("setupOnStart").boolValue = false;
            battleSo.ApplyModifiedPropertiesWithoutUndo();
            var battleHud = Battle3DBuilder.CreateHud(battle, camera, BattleUiPath);
            battleHud.gameObject.SetActive(false);
            battleObject.SetActive(false);

            var go = new GameObject("Explore");
            var explore = go.AddComponent<ExploreController>();
            var so = new SerializedObject(explore);
            so.FindProperty("battle").objectReferenceValue = battle;
            so.FindProperty("tutorialJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(TutorialPath);
            so.FindProperty("view").objectReferenceValue = view;
            so.FindProperty("dialogue").objectReferenceValue = dialogue;
            so.FindProperty("scenarioJson").objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(ScenarioPath);
            var jsons = Directory.GetFiles(MapDir, "*.json").OrderBy(p => p, StringComparer.Ordinal).Select(p => p.Replace(Path.DirectorySeparatorChar, '/')).ToArray();
            var placesProp = so.FindProperty("placeJsons");
            placesProp.arraySize = jsons.Length;
            var groundsProp = so.FindProperty("grounds");
            groundsProp.arraySize = jsons.Length;
            for (int i = 0; i < jsons.Length; i++)
            {
                placesProp.GetArrayElementAtIndex(i).objectReferenceValue = AssetDatabase.LoadAssetAtPath<TextAsset>(jsons[i]);
                string mapId = Path.GetFileNameWithoutExtension(jsons[i]);
                groundsProp.GetArrayElementAtIndex(i).FindPropertyRelative("mapId").stringValue = mapId;
                groundsProp.GetArrayElementAtIndex(i).FindPropertyRelative("texture").objectReferenceValue = MapLayoutBuilder.GroundOf(mapId);
            }
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorSceneManager.SaveScene(scene, ScenePath);
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Add(new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            return (explore, camera);
        }

        /// <summary>自室 → 剣を取る → 廊下（キャリー・ヘンリー）→ 訓練場。着くまで自動で進めて、要所を撮る</summary>
        private static void Walkthrough(ExploreController explore, Camera camera)
        {
            var rt = new RenderTexture(Board3DTestBuilder.PreviewWidth, Board3DTestBuilder.PreviewHeight, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = rt;
            camera.aspect = (float)Board3DTestBuilder.PreviewWidth / Board3DTestBuilder.PreviewHeight;
            ShaderUtil.allowAsyncCompilation = false;
            var dialogue = UnityEngine.Object.FindFirstObjectByType<DialogueView>();
            var view = UnityEngine.Object.FindFirstObjectByType<Board3DView>();
            var log = new List<string>();
            explore.Log += line => { log.Add(line); Debug.Log("[ExploreBuilder] " + line); };
            int shot = 0;

            void Shot(string name)
            {
                view.UpdateBillboards();
                explore.Hud?.Refresh();
                Canvas.ForceUpdateCanvases();
                Board3DTestBuilder.Render(camera, rt, $"Explore_{++shot:00}_{name}");
                var line = dialogue.CurrentLine;
                Debug.Log($"[ExploreBuilder] shot {shot} {name}: {explore.Place?.mapId} {explore.Player} {(dialogue.IsPlaying ? $"{line?.speaker}「{line?.text?.Replace("\n", " ")}」" : "")}");
            }

            void FinishTalk()
            {
                for (int guard = 0; dialogue.IsPlaying && guard < 400; guard++) dialogue.Advance();
            }

            camera.Render();
            explore.Begin();
            Shot("wake");
            FinishTalk();
            Shot("room");

            // 行けないマス（壁）を押した → 赤く光り「そこへは行けない」（レビュー J1）
            explore.Tap(new Vector2Int(0, 0));
            Shot("cannot_go");
            // 剣を取る前に部屋の扉へ → アルシェの一言で止まる（レビュー J3）
            explore.Tap(explore.Place.exits.First(e => e.id == "to_corridor").cells[0].V);
            if (!dialogue.IsPlaying) throw new InvalidOperationException("探索の確認: 剣を持たずに部屋を出られてしまった");
            Shot("door_locked");
            FinishTalk();

            // 剣立てを調べる（必須の調べる所）
            var sword = explore.State.inspect.First(i => i.id == "find_sword");
            explore.Tap(sword.cells[0].V);
            Shot("sword");
            FinishTalk();
            if (!explore.Items.Contains("黒陽の双剣")) throw new InvalidOperationException("探索の確認: 剣を取れなかった");

            // 部屋を出る
            var toCorridor = explore.Place.exits.First(e => e.id == "to_corridor");
            explore.Tap(toCorridor.cells[0].V);
            if (explore.Place.mapId != "orcus_corridor") throw new InvalidOperationException($"探索の確認: 廊下へ出られなかった（{explore.Place.mapId}）");
            Shot("corridor");
            FinishTalk();

            // 訓練場への階段を目指す。途中の会話（キャリー・ヘンリー・井戸端会議）は流して進む
            for (int guard = 0; guard < 12 && explore.Place.mapId == "orcus_corridor"; guard++)
            {
                var toYard = explore.Place.exits.First(e => e.id == "to_yard");
                explore.Tap(toYard.cells[0].V);
                if (dialogue.IsPlaying && explore.Place.mapId == "orcus_corridor")
                {
                    bool carrie = dialogue.CurrentLine?.speaker != "アルシェ";
                    Shot("talk_" + (carrie ? "carrie" : "henry"));
                    FinishTalk();
                    if (carrie)
                    {
                        // キャリーとだけ話して階段へ行ったとき（ヘンリーの前）→ 止める一言（レビュー J3）
                        explore.CheckCellForTest(explore.Place.exits.First(e => e.id == "to_yard").cells[0].V);
                        Shot("stairs_locked");
                        FinishTalk();
                        Shot("corridor_after_carrie");
                    }
                }
            }
            if (explore.Place.mapId != "orcus_training_yard") throw new InvalidOperationException($"探索の確認: 訓練場に着かなかった（{explore.Place.mapId}・{explore.Player}）");
            Shot("yard");
            // 合流の会話（b10）を流しきると、戦闘が始まる（段5）
            for (int guard = 0; dialogue.IsPlaying && !explore.InBattle && guard < 400; guard++) dialogue.Advance();
            if (!explore.InBattle) throw new InvalidOperationException("探索の確認: 訓練場に着いても戦闘へ進まなかった");
            Battle(explore, dialogue, view, camera, rt, ref shot);
            Debug.Log($"[ExploreBuilder] 流したブロック: {string.Join(" ", explore.Seen)} / 持ち物: {string.Join("・", explore.Items)}");
            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(rt);
        }

        /// <summary>
        /// 訓練の戦闘（段5）を手引きどおりに進めて撮る: 交換 → 移動 → カリマの火の杖 → 敵の番 → ポーション → 両断 → 通常攻撃 → 勝利 → 会話 b12。
        /// 乱数は予測どおり（すべて当たる）
        /// </summary>
        private static void Battle(ExploreController explore, DialogueView dialogue, Board3DView view, Camera camera, RenderTexture rt, ref int shot)
        {
            var b = explore.Battle;
            var hud = b.Hud;
            int n = shot;
            b.RollsOverride = new Srpg.Battle.Plan.ForecastRolls();
            var log = new List<string>();

            void Shot(string name)
            {
                if (!hud.Built) hud.Build();
                if (hud.StatusOpen) hud.CloseStatus();
                view.UpdateBillboards();
                Battle3DBuilder.RenderWithHud(hud, camera, rt, $"Explore_{++n:00}_{name}");
                var line = dialogue.CurrentLine;
                Debug.Log($"[ExploreBuilder] shot {n} {name}: ターン{b.Turn} {b.CurrentPhase} 手引き「{b.Guide}」 {(dialogue.IsPlaying ? $"{line?.speaker}「{line?.text?.Replace("\n", " ")}」" : "")}");
            }

            void FinishTalk()
            {
                for (int guard = 0; dialogue.IsPlaying && guard < 400; guard++) dialogue.Advance();
            }

            Battle3DController.UnitState U(string id) => b.Units.First(u => u.Id == id);
            int Dist(Vector2Int a, Vector2Int c) => Mathf.Abs(a.x - c.x) + Mathf.Abs(a.y - c.y);
            var gunter = U("gunter");

            // 始まり: カリマ「僕のツノ知らない？」（表の70行）
            Shot("battle_start");
            FinishTalk();
            if (explore.Tutorial?.CurrentId != "trade") throw new InvalidOperationException($"手引きの確認: 最初が交換になっていない（{explore.Tutorial?.CurrentId}）");
            Shot("battle_guide_trade");

            // 交換: アルシェがツノを渡し、ポーションをもらう
            var arshe = U("young_arshe");
            var karima = U("young_karima");
            b.Select("young_arshe");
            b.ChooseTrade();
            if (b.TradePartner != karima) throw new InvalidOperationException("手引きの確認: 隣のカリマと交換にならなかった");
            b.GiveItem(arshe.items.FindIndex(i => i.name == "ツノ"));
            b.TakeItem(karima.items.FindIndex(i => i.type == "heal"));
            Shot("battle_trade");
            b.EndTrade();
            if (!karima.items.Any(i => i.name == "ツノ") || !arshe.items.Any(i => i.type == "heal")) throw new InvalidOperationException("手引きの確認: ツノとポーションを交換できなかった");
            Shot("battle_after_trade");   // 表の71行（お礼にポーション）から
            FinishTalk();
            Shot("battle_guide_move");
            b.ChooseWait();   // 交換のあと、アルシェはまだ行動できる。ここでは動かしてから待つ（移動は取り消せない）
            FinishTalk();

            // ターンを回して勝つまで（両断・火の杖を一度ずつ使い、あとは通常攻撃。傷ついたらポーション）
            bool usedArt = false, usedMagic = false, usedItem = false;
            string lastLesson = explore.Tutorial?.CurrentId;
            for (int guard = 0; guard < 12 && b.CurrentPhase == Battle3DController.Phase.Ally; guard++)
            {
                // 手引きが変わったら撮る（帯の文を確かめる）
                if (explore.Tutorial?.CurrentId != lastLesson && !dialogue.IsPlaying)
                {
                    lastLesson = explore.Tutorial?.CurrentId;
                    Shot($"battle_guide_{lastLesson ?? "finish"}");
                }
                var actor = b.Units.FirstOrDefault(u => u.Alive && u.Side == "ally" && !u.acted);
                if (actor == null) { b.EndTurn(); FinishTalk(); continue; }
                b.Select(actor.Id);
                if (!usedItem && actor.plan.hp < actor.plan.maxHp && actor.items.Any(i => i.type == "heal"))
                {
                    b.TapCell(actor.cell);
                    Shot("battle_guide_item");
                    b.UseItem(actor.items.FindIndex(i => i.type == "heal"));
                    usedItem = true;
                    FinishTalk();
                    continue;
                }
                var options = b.OptionsOf(actor);
                var option = (!usedArt ? options.FirstOrDefault(o => o.label == "両断") : null)
                    ?? (!usedMagic ? options.FirstOrDefault(o => o.isMagic) : null)
                    ?? b.BasicOption(actor);
                var cells = b.MoveCells.Append(actor.cell).ToList();
                var from = cells.Where(c => option.InRange(Dist(c, gunter.cell))).OrderBy(c => Dist(c, actor.cell)).Cast<Vector2Int?>().FirstOrDefault();
                if (from == null)
                {
                    // 届かない: いちばん近づけるマスへ動いて待つ
                    var near = cells.OrderBy(c => Dist(c, gunter.cell)).First();
                    b.TapCell(near);
                    FinishTalk();
                    b.ChooseWait();
                    FinishTalk();
                    continue;
                }
                b.TapCell(from.Value);
                FinishTalk();
                b.ChooseOption(option);
                b.ShowForecast(gunter);
                if (b.CurrentForecast == null) throw new InvalidOperationException($"手引きの確認: {actor.Name}の{option.label}の予測が出なかった");
                view.FocusOnPoint((view.Map.TopCenter(actor.cell) + view.Map.TopCenter(gunter.cell)) * 0.5f, true);
                Shot($"battle_forecast_{(option.label == "両断" ? "art" : option.isMagic ? "magic" : "attack")}");
                b.ConfirmAttack();
                if (option.label == "両断") usedArt = true;
                if (option.isMagic) usedMagic = true;
                if (!explore.InBattle) break;   // 勝った（戦闘のあとの会話が始まっている）
                FinishTalk();
                if (b.CurrentPhase == Battle3DController.Phase.Ally && b.Turn >= 2 && !log.Contains("turn2")) { log.Add("turn2"); Shot("battle_turn2"); }
            }
            b.RollsOverride = null;
            Debug.Log("[ExploreBuilder] 戦闘の記録: " + string.Join(" / ", b.Log));
            if (explore.InBattle) throw new InvalidOperationException($"手引きの確認: 戦闘が終わらなかった（ターン{b.Turn}・{b.CurrentPhase}・ギュンター HP {gunter.plan.hp}）");
            if (!usedArt || !usedMagic) throw new InvalidOperationException("手引きの確認: 両断・火の杖を使わずに終わった");
            // 勝ったら訓練場の「戦闘のあと」の場面に入り、会話 b12 が流れる
            if (!dialogue.IsPlaying || explore.State?.id != "prologue_1_1_after_training") throw new InvalidOperationException($"手引きの確認: 戦闘のあとの会話が始まらなかった（{explore.State?.id}）");
            Shot("after_training");
            FinishTalk();
            Shot("prologue_end");
            shot = n;
        }

        /// <summary>戦闘に出るキャラの盤面の絵を、ほかのキャラと同じ読み込み設定にする（足元が絵の下から2%）</summary>
        private static void PrepareToken(string id)
        {
            string path = $"{Board3DTestBuilder.TokenDir}/{id}.png";
            if (!File.Exists(path)) return;
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            var settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.Custom;
            settings.spritePivot = new Vector2(0.5f, 0.02f);
            importer.SetTextureSettings(settings);
            importer.spritePixelsPerUnit = 100;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            importer.SaveAndReimport();
        }
    }
}

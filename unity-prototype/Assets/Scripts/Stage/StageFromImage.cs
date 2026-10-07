using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Srpg.Stage
{
    /// <summary>
    /// 2Dの背景の絵を舞台にして、3Dのキャラ（VRM）を歩かせる試作（原作者 2026-10-07。Xで見た「絵の中を歩かせる」の検証）。
    /// 舞台のデータは tools/stage_from_image.py が作る（Assets/Art/Stage/&lt;名前&gt;/: background.png・occlusion.png・stage.json）。
    /// ・カメラ: 絵の消失点をカメラの中心にした射影（柱が縦にまっすぐな絵は、水平のカメラで写す範囲をずらした撮り方）
    /// ・背景: 絵をそのまま画面いっぱいに描き、奥行きも書く（柱・燭台などの後ろに回るとキャラが隠れる。床は隠さない）
    /// ・歩く: 歩ける所の高さの表（床・階段）の上を、押した所まで道を探して歩く
    /// ・光: 場面の主な光で2段の塗り、影の色は足元のまわりの背景の色
    /// VRM は再配布禁止の物もあるので Assets/LocalOnly/（Git に入らない）から読む。本編・Web版にはまだつないでいない
    /// </summary>
    public class StageFromImage : MonoBehaviour
    {
        [Serializable] public class GridData { public float x0, z0, cell; public int nx, nz; public float[] height; public string walk; }
        [Serializable] public class LightData { public float[] position, color; public float power; }
        [Serializable] public class StageData { public string source; public int[] size; public float fovY; public int[] principal; public float cameraHeight; public float[] cameraForward, cameraUp; public float occlusionMax; public LightData[] lights; public GridData grid; }

        // 舞台は何枚でも（画面の上のボタンで切り替える）。同じ番号の stage.json・背景・奥行き
        [SerializeField] private TextAsset[] stageJsons = Array.Empty<TextAsset>();
        [SerializeField] private Texture2D[] backgrounds = Array.Empty<Texture2D>();
        [SerializeField] private Texture2D[] occlusions = Array.Empty<Texture2D>();
        [SerializeField] private string[] stageLabels = Array.Empty<string>();
        [SerializeField] private int stageIndex;
        [SerializeField] private float lightGain = 1f;      // 絵から拾った光の強さ（画面で変えられる）
        [SerializeField] private float ambientGain = 0.85f;    // 影の明るさ（足元のまわりの背景の色から）
        private Texture2D background;
        private GameObject backgroundObject;
        private Camera bandCamera;
        [SerializeField] private Shader backgroundShader;   // Srpg/StageBackground
        [SerializeField] private Shader toonShader;         // Srpg/StageToon
        [SerializeField] private Shader blobShader;         // Srpg/StageBlob
        [SerializeField] private Shader[] importShaders = Array.Empty<Shader>();   // VRM の読み込みが名前で探す Shader（書き出した版に入れるため持っておく）
        [SerializeField] private Camera targetCamera;
        [SerializeField] private Light keyLight;
        [SerializeField] private string vrmPath = "LocalOnly/VRM/Alsche_Proxy_StageTest.vrm";   // Assets からの場所
        [SerializeField] private float characterHeight = 1.4f;   // キャラの背の高さ（m）。画面で変えられる
        [SerializeField] private float walkSpeed = 1.3f;
        [SerializeField] private Color rimColor = new Color(1f, 0.82f, 0.62f, 0.35f);

        public StageData Data { get; private set; }
        public Transform Character { get; private set; }
        public Vector3 Position => Character != null ? Character.position : Vector3.zero;
        private bool[] walkable;
        private Animator animator;
        private Transform blob;
        private readonly List<Vector3> path = new List<Vector3>();
        private float gaitPhase, gaitAmount;
        private readonly Dictionary<HumanBodyBones, Quaternion> rest = new Dictionary<HumanBodyBones, Quaternion>();
        private float modelHeight = 1f;

        private void Start()
        {
            Build();
            LoadCharacter();
        }

        // ── 舞台 ──

        public int StageCount => stageJsons.Length;
        public int StageIndex => stageIndex;

        /// <summary>舞台を切り替える（キャラは新しい舞台の手前の真ん中へ）</summary>
        public void SwitchStage(int index)
        {
            stageIndex = Mathf.Clamp(index, 0, stageJsons.Length - 1);
            Build();
            if (Character != null) PlaceAt(StartPoint(), 180f);
        }

        public void Build()
        {
            Data = JsonUtility.FromJson<StageData>(stageJsons[stageIndex].text);
            background = backgrounds[stageIndex];
            if (backgroundObject != null) DestroyImmediate(backgroundObject);
            var g = Data.grid;
            walkable = new bool[g.nx * g.nz];
            for (int i = 0; i < walkable.Length; i++) walkable[i] = g.walk[i] == '1';

            // カメラ: (0, 高さ, 0) から、床に合わせた向き
            targetCamera.transform.SetPositionAndRotation(new Vector3(0f, Data.cameraHeight, 0f),
                Quaternion.LookRotation(V(Data.cameraForward), V(Data.cameraUp)));
            FitViewport();
            targetCamera.clearFlags = CameraClearFlags.SolidColor;
            targetCamera.backgroundColor = new Color(0.04f, 0.035f, 0.05f);
            // 絵の外（上下・左右の帯）を塗るカメラ。絵のカメラは自分の枠の中しか消さないので
            if (bandCamera == null)
            {
                bandCamera = new GameObject("BandCamera").AddComponent<Camera>();
                bandCamera.transform.SetParent(transform, false);
                bandCamera.cullingMask = 0;
                bandCamera.depth = targetCamera.depth - 1;
                bandCamera.clearFlags = CameraClearFlags.SolidColor;
                bandCamera.backgroundColor = targetCamera.backgroundColor;
            }
            bandCamera.targetTexture = targetCamera.targetTexture;

            // 背景（画面いっぱいの三角形。頂点の位置は使わないので、見切れないよう大きな箱にする）
            var bg = backgroundObject = new GameObject("StageBackground");
            bg.transform.SetParent(transform, false);
            var mesh = new Mesh { name = "Fullscreen", vertices = new Vector3[3], triangles = new[] { 0, 1, 2 } };
            mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 100000f);
            bg.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mat = new Material(backgroundShader) { name = "StageBackground" };
            mat.SetTexture("_MainTex", background);
            mat.SetTexture("_Occlusion", occlusions[stageIndex]);
            mat.SetFloat("_OcclusionMax", Data.occlusionMax);
            var mr = bg.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            Shader.SetGlobalColor("_StageRim", rimColor);
            Shader.SetGlobalFloat("_StageShadeStep", 0.45f);
            Shader.SetGlobalColor("_StageAmbient", new Color(0.32f, 0.27f, 0.38f));
        }

        private static Vector3 V(float[] a) => new Vector3(a[0], a[1], a[2]);

        /// <summary>絵と同じ縦横の比で画面に入れ（余りは黒い帯）、絵と同じ射影にする</summary>
        public void FitViewport()
        {
            float imageAspect = (float)Data.size[0] / Data.size[1];
            float screenAspect = (float)Screen.width / Mathf.Max(1, Screen.height);
            if (targetCamera.targetTexture != null) screenAspect = (float)targetCamera.targetTexture.width / targetCamera.targetTexture.height;
            targetCamera.rect = screenAspect > imageAspect
                ? new Rect((1f - imageAspect / screenAspect) / 2f, 0f, imageAspect / screenAspect, 1f)
                : new Rect(0f, (1f - screenAspect / imageAspect) / 2f, 1f, screenAspect / imageAspect);
            float w = Data.size[0], h = Data.size[1];
            float f = h / 2f / Mathf.Tan(Data.fovY * Mathf.Deg2Rad / 2f);
            float cx = Data.principal[0], cy = Data.principal[1], near = 0.05f, far = 200f;
            var m = Matrix4x4.zero;
            m[0, 0] = 2f * f / w; m[0, 2] = -(2f * cx / w - 1f);
            m[1, 1] = 2f * f / h; m[1, 2] = -(1f - 2f * cy / h);
            m[2, 2] = -(far + near) / (far - near); m[2, 3] = -2f * far * near / (far - near);
            m[3, 2] = -1f;
            targetCamera.projectionMatrix = m;
        }

        // ── 歩ける所 ──

        private bool Cell(Vector3 p, out int ix, out int iz)
        {
            var g = Data.grid;
            ix = Mathf.FloorToInt((p.x - g.x0) / g.cell); iz = Mathf.FloorToInt((p.z - g.z0) / g.cell);
            return ix >= 0 && iz >= 0 && ix < g.nx && iz < g.nz;
        }

        public bool IsWalkable(Vector3 p) => Cell(p, out int ix, out int iz) && walkable[iz * Data.grid.nx + ix];

        /// <summary>その場所の床の高さ（マスの間はなめらかに）</summary>
        public float HeightAt(Vector3 p)
        {
            var g = Data.grid;
            float fx = Mathf.Clamp((p.x - g.x0) / g.cell - 0.5f, 0, g.nx - 1.001f), fz = Mathf.Clamp((p.z - g.z0) / g.cell - 0.5f, 0, g.nz - 1.001f);
            int x = (int)fx, z = (int)fz; float tx = fx - x, tz = fz - z;
            float H(int a, int b) => g.height[Mathf.Min(b, g.nz - 1) * g.nx + Mathf.Min(a, g.nx - 1)];
            return Mathf.Lerp(Mathf.Lerp(H(x, z), H(x + 1, z), tx), Mathf.Lerp(H(x, z + 1), H(x + 1, z + 1), tx), tz);
        }

        /// <summary>画面の点から、歩ける所の床に当たる所（光線を少しずつ進め、床の高さより下に入った所）</summary>
        public bool RayToGround(Ray ray, out Vector3 hit)
        {
            for (float t = 0.3f; t < 40f; t += 0.03f)
            {
                var p = ray.GetPoint(t);
                if (!Cell(p, out _, out _)) continue;
                if (p.y <= HeightAt(p)) { hit = new Vector3(p.x, HeightAt(p), p.z); return IsWalkable(hit); }
            }
            hit = default; return false;
        }

        /// <summary>歩ける所のマスをたどる道（8方向。段差は表を作るときに見てある）</summary>
        public List<Vector3> FindPath(Vector3 from, Vector3 to)
        {
            var result = new List<Vector3>();
            var g = Data.grid;
            if (!Cell(from, out int sx, out int sz) || !Cell(to, out int tx, out int tz) || !walkable[tz * g.nx + tx]) return result;
            if (!walkable[sz * g.nx + sx]) { result.Add(to); return result; }
            int start = sz * g.nx + sx, goal = tz * g.nx + tx;
            var cost = new Dictionary<int, float> { [start] = 0 };
            var prev = new Dictionary<int, int>();
            var open = new SortedSet<(float, int)> { (0, start) };
            float Hh(int c) => Mathf.Sqrt(Sq(c % g.nx - tx) + Sq(c / g.nx - tz));
            while (open.Count > 0)
            {
                var (_, c) = open.Min; open.Remove(open.Min);
                if (c == goal) break;
                int cx = c % g.nx, cz = c / g.nx;
                for (int dz = -1; dz <= 1; dz++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dz == 0) continue;
                    int nx = cx + dx, nz = cz + dz;
                    if (nx < 0 || nz < 0 || nx >= g.nx || nz >= g.nz) continue;
                    int n = nz * g.nx + nx;
                    if (!walkable[n]) continue;
                    float step = (dx != 0 && dz != 0 ? 1.414f : 1f) + Mathf.Abs(g.height[n] - g.height[c]) * 5f;
                    float nc = cost[c] + step;
                    if (cost.TryGetValue(n, out float old) && old <= nc) continue;
                    if (cost.ContainsKey(n)) open.Remove((old + Hh(n), n));
                    cost[n] = nc; prev[n] = c; open.Add((nc + Hh(n), n));
                }
            }
            if (!cost.ContainsKey(goal)) return result;
            for (int c = goal; c != start; c = prev[c])
                result.Add(new Vector3(g.x0 + (c % g.nx + .5f) * g.cell, 0f, g.z0 + (c / g.nx + .5f) * g.cell));
            result.Reverse();
            // 間引く: 2マスおきに（なめらかに歩くため）。最後は押した所
            var thin = new List<Vector3>();
            for (int i = 2; i < result.Count - 1; i += 3) thin.Add(result[i]);
            thin.Add(to);
            return thin;
        }

        private static float Sq(float v) => v * v;

        // ── キャラ ──

        public Shader ToonShader { get => toonShader; set => toonShader = value; }

        public void LoadCharacter()
        {
            // エディタでは Assets/LocalOnly/、手元の試し版（ビルド）では StreamingAssets/ に同じ名前で置く
            string full = Path.Combine(Application.dataPath, vrmPath);
            if (!File.Exists(full)) full = Path.Combine(Application.streamingAssetsPath, Path.GetFileName(vrmPath));
            if (!File.Exists(full)) { Debug.LogWarning($"[Stage] VRM がない: {full}（Assets/LocalOnly/ に置く）"); return; }
            var bytes = File.ReadAllBytes(full);
            using var data = new UniGLTF.GlbBinaryParser(bytes, full).Parse();
            var vrm = new VRM.VRMData(data);
            using var context = new VRM.VRMImporterContext(vrm);
            var instance = UniGLTF.ImporterContextExtensions.Load(context);
            instance.EnableUpdateWhenOffscreen();
            instance.ShowMeshes();
            var root = instance.Root;
            root.name = "Character";
            root.transform.SetParent(transform, false);
            Character = root.transform;
            animator = root.GetComponent<Animator>();
            // 塗りを差し替え（UniUnlit と同じ項目なので、Shader を替えるだけ）
            foreach (var r in root.GetComponentsInChildren<Renderer>())
                foreach (var m in r.sharedMaterials)
                {
                    if (m == null || m.shader == null) continue;
                    Debug.Log($"[Stage] 材質 {m.name}: {m.shader.name} queue {m.renderQueue} keywords [{string.Join(",", m.shaderKeywords)}] blend {(m.HasProperty("_BlendMode") ? m.GetFloat("_BlendMode") : -1)}");
                    if (toonShader != null && m.shader.name.Contains("UniUnlit")) m.shader = toonShader;
                }
            // 休みの姿勢（T字）を覚え、腕を下ろす
            foreach (HumanBodyBones b in Enum.GetValues(typeof(HumanBodyBones)))
            {
                if (b == HumanBodyBones.LastBone) continue;
                var t = animator.GetBoneTransform(b);
                if (t != null) rest[b] = t.rotation;
            }
            var head = animator.GetBoneTransform(HumanBodyBones.Head);
            modelHeight = head != null ? (head.position.y - root.transform.position.y) * 1.12f : 1.5f;
            ApplyScale();
            // 足元の影
            blob = GameObject.CreatePrimitive(PrimitiveType.Quad).transform;
            DestroyImmediate(blob.GetComponent<Collider>());
            blob.name = "BlobShadow";
            blob.SetParent(transform, false);
            blob.GetComponent<Renderer>().sharedMaterial = new Material(blobShader) { name = "BlobShadow" };
            PlaceAt(StartPoint());
        }

        public float CharacterHeight { get => characterHeight; set { characterHeight = Mathf.Clamp(value, 0.6f, 2.4f); ApplyScale(); } }
        private void ApplyScale() { if (Character != null) Character.localScale = Vector3.one * (characterHeight / Mathf.Max(0.1f, modelHeight)); }

        /// <summary>最初に立つ所: 歩ける所のうち、手前の真ん中</summary>
        public Vector3 StartPoint()
        {
            var g = Data.grid;
            for (int z = g.nz / 8; z < g.nz; z++)
            {
                int x = g.nx / 2;
                if (walkable[z * g.nx + x]) return new Vector3(g.x0 + (x + .5f) * g.cell, 0, g.z0 + (z + .5f) * g.cell);
            }
            return Vector3.forward * 4f;
        }

        public void PlaceAt(Vector3 p, float yawDeg = 180f)
        {
            if (Character == null) return;
            p.y = HeightAt(p);
            Character.SetPositionAndRotation(p, Quaternion.Euler(0, yawDeg, 0));
            path.Clear();
            Pose(0f, 0f);
            UpdateBlobAndLight();
        }

        public void WalkTo(Vector3 target) { if (Character != null) { path.Clear(); path.AddRange(FindPath(Character.position, target)); } }
        public bool Walking => path.Count > 0;

        private void Update()
        {
            if (Character == null) return;
            FitViewport();
            var pointer = Pointer.current;
            if (pointer != null && pointer.press.wasPressedThisFrame && !InToolbar(pointer.position.ReadValue()))
            {
                var pos = pointer.position.ReadValue();
                if (RayToGround(targetCamera.ScreenPointToRay(pos), out var hit)) WalkTo(hit);
            }
            Step(Time.deltaTime);
        }

        /// <summary>1フレーム分歩く（テスト・確認の画像からも呼ぶ）</summary>
        public void Step(float dt)
        {
            float speed = 0f;
            if (path.Count > 0)
            {
                var p = Character.position;
                var target = path[0]; target.y = p.y;
                var to = target - p;
                float scale = characterHeight / 1.4f;
                float move = walkSpeed * scale * dt;
                if (to.magnitude <= move) { path.RemoveAt(0); p = target; }
                else p += to.normalized * move;
                p.y = HeightAt(p);
                if (to.sqrMagnitude > 1e-6f)
                    Character.rotation = Quaternion.Slerp(Character.rotation, Quaternion.LookRotation(new Vector3(to.x, 0, to.z)), 1f - Mathf.Exp(-10f * dt));
                Character.position = p;
                speed = walkSpeed;
            }
            gaitAmount = Mathf.MoveTowards(gaitAmount, speed > 0 ? 1f : 0f, dt * 5f);
            gaitPhase += dt * 2f * Mathf.PI * 1.6f * gaitAmount;
            Pose(gaitPhase, gaitAmount);
            UpdateBlobAndLight();
        }

        /// <summary>仮の歩き方（手足を振るだけ。本番は Mixamo などの人型の動きに替える）</summary>
        private void Pose(float phase, float amount)
        {
            if (animator == null) return;
            var right = Character.right; var fwd = Character.forward;
            float s = Mathf.Sin(phase) * amount;
            void Set(HumanBodyBones b, Quaternion delta)
            {
                var t = animator.GetBoneTransform(b);
                if (t != null && rest.TryGetValue(b, out var r)) t.rotation = delta * Character.rotation * r;
            }
            var parentYaw = Character.rotation;
            Quaternion R(float deg, Vector3 axis) => Quaternion.AngleAxis(deg, axis);
            // 休みの姿勢は「向き 0」で覚えているので、いまの向きをかけて戻す（Set の中）。腕は体の横へ下ろす
            Set(HumanBodyBones.LeftUpperArm, R(72f, fwd) * R(-28f * s, right));
            Set(HumanBodyBones.RightUpperArm, R(-72f, fwd) * R(28f * s, right));
            Set(HumanBodyBones.LeftLowerArm, R(72f, fwd) * R(-28f * s - 12f * amount, right));
            Set(HumanBodyBones.RightLowerArm, R(-72f, fwd) * R(28f * s - 12f * amount, right));
            Set(HumanBodyBones.LeftUpperLeg, R(32f * s, right));
            Set(HumanBodyBones.RightUpperLeg, R(-32f * s, right));
            Set(HumanBodyBones.LeftLowerLeg, R(32f * s + 30f * Mathf.Max(0, -Mathf.Cos(phase)) * amount, right));
            Set(HumanBodyBones.RightLowerLeg, R(-32f * s + 30f * Mathf.Max(0, Mathf.Cos(phase)) * amount, right));
            var hips = animator.GetBoneTransform(HumanBodyBones.Hips);
            if (hips != null) hips.localPosition = new Vector3(hips.localPosition.x, hips.localPosition.y, hips.localPosition.z);
        }

        /// <summary>
        /// 足元の影を床に合わせ、光を決める（原作者 2026-10-07: 背景になじませる仕組み。どの背景でも同じ）。
        /// ・主な光: 絵から拾った光（燭台・窓など）を、キャラの胸の高さで近い順に足し合わせた向きと色。近くを通ると、その光で照らされる
        /// ・縁の光: キャラより奥（カメラから見て向こう）にある光の色
        /// ・影の色: 足元のまわりの背景の色
        /// </summary>
        private void UpdateBlobAndLight()
        {
            UpdateSceneLight();
            var p = Character.position;
            float r = characterHeight * 0.32f;
            blob.position = p + Vector3.up * 0.01f;
            blob.rotation = Quaternion.Euler(90, 0, 0);
            blob.localScale = new Vector3(r * 1.4f, r, 1f);
            if (background != null && background.isReadable)
            {
                var sp = targetCamera.WorldToViewportPoint(p + Vector3.up * characterHeight * 0.5f);
                var c = new Color(0, 0, 0); int n = 0;
                for (int dy = -3; dy <= 3; dy++)
                for (int dx = -3; dx <= 3; dx++)
                {
                    c += background.GetPixelBilinear(Mathf.Clamp01(sp.x + dx * 0.025f), Mathf.Clamp01(sp.y + dy * 0.03f)); n++;
                }
                c /= n;
                // 暗い背景の色を少し持ち上げて影の色に（真っ黒にしない）
                var amb = Color.Lerp(new Color(0.16f, 0.14f, 0.2f), c * 1.25f, 0.6f) * ambientGain;
                Shader.SetGlobalColor("_StageAmbient", amb);
            }
        }

        public float LightGain { get => lightGain; set => lightGain = Mathf.Clamp(value, 0f, 3f); }
        public float AmbientGain { get => ambientGain; set => ambientGain = Mathf.Clamp(value, 0f, 3f); }

        private void UpdateSceneLight()
        {
            if (keyLight == null || Character == null) return;
            var chest = Character.position + Vector3.up * characterHeight * 0.6f;
            var dir = Vector3.zero; var key = new Color(0, 0, 0); var rim = new Color(0, 0, 0);
            var camFwd = targetCamera.transform.forward;
            foreach (var l in Data.lights ?? Array.Empty<LightData>())
            {
                var to = V(l.position) - chest;
                float d = to.magnitude;
                float att = l.power / (1f + d * d / 4f);          // 2 m で半分くらい
                var c = new Color(l.color[0], l.color[1], l.color[2]) * att;
                dir += -to.normalized * c.grayscale;
                key += c;
                rim += c * Mathf.Clamp01(Vector3.Dot(to.normalized, camFwd));   // キャラより奥の光ほど縁に
            }
            float k = Mathf.Max(key.r, key.g, key.b);
            if (k > 1e-4f && dir.sqrMagnitude > 1e-6f)
            {
                keyLight.transform.rotation = Quaternion.LookRotation(dir.normalized);
                keyLight.color = key / k;
                keyLight.intensity = Mathf.Clamp(k * 0.12f, 0f, 0.9f) * lightGain;
            }
            float r = Mathf.Max(rim.r, rim.g, rim.b);
            Shader.SetGlobalColor("_StageRim", r > 1e-4f ? new Color(rim.r / r, rim.g / r, rim.b / r, Mathf.Clamp01(r * 0.25f) * lightGain) : new Color(0, 0, 0, 0));
        }

        // ── 画面の操作（舞台の切り替え・キャラの大きさ・光） ──
        private const int PanelW = 440, PanelH = 150;
        private bool InToolbar(Vector2 screen) => screen.y > Screen.height - PanelH - 10 && screen.x < PanelW + 10;   // 入力の座標は下が 0

        private GUIStyle[] styles;

        private void OnGUI()
        {
            // 書き出した版でも日本語が出るよう、Windows の字を使う
            if (styles == null)
            {
                var font = Font.CreateDynamicFontFromOSFont(new[] { "Yu Gothic UI", "Meiryo UI", "MS UI Gothic" }, 14);
                styles = new[] { GUI.skin.label, GUI.skin.button, GUI.skin.box };
                foreach (var st in styles) st.font = font;
            }
            GUILayout.BeginArea(new Rect(8, 8, PanelW, PanelH), GUI.skin.box);
            GUILayout.Label("床を押すと、そこまで歩きます（試作・手元だけ）");
            GUILayout.BeginHorizontal();
            for (int i = 0; i < stageJsons.Length; i++)
            {
                string label = i < stageLabels.Length ? stageLabels[i] : stageJsons[i].name;
                if (GUILayout.Toggle(i == stageIndex, label, GUI.skin.button) && i != stageIndex) SwitchStage(i);
            }
            GUILayout.EndHorizontal();
            void Slider(string label, float value, float min, float max, Action<float> set)
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label(label, GUILayout.Width(180));
                set(GUILayout.HorizontalSlider(value, min, max, GUILayout.Width(230)));
                GUILayout.EndHorizontal();
            }
            Slider($"キャラの背の高さ {characterHeight:0.00} m", characterHeight, 0.8f, 2.2f, v => CharacterHeight = v);
            Slider($"光の強さ {lightGain:0.00}", lightGain, 0f, 3f, v => LightGain = v);
            Slider($"影の明るさ {ambientGain:0.00}", ambientGain, 0f, 3f, v => AmbientGain = v);
            GUILayout.EndArea();
        }
    }
}

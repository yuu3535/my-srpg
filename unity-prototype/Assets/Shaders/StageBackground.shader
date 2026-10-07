// 2Dの背景の絵を、奥行きつきで画面いっぱいに描く（背景を舞台にする試作。2026-10-07）。
// 色は絵そのまま。奥行きは tools/stage_from_image.py の occlusion.png（床は奥へ押しやってあり、柱・燭台などだけがキャラを隠す）。
// 頂点は画面いっぱいの三角形（変換を使わない）。奥行きはカメラの射影でそのまま深度に直す
Shader "Srpg/StageBackground"
{
    Properties
    {
        _MainTex ("背景", 2D) = "white" {}
        _Occlusion ("奥行き（0〜1）", 2D) = "white" {}
        _OcclusionMax ("奥行きの最大（m）", Float) = 20
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Background" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Name "StageBackground"
            Tags { "LightMode"="UniversalForward" }
            ZWrite On
            ZTest Always
            Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex); SAMPLER(sampler_MainTex);
            TEXTURE2D(_Occlusion); SAMPLER(sampler_Occlusion);
            float _OcclusionMax;

            struct Attributes { uint vertexID : SV_VertexID; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes input)
            {
                Varyings o;
                float2 uv = float2((input.vertexID << 1) & 2, input.vertexID & 2);
                o.positionCS = float4(uv * 2 - 1, 0.5, 1);
                o.positionCS.y *= _ProjectionParams.x;   // 上下が逆になる環境に合わせる
                o.uv = uv;
                return o;
            }

            half4 frag(Varyings input, out float depth : SV_Depth) : SV_Target
            {
                float z = SAMPLE_TEXTURE2D(_Occlusion, sampler_Occlusion, input.uv).r * _OcclusionMax;   // カメラの前方向の距離（m）
                float4 clip = mul(UNITY_MATRIX_P, float4(0, 0, -z, 1));
                depth = clip.z / clip.w;
                return SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, input.uv);
            }
            ENDHLSL
        }
    }
}

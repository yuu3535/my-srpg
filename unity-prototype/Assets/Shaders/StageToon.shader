// 背景の舞台に立つ VRM の塗り（試作。2026-10-07）。UniGLTF/UniUnlit と同じ名前の項目を持つので、読み込んだ材質の Shader を差し替えるだけで使える。
// 光: 場面の主な光（向き・色）を2段のアニメ塗りで、影の色は背景からとった環境の色（_StageAmbient。足元のまわりの背景の色）。縁に光（リム）
Shader "Srpg/StageToon"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Main Color", COLOR) = (1,1,1,1)
        _Cutoff ("Alpha Cutoff", Range(0, 1)) = 0.5
        [HideInInspector] _BlendMode ("_BlendMode", Float) = 0.0
        [HideInInspector] _CullMode ("_CullMode", Float) = 2.0
        [HideInInspector] _VColBlendMode ("_VColBlendMode", Float) = 0.0
        [HideInInspector] _SrcBlend ("_SrcBlend", Float) = 1.0
        [HideInInspector] _DstBlend ("_DstBlend", Float) = 0.0
        [HideInInspector] _ZWrite ("_ZWrite", Float) = 1.0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Cull [_CullMode]
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_MainTex); SAMPLER(sampler_MainTex);
            CBUFFER_START(UnityPerMaterial)
            float4 _MainTex_ST; half4 _Color; half _Cutoff; half _BlendMode;
            CBUFFER_END
            half4 _StageAmbient;      // 影の色（背景からとる）
            half4 _StageRim;          // 縁の光の色（a＝強さ）
            half _StageShadeStep;     // 光と影の境目

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float3 normalWS : TEXCOORD1; float3 viewWS : TEXCOORD2; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(ws);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.viewWS = GetWorldSpaceViewDir(ws);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half4 c = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv) * _Color;
                // 抜き・半透明は材質の設定値で（_BlendMode: 0 不透明・1 抜き・2 半透明。UniUnlit と同じ）
                if (_BlendMode > 0.5 && _BlendMode < 1.5) clip(c.a - _Cutoff);
                Light light = GetMainLight();
                float3 n = normalize(i.normalWS), v = normalize(i.viewWS);
                half ndl = dot(n, light.direction) * 0.5 + 0.5;
                half lit = smoothstep(_StageShadeStep - 0.04, _StageShadeStep + 0.04, ndl);
                half3 shade = lerp(_StageAmbient.rgb, _StageAmbient.rgb + light.color, lit);
                half rim = pow(saturate(1 - dot(n, v)), 3) * _StageRim.a;
                half3 rgb = c.rgb * shade + _StageRim.rgb * rim;
                if (_BlendMode < 1.5) c.a = 1;
                return half4(rgb, c.a);
            }
            ENDHLSL
        }
    }
}

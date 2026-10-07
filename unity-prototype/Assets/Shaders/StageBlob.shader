// 足元の丸い影（背景の舞台の試作。2026-10-07）。真ん中ほど濃い、ぼんやりした楕円
Shader "Srpg/StageBlob"
{
    Properties { _Color ("影の色", Color) = (0.05, 0.03, 0.08, 0.55) }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent-10" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            half4 _Color;
            struct A { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct V { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };
            V vert(A a) { V o; o.positionCS = TransformObjectToHClip(a.positionOS.xyz); o.uv = a.uv; return o; }
            half4 frag(V i) : SV_Target
            {
                float r = length(i.uv * 2 - 1);
                return half4(_Color.rgb, _Color.a * saturate(1 - r) * saturate(1 - r));
            }
            ENDHLSL
        }
    }
}

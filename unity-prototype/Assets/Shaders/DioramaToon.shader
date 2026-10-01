// 箱庭の塗り（SDの絵に合わせる。原作者 2026-10-01「背景もSDの絵に合わせる」の 1）。
// 平たい色＋影は2段（明るい面・影・濃い影）。影の色は紫に寄せる（_ToonShadeTint。時間帯で Board3DView が変える）。
// 灯りの光も段で当てる（なめらかなグラデーションにしない）。
// 半透明の写し（Board3DView.Occlusion）のため、URP の Lit と同じ名前の _Surface・_SrcBlend・_DstBlend・_ZWrite を持つ。
Shader "Srpg/DioramaToon"
{
    Properties
    {
        [MainTexture] _BaseMap ("模様", 2D) = "white" {}
        [MainColor] _BaseColor ("色", Color) = (1, 1, 1, 1)
        [HDR] _EmissionColor ("自分の光", Color) = (0, 0, 0, 1)
        _Cutoff ("切り抜き", Range(0, 1)) = 0.5
        [HideInInspector] _Surface ("半透明", Float) = 0
        [HideInInspector] _SrcBlend ("", Float) = 1
        [HideInInspector] _DstBlend ("", Float) = 0
        [HideInInspector] _SrcBlendAlpha ("", Float) = 1
        [HideInInspector] _DstBlendAlpha ("", Float) = 0
        [HideInInspector] _ZWrite ("", Float) = 1
        [HideInInspector] _Cull ("", Float) = 2
    }

    HLSLINCLUDE
    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

    CBUFFER_START(UnityPerMaterial)
        float4 _BaseMap_ST;
        half4 _BaseColor;
        half4 _EmissionColor;
        half _Cutoff;
        half _Surface;
    CBUFFER_END

    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/SurfaceInput.hlsl"
    ENDHLSL

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend], [_SrcBlendAlpha] [_DstBlendAlpha]
            ZWrite [_ZWrite]
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile _ _FORWARD_PLUS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fog
            #pragma shader_feature_local_fragment _SURFACE_TYPE_TRANSPARENT
            #pragma shader_feature_local_fragment _EMISSION

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            half4 _ToonShadeTint;   // 影の色合い（紫寄り）。0 のときは既定の色

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float3 normalWS : TEXCOORD2;
                half fog : TEXCOORD3;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            Varyings Vert(Attributes input)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, o);
                VertexPositionInputs p = GetVertexPositionInputs(input.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                o.uv = TRANSFORM_TEX(input.uv, _BaseMap);
                o.fog = ComputeFogFactor(p.positionCS.z);
                return o;
            }

            // 0〜1 の光の量を、3段（濃い影・影・明るい面）にする。段の境はほんの少しだけぼかす
            half Steps(half t)
            {
                half a = smoothstep(0.04, 0.09, t);
                half b = smoothstep(0.32, 0.38, t);
                return a * 0.5 + b * 0.5;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                half4 tex = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv);
                half3 albedo = tex.rgb * _BaseColor.rgb;
                half alpha = tex.a * _BaseColor.a;

                float3 n = normalize(input.normalWS);
                float4 shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                Light main = GetMainLight(shadowCoord);

                half3 tint = _ToonShadeTint.a > 0 ? _ToonShadeTint.rgb : half3(0.72, 0.64, 0.92);
                // 周りの光は向きで変えない（上からの1色。グラデーションを作らない）
                half3 ambient = SampleSH(half3(0, 1, 0));

                half ndl = saturate(dot(n, main.direction));
                half t = ndl * main.shadowAttenuation;
                half s = Steps(t);
                half3 deep = (ambient * 0.8 + main.color * 0.08) * tint * 0.85;
                half3 shade = (ambient * 0.8 + main.color * 0.26) * tint;
                half3 lit = ambient * 0.8 + main.color * 0.72;
                half3 light = s < 0.5 ? lerp(deep, shade, s * 2.0) : lerp(shade, lit, s * 2.0 - 1.0);

                #if defined(_SCREEN_SPACE_OCCLUSION)
                    AmbientOcclusionFactor ao = GetScreenSpaceAmbientOcclusion(GetNormalizedScreenSpaceUV(input.positionCS));
                    light *= lerp(1.0, ao.directAmbientOcclusion, 0.8);
                #endif

                // 灯り（点の光）: 届く量を2段にして足す
                #if defined(_ADDITIONAL_LIGHTS)
                    InputData inputData = (InputData)0;
                    inputData.positionWS = input.positionWS;
                    inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(input.positionCS);
                    uint count = GetAdditionalLightsCount();
                    LIGHT_LOOP_BEGIN(count)
                        Light add = GetAdditionalLight(lightIndex, input.positionWS, half4(1, 1, 1, 1));
                        half amount = add.distanceAttenuation * saturate(dot(n, add.direction) * 0.6 + 0.4);
                        half stepped = smoothstep(0.03, 0.06, amount) * 0.45 + smoothstep(0.22, 0.27, amount) * 0.55;
                        light += add.color * stepped * 0.6;
                    LIGHT_LOOP_END
                #endif

                half3 col = albedo * light;
                #if defined(_EMISSION)
                    col += _EmissionColor.rgb;
                #endif
                col = MixFog(col, input.fog);
                #if defined(_SURFACE_TYPE_TRANSPARENT)
                    return half4(col, alpha);
                #else
                    return half4(col, 1.0);
                #endif
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0 Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex ShadowPassVertex
            #pragma fragment ShadowPassFragment
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/Shaders/ShadowCasterPass.hlsl"
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On ColorMask R Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex DepthOnlyVertex
            #pragma fragment DepthOnlyFragment
            #include "Packages/com.unity.render-pipelines.universal/Shaders/DepthOnlyPass.hlsl"
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex DepthNormalsVertex
            #pragma fragment DepthNormalsFragment
            #include "Packages/com.unity.render-pipelines.universal/Shaders/DepthNormalsPass.hlsl"
            ENDHLSL
        }
    }
}

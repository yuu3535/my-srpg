// 箱庭の画面の仕上げ（段A。原作者 2026-10-01）: 線画の輪郭・画面の上下のぼかし（ミニチュア風）・色調・四隅の暗さ。
// 盤面の不透明な物を描いたあと、キャラの絵・範囲の色・UI を描く前にかける（Renderer3D の FullScreenPassRendererFeature。
// 半透明の物は描く前なので、キャラ・範囲・UI はくっきりしたまま）。
// _DioramaFX（0〜1。Board3DView が箱庭の場所で 1 にする）が 0 のときは何もしない。
Shader "Srpg/DioramaComposite"
{
    SubShader
    {
        Tags { "RenderPipeline" = "UniversalPipeline" }
        ZWrite Off ZTest Always Blend Off Cull Off

        Pass
        {
            Name "DioramaComposite"

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareNormalsTexture.hlsl"

            float _DioramaFX;            // 全体の強さ（0 で何もしない）
            float4 _DioramaLineColor;    // 線の色（濃い紫）
            float4 _DioramaShadowTint;   // 暗い所の色合い
            float4 _DioramaLightTint;    // 明るい所の色合い
            float _DioramaLineWidth;     // 線の太さの倍率（0 のときは 1）

            // 正投影のカメラの深さ（カメラからの距離）
            float EyeDepth(float2 uv)
            {
                float raw = SampleSceneDepth(uv);
                #if UNITY_REVERSED_Z
                    raw = 1.0 - raw;
                #endif
                return lerp(_ProjectionParams.y, _ProjectionParams.z, raw);
            }

            half3 Color(float2 uv)
            {
                return SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv).rgb;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                float2 uv = input.texcoord;
                half3 col = Color(uv);
                if (_DioramaFX <= 0.0) return half4(col, 1.0);

                float2 texel = 1.0 / _ScreenParams.xy;
                float scale = max(1.0, _ScreenParams.y / 540.0);   // 画面が大きいほど線を太く

                // ── 画面の上下のぼかし（ミニチュア写真のような。真ん中の帯はくっきり） ──
                float band = saturate((abs(uv.y - 0.47) - 0.22) / 0.28);
                if (band > 0.0)
                {
                    float r = band * 2.6 * scale;
                    half3 sum = col;
                    sum += Color(uv + texel * float2(r, 0));
                    sum += Color(uv + texel * float2(-r, 0));
                    sum += Color(uv + texel * float2(0, r));
                    sum += Color(uv + texel * float2(0, -r));
                    sum += Color(uv + texel * float2(r, r) * 0.7);
                    sum += Color(uv + texel * float2(-r, r) * 0.7);
                    sum += Color(uv + texel * float2(r, -r) * 0.7);
                    sum += Color(uv + texel * float2(-r, -r) * 0.7);
                    col = sum / 9.0;
                }

                // ── 線画の輪郭（深さの段差・面の向きの違い）。ぼかした所は弱く ──
                float d0 = EyeDepth(uv);
                float3 n0 = SampleSceneNormals(uv);
                float edge = 0.0;
                float2 offs[4] = { float2(1, 0), float2(-1, 0), float2(0, 1), float2(0, -1) };
                [unroll] for (int i = 0; i < 4; i++)
                {
                    float2 o = offs[i] * texel * scale * max(_DioramaLineWidth, 1.0);
                    float d1 = EyeDepth(uv + o);
                    float3 n1 = SampleSceneNormals(uv + o);
                    // 手前の物のふちにだけ線（奥の側には描かない）
                    float step = d1 - d0;
                    edge = max(edge, saturate((step - 0.3) * 3.0));   // 0.3マス以上の段差だけ
                    edge = max(edge, saturate((1.0 - dot(n0, n1) - 0.55) * 2.0) * (d0 < _ProjectionParams.z * 0.98 ? 1.0 : 0.0));   // 60度より強い折れ目だけ
                }
                edge *= (1.0 - band * 0.7);
                col = lerp(col, _DioramaLineColor.rgb, edge * _DioramaLineColor.a);

                // ── 色調: 少しだけ硬く、暗い所は紫に、明るい所は温かく ──
                half lum = dot(col, half3(0.299, 0.587, 0.114));
                half3 graded = (col - 0.5) * 1.06 + 0.5;
                graded *= lerp(_DioramaShadowTint.rgb, _DioramaLightTint.rgb, smoothstep(0.15, 0.75, lum));

                // ── 四隅の暗さ（黒紫へ） ──
                float2 v = (uv - 0.5) * float2(1.25, 1.0);
                float vig = smoothstep(0.42, 0.9, length(v));
                graded = lerp(graded, graded * half3(0.62, 0.55, 0.72), vig);

                return half4(lerp(col, max(graded, 0.0), _DioramaFX), 1.0);
            }
            ENDHLSL
        }
    }
}

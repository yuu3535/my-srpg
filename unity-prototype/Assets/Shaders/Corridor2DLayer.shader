// 2Dの横スクロールの層の絵（UI の RawImage）に、見え方の効果をかける（2026-10-04。docs/10-design/map/SIDE_SCROLL_2D_LOOK_PRESETS_2026-10-04.md）。
// 調整ページ（debug/corridor_layers.html）と同じ計算を、ブラウザと同じ sRGB の値で行う:
//   層ごと: 霞（霞の色へ寄せる）・ぼかし（13点で平均）・なじませ（キャラ）・明るさ（キャラ）
//   画面全体（Shader.SetGlobal…）: 色温度（ソフトライト）→ オーバーレイ（上下2色・重ね方）→ 明るさ・コントラスト・彩度
// 会話の枠などほかの UI には使わない（台詞が読みにくくならないように）
Shader "Srpg/Corridor2DLayer"
{
    Properties
    {
        [PerRendererData] _MainTex ("Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _HazeColor ("Haze color", Color) = (0.66,0.72,0.91,1)
        _Haze ("Haze", Range(0,1)) = 0
        _MixColor ("Blend toward color", Color) = (0.23,0.29,0.48,1)
        _Mix ("Blend amount", Range(0,1)) = 0
        _Bright ("Brightness", Float) = 1
        _BlurUV ("Blur radius in uv", Vector) = (0,0,0,0)
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "PreviewType"="Plane" "CanUseSpriteAtlas"="True" }
        Cull Off
        Lighting Off
        ZWrite Off
        ZTest [unity_GUIZTestMode]
        Blend SrcAlpha OneMinusSrcAlpha

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata { float4 vertex : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; };
            struct v2f { float4 pos : SV_POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; float4 screen : TEXCOORD1; };

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color, _HazeColor, _MixColor;
            float _Haze, _Mix, _Bright;
            float4 _BlurUV;

            // 画面全体（Corridor2DView が Shader.SetGlobal… で入れる）
            float _CgOn, _CgBright, _CgContrast, _CgSaturate, _CgTemp, _CgOvl, _CgOvlMode;
            float4 _CgTempColor, _CgOvlTop, _CgOvlBottom;

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.color = v.color * _Color;
                o.screen = ComputeScreenPos(o.pos);
                return o;
            }

            float3 ToGamma(float3 c)
            {
            #ifdef UNITY_COLORSPACE_GAMMA
                return c;
            #else
                return LinearToGammaSpace(c);
            #endif
            }
            float3 ToLinear(float3 c)
            {
            #ifdef UNITY_COLORSPACE_GAMMA
                return c;
            #else
                return GammaToLinearSpace(c);
            #endif
            }

            // ブラウザの mix-blend-mode と同じ式（b＝下の色、s＝重ねる色）
            float3 SoftLight(float3 b, float3 s)
            {
                float3 d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : sqrt(b);
                return s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (d - b);
            }
            float3 Overlay(float3 b, float3 s) { return b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s); }
            float Lum(float3 c) { return dot(c, float3(0.3, 0.59, 0.11)); }
            float3 Blend(float3 b, float3 s, float mode)
            {
                if (mode < 0.5) return Overlay(b, s);                       // 0 オーバーレイ
                if (mode < 1.5) return SoftLight(b, s);                     // 1 ソフトライト
                if (mode < 2.5) return 1 - (1 - b) * (1 - s);               // 2 スクリーン
                if (mode < 3.5) return min(1, b + s);                       // 3 加算（発光）
                if (mode < 4.5) return b * s;                               // 4 乗算
                if (mode < 5.5) return saturate(s + (Lum(b) - Lum(s)));     // 5 カラー（明るさは下の色）
                if (mode < 6.5) return Overlay(s, b);                       // 6 ハードライト
                return s >= 1 ? 1 : min(1, b / max(1e-4, 1 - s));           // 7 覆い焼き
            }

            fixed4 Sample(float2 uv)
            {
                if (_BlurUV.x <= 0 && _BlurUV.y <= 0) return tex2D(_MainTex, uv);
                // 13点（真ん中・半分の距離の4点・外の8点）
                float2 r = _BlurUV.xy, h = r * 0.5, d = r * 0.7071;
                fixed4 c = tex2D(_MainTex, uv) * 0.16;
                c += (tex2D(_MainTex, uv + float2(h.x, 0)) + tex2D(_MainTex, uv - float2(h.x, 0)) + tex2D(_MainTex, uv + float2(0, h.y)) + tex2D(_MainTex, uv - float2(0, h.y))) * 0.11;
                c += (tex2D(_MainTex, uv + float2(r.x, 0)) + tex2D(_MainTex, uv - float2(r.x, 0)) + tex2D(_MainTex, uv + float2(0, r.y)) + tex2D(_MainTex, uv - float2(0, r.y))) * 0.055;
                c += (tex2D(_MainTex, uv + d) + tex2D(_MainTex, uv - d) + tex2D(_MainTex, uv + float2(d.x, -d.y)) + tex2D(_MainTex, uv + float2(-d.x, d.y))) * 0.055;
                return c;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 tex = Sample(i.uv) * i.color;
                float3 c = ToGamma(tex.rgb);
                // 層ごと
                c = lerp(c, ToGamma(_HazeColor.rgb), _Haze);
                c = lerp(c, ToGamma(_MixColor.rgb), _Mix);
                c *= _Bright;
                // 画面全体
                if (_CgOn > 0.5)
                {
                    c = saturate(c);
                    if (_CgTemp > 0) c = lerp(c, SoftLight(c, ToGamma(_CgTempColor.rgb)), _CgTemp);
                    if (_CgOvl > 0)
                    {
                        float y = saturate(i.screen.y / max(1e-4, i.screen.w));   // 0 下・1 上
                        float3 s = lerp(ToGamma(_CgOvlBottom.rgb), ToGamma(_CgOvlTop.rgb), y);
                        c = lerp(c, Blend(c, s, _CgOvlMode), _CgOvl);
                    }
                    c = c * _CgBright;
                    c = (c - 0.5) * _CgContrast + 0.5;
                    float l = dot(c, float3(0.2126, 0.7152, 0.0722));
                    c = lerp(l.xxx, c, _CgSaturate);
                }
                return fixed4(ToLinear(saturate(c)), tex.a);
            }
            ENDCG
        }
    }
}

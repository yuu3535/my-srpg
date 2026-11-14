// 探索の縁の光の「流れる帯」（探索の仕様書 §4.1 band。2026-11-14 総合担当）。
// マスクの形（_MainTex の不透明度）の中だけ、中心 (0.5, 0.5) から回る扇形（CSS の conic-gradient）の明るい所を見せる。
// _Angle＝回った角度（度。上から時計回り）、_Two＝1 なら光が2つ（選んでいるとき）、0 なら1つ（ときどき1周）。
// _Aspect＝マスクの幅÷高さ（角度を正しく測るため）。Resources に置いて、書き出しに必ず入れる
Shader "Srpg/UI/RimBand"
{
    Properties
    {
        [PerRendererData] _MainTex ("Mask", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _Angle ("Angle", Float) = 0
        _Two ("Two lights", Float) = 0
        _Aspect ("Aspect", Float) = 1
        _StencilComp ("Stencil Comparison", Float) = 8
        _Stencil ("Stencil ID", Float) = 0
        _StencilOp ("Stencil Operation", Float) = 0
        _StencilWriteMask ("Stencil Write Mask", Float) = 255
        _StencilReadMask ("Stencil Read Mask", Float) = 255
        _ColorMask ("Color Mask", Float) = 15
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "PreviewType"="Plane" "CanUseSpriteAtlas"="True" }
        Stencil
        {
            Ref [_Stencil]
            Comp [_StencilComp]
            Pass [_StencilOp]
            ReadMask [_StencilReadMask]
            WriteMask [_StencilWriteMask]
        }
        Cull Off
        Lighting Off
        ZWrite Off
        ZTest [unity_GUIZTestMode]
        Blend SrcAlpha OneMinusSrcAlpha
        ColorMask [_ColorMask]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct appdata { float4 vertex : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; };
            struct v2f { float4 pos : SV_POSITION; fixed4 color : COLOR; float2 uv : TEXCOORD0; };
            sampler2D _MainTex;
            fixed4 _Color;
            float _Angle, _Two, _Aspect;
            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                o.color = v.color * _Color;
                return o;
            }
            // CSS の conic-gradient と同じ明るさ（1つ: 285°まで0 → 335°で .6 → 358°で 1 → 360°で 0）
            float One (float r)
            {
                if (r < 285.0) return 0.0;
                if (r < 335.0) return lerp(0.0, 0.6, (r - 285.0) / 50.0);
                if (r < 358.0) return lerp(0.6, 1.0, (r - 335.0) / 23.0);
                return lerp(1.0, 0.0, (r - 358.0) / 2.0);
            }
            // 2つ: 半周ごとに 0 → 130°で .55 → 178°で 1 → 180°で 0
            float Two (float r)
            {
                float h = fmod(r, 180.0);
                if (h < 130.0) return lerp(0.0, 0.55, h / 130.0);
                if (h < 178.0) return lerp(0.55, 1.0, (h - 130.0) / 48.0);
                return lerp(1.0, 0.0, (h - 178.0) / 2.0);
            }
            fixed4 frag (v2f i) : SV_Target
            {
                float m = tex2D(_MainTex, i.uv).a;
                float2 d = float2((i.uv.x - 0.5) * _Aspect, i.uv.y - 0.5);
                float ang = degrees(atan2(d.x, d.y));          // 上が 0°、時計回り
                float r = fmod(ang - _Angle + 720.0, 360.0);
                float b = _Two > 0.5 ? Two(r) : One(r);
                fixed4 c = i.color;
                c.a *= m * b;
                return c;
            }
            ENDCG
        }
    }
}

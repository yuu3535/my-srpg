// 2Dの横スクロールの光の筋・床の光（2026-10-04）。重ね方は Corridor2DView が _SrcBlend・_DstBlend で選ぶ:
//   スクリーン（One, OneMinusSrcColor）・加算（One, One）。色は透明度をかけてから出す（重ね方をそろえるため）
Shader "Srpg/Corridor2DGlow"
{
    Properties
    {
        [PerRendererData] _MainTex ("Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        [Enum(UnityEngine.Rendering.BlendMode)] _SrcBlend ("Src", Float) = 1
        [Enum(UnityEngine.Rendering.BlendMode)] _DstBlend ("Dst", Float) = 6
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "PreviewType"="Plane" }
        Cull Off
        Lighting Off
        ZWrite Off
        ZTest [unity_GUIZTestMode]
        Blend [_SrcBlend] [_DstBlend]

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

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                o.color = v.color * _Color;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 c = tex2D(_MainTex, i.uv) * i.color;
                // ブラウザ（sRGB）で「色×透明度」を重ねたのと同じ明るさにする（線形のまま足すと、暗い石の上でずっと明るくなる）
            #ifdef UNITY_COLORSPACE_GAMMA
                return fixed4(c.rgb * c.a, c.a);
            #else
                return fixed4(GammaToLinearSpace(LinearToGammaSpace(c.rgb) * c.a), c.a);
            #endif
            }
            ENDCG
        }
    }
}

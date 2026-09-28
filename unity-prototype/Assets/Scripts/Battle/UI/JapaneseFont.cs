using System.Linq;
using UnityEngine;

namespace Srpg.Battle
{
    /// <summary>
    /// 日本語の字体を用意する。端末の字体（游ゴシック・メイリオなど）はブラウザ（WebGL）では使えないので、
    /// その時はゲームに入れてある字体（Assets/Fonts の Noto Serif JP。会話の画面が使っていて読み込み済み）を使う
    /// </summary>
    public static class JapaneseFont
    {
        public static Font Get(string[] osFonts, int size)
        {
            if (Application.platform != RuntimePlatform.WebGLPlayer)
                return Font.CreateDynamicFontFromOSFont(osFonts, size);
            var bundled = Resources.FindObjectsOfTypeAll<Font>()
                .Where(f => f.name.StartsWith("Noto"))
                .OrderBy(f => f.name.Contains("Bold") ? 1 : 0)
                .FirstOrDefault();
            return bundled != null ? bundled : Font.CreateDynamicFontFromOSFont(osFonts, size);
        }
    }
}

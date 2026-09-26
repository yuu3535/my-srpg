using System.Collections;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>▶（Play）で3Dの盤面の戦闘を動かし、選んで動かせるか・狙われた印が出るかを確かめる</summary>
    public class Battle3DPlayTests
    {
        [UnityTest]
        public IEnumerator SelectAndMoveArsheOn3DBoard()
        {
            SceneManager.LoadScene("Battle3D");
            yield return null;
            yield return null;

            var controller = Object.FindFirstObjectByType<Battle3DController>();
            Assert.IsNotNull(controller, "Battle3DController がない");
            Assert.AreEqual(8, controller.Units.Count);   // 味方4人（カリマを含む）と敵4人
            Assert.IsTrue(controller.View.Tilted, "斜め見下ろしで始まる");

            // 狙われている印（赤い丸）は、ふだんは出さず、狙われたときだけ出す
            Assert.IsFalse(controller.View.IsTargeted("arshe"));
            controller.SetTargeted("arshe", true);
            Assert.IsTrue(controller.View.IsTargeted("arshe"));
            controller.SetTargeted("arshe", false);

            var arshe = controller.Units.First(u => u.source.id == "arshe");
            var start = arshe.cell;
            controller.TapCell(start);
            Assert.AreSame(arshe, controller.Selected, "アルシェのマスを押すと選ばれる");
            Assert.Greater(controller.View.RangeCount, 0, "移動範囲が出る");

            var dest = start + new Vector2Int(0, -2);   // 2マス奥（移動力3の範囲）
            controller.TapCell(dest);
            Assert.AreEqual(dest, arshe.cell, "移動範囲のマスを押すと動く");
            Assert.IsTrue(arshe.moved);
            Assert.IsNull(controller.Selected);
            Assert.AreEqual(0, controller.View.RangeCount, "動いたら移動範囲は消える");

            // 動いたユニット・敵は選べない
            controller.TapCell(dest);
            Assert.IsNull(controller.Selected);
            controller.TapCell(controller.Units.First(u => u.source.side == "enemy").cell);
            Assert.IsNull(controller.Selected);

            // 90°回しても、盤面のマスと押す判定は変わらない
            controller.View.SetView(true, 1, true);
            var screen = controller.View.CellToScreen(dest);
            Assert.IsTrue(controller.View.TryPickCell(screen, out var picked));
            Assert.AreEqual(dest, picked);
        }
    }
}

using System.Collections;
using System.Linq;
using NUnit.Framework;
using Srpg.Battle;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Srpg.Tests
{
    /// <summary>▶（Play）でシーンを動かし、選択と移動ができるかを確かめる</summary>
    public class BattleM1PlayTests
    {
        [UnityTest]
        public IEnumerator SelectAndMoveArshe()
        {
            SceneManager.LoadScene("BattleM1");
            yield return null;
            yield return null;

            var controller = Object.FindFirstObjectByType<BattleM1Controller>();
            Assert.IsNotNull(controller, "BattleM1Controller がない");
            Assert.AreEqual(7, controller.Units.Count);   // カリマは背景を透明にした絵ができるまで出さない
            Assert.IsTrue(controller.Units.All(u => u.ring != null), "全員の足元に光がある");

            var arshe = controller.Units.First(u => u.source.id == "arshe");
            var start = arshe.cell;
            controller.TapCell(start);
            Assert.AreSame(arshe, controller.Selected, "アルシェのマスを押すと選ばれる");

            var dest = start + new Vector2Int(0, -2);   // 2マス奥（移動力3の範囲）
            controller.TapCell(dest);
            Assert.AreEqual(dest, arshe.cell, "移動範囲のマスを押すと移動する");
            Assert.IsTrue(arshe.moved);
            Assert.IsNull(controller.Selected);

            // 移動したユニットは選べない。敵も選べない
            controller.TapCell(dest);
            Assert.IsNull(controller.Selected);
            var enemy = controller.Units.First(u => u.source.side == "enemy");
            controller.TapCell(enemy.cell);
            Assert.IsNull(controller.Selected);
        }
    }
}

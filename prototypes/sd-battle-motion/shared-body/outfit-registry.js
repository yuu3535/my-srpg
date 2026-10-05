/* 自動で作る一覧（import_outfits.py）。手で直さない。立ち絵透過下処理/兵種衣装/ から取り込んだ兵種の衣装 */
(function (root) {
  'use strict';
  const outfits = [
 {
  "key": "braverChildB1",
  "classId": "戦列攻撃上級",
  "bodyType": "child",
  "variant": "B1",
  "label": "戦列攻撃上級・子供 B1",
  "file": "outfits/braver_child_b1.png",
  "size": [
   1254,
   1254
  ],
  "bounds": [
   360,
   323,
   989,
   1204
  ],
  "source": "立ち絵透過下処理/兵種衣装/braver_child_b/class_body_braver_child_static_b1.png",
  "sha256": "90dc34967a95fa78cf11e2187a8b7cc0a3a25aa430187970834a6787712e07e1"
 },
 {
  "key": "braverChildB2",
  "classId": "戦列攻撃上級",
  "bodyType": "child",
  "variant": "B2",
  "label": "戦列攻撃上級・子供 B2",
  "file": "outfits/braver_child_b2.png",
  "size": [
   1254,
   1254
  ],
  "bounds": [
   360,
   322,
   988,
   1204
  ],
  "source": "立ち絵透過下処理/兵種衣装/braver_child_b/class_body_braver_child_static_b2.png",
  "sha256": "709baa9a97ceef2d52f1b25b7f9304d5567b1318bf247c86d1abb6c3d6324834"
 },
 {
  "key": "braverChildB3",
  "classId": "戦列攻撃上級",
  "bodyType": "child",
  "variant": "B3",
  "label": "戦列攻撃上級・子供 B3",
  "file": "outfits/braver_child_b3.png",
  "size": [
   1254,
   1254
  ],
  "bounds": [
   360,
   322,
   989,
   1204
  ],
  "source": "立ち絵透過下処理/兵種衣装/braver_child_b/class_body_braver_child_static_b3.png",
  "sha256": "8a05612eadbbe56bdd8b4bf212d37b6484b4b1622411244107dce78275bafcef"
 }
];
  if (typeof module !== 'undefined') module.exports = outfits;
  else root.SharedBodyOutfits = outfits;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// 文字をクリップボードへ（WebGL）。ゲームの中の調整画面の「コピー」から呼ぶ（2026-10-04）。
// Unity はボタンを押したあとのフレームで呼ぶので、ブラウザによっては許されない。そのときは次に画面をタップしたときにもう一度試す
mergeInto(LibraryManager.library, {
  SrpgCopyText: function (ptr) {
    var text = UTF8ToString(ptr);
    var tryCopy = function () {
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
    };
    tryCopy();
    var once = function () { tryCopy(); document.removeEventListener('pointerup', once, true); };
    document.addEventListener('pointerup', once, true);
  }
});

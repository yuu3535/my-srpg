// 文を入れる欄（WebGL）。吹き出しの位置の調整（DialogueView.Bubble）の「文を入れる」から呼ぶ（2026-11-15）。
// Unity の入力欄は日本語の変換がうまく動かないので、ブラウザの入力欄（textarea）を画面に重ねて出す。
// 「決める」で文を Unity へ返す（改行はそのまま）。「やめる」なら 0 を返す。
mergeInto(LibraryManager.library, {
  SrpgEditText: function (initialPtr, done) {
    var initial = UTF8ToString(initialPtr);
    var old = document.getElementById('srpg-text-input');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'srpg-text-input';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,5,8,.55);display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#0b0c10;border:1px solid rgba(214,218,224,.72);padding:18px 20px;width:min(720px,90vw);font-family:serif;color:#f1efe9;';
    var title = document.createElement('div');
    title.textContent = '吹き出しに出す文（Enter で改行。1ページ2行まで）';
    title.style.cssText = 'font-size:16px;margin-bottom:10px;';
    var area = document.createElement('textarea');
    area.value = initial;
    area.rows = 5;
    area.style.cssText = 'width:100%;box-sizing:border-box;font-size:20px;line-height:1.6;background:#15161c;color:#f1efe9;border:1px solid rgba(214,218,224,.45);padding:8px;';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:12px;';
    function button(label, onClick) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font-size:16px;padding:8px 18px;background:#16141e;color:#f1efe9;border:1px solid rgba(214,218,224,.6);cursor:pointer;';
      b.addEventListener('click', onClick);
      row.appendChild(b);
    }
    function finish(text) {
      wrap.remove();
      if (text === null) { {{{ makeDynCall('vi', 'done') }}}(0); return; }
      var buf = stringToNewUTF8(text);
      {{{ makeDynCall('vi', 'done') }}}(buf);
      _free(buf);
    }
    button('やめる', function () { finish(null); });
    button('決める', function () { finish(area.value); });
    // Unity に押すのを取られないように
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel'].forEach(function (ev) {
      wrap.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    box.appendChild(title); box.appendChild(area); box.appendChild(row);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    setTimeout(function () { area.focus(); }, 0);
  }
});

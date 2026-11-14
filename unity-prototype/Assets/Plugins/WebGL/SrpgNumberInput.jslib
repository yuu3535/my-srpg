// 数を入れる欄（WebGL）。吹き出しの位置の調整（DialogueView.Bubble）の「数で入れる」から呼ぶ（2026-11-15）。
// labels と values は「|」区切り。「決める」で入れた数を「|」区切りで Unity へ返す。「やめる」なら 0 を返す。
mergeInto(LibraryManager.library, {
  SrpgEditNumbers: function (titlePtr, labelsPtr, valuesPtr, done) {
    var title = UTF8ToString(titlePtr);
    var labels = UTF8ToString(labelsPtr).split('|');
    var values = UTF8ToString(valuesPtr).split('|');
    var old = document.getElementById('srpg-number-input');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'srpg-number-input';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,5,8,.55);display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#0b0c10;border:1px solid rgba(214,218,224,.72);padding:18px 20px;width:min(560px,90vw);font-family:serif;color:#f1efe9;';
    var head = document.createElement('div');
    head.textContent = title;
    head.style.cssText = 'font-size:16px;margin-bottom:12px;';
    box.appendChild(head);
    var inputs = [];
    labels.forEach(function (label, i) {
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;margin:6px 0;font-size:17px;';
      var name = document.createElement('span');
      name.textContent = label;
      name.style.cssText = 'width:150px;';
      var input = document.createElement('input');
      input.type = 'number';
      input.step = '1';
      input.value = values[i] || '0';
      input.style.cssText = 'flex:1;font-size:20px;background:#15161c;color:#f1efe9;border:1px solid rgba(214,218,224,.45);padding:6px 8px;';
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') finish(true); });
      row.appendChild(name); row.appendChild(input);
      box.appendChild(row);
      inputs.push(input);
    });
    var buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:14px;';
    function button(label, onClick) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font-size:16px;padding:8px 18px;background:#16141e;color:#f1efe9;border:1px solid rgba(214,218,224,.6);cursor:pointer;';
      b.addEventListener('click', onClick);
      buttons.appendChild(b);
    }
    function finish(ok) {
      wrap.remove();
      if (!ok) { {{{ makeDynCall('vi', 'done') }}}(0); return; }
      var text = inputs.map(function (x) { var v = parseFloat(x.value); return isNaN(v) ? '' : String(v); }).join('|');
      var buf = stringToNewUTF8(text);
      {{{ makeDynCall('vi', 'done') }}}(buf);
      _free(buf);
    }
    button('やめる', function () { finish(false); });
    button('決める', function () { finish(true); });
    box.appendChild(buttons);
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel'].forEach(function (ev) {
      wrap.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    setTimeout(function () { if (inputs[0]) { inputs[0].focus(); inputs[0].select(); } }, 0);
  }
});

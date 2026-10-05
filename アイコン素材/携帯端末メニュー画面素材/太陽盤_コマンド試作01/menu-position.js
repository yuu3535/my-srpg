/* 配置調整専用。iframe内部を操作せず、調整中だけ透明なハンドルを重ねる。 */
(function (root) {
  'use strict';
  function mount(doc, win, model) {
    const byId = id => doc.getElementById(id), storageKey = 'solar-menu-layout-v01';
    const screen = byId('menu-screen'), edit = byId('menu-edit-layout');
    const names = { map: 'マップ', tip: '説明チップ', time: '時間帯アイコン', fortune: '運命予報' };
    const nodeIds = { map: 'map-open', tip: 'menu-tip', time: 'menu-time', fortune: 'menu-fortune' };
    const disposers = [], urls = new Set(), timers = new Set();
    let layout = model.positions(), tipHeight = model.normalizeTipHeight(), drag = null, disposed = false;
    function listen(node, type, handler) {
      node.addEventListener(type, handler);
      disposers.push(() => node.removeEventListener(type, handler));
    }
    function exportLayout() { byId('menu-layout-json').value = JSON.stringify(model.settings(layout, tipHeight), null, 2); }
    function apply() {
      for (const id of Object.keys(model.boxes)) {
        const box = model.boxes[id], handle = byId('move-' + id), pos = layout[id];
        const height = id === 'tip' ? tipHeight : box.height;
        const transform = `translate(${pos.left - box.left}px, ${pos.top - box.top}px)`;
        byId(nodeIds[id]).style.setProperty('--position-offset', transform);
        Object.assign(handle.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: height + 'px', transform });
        for (const axis of ['left', 'top']) {
          const input = byId(id + '-' + axis);
          input.value = String(pos[axis]);
          input.max = String((axis === 'left' ? 844 - box.width : 390 - height));
        }
        handle.setAttribute('aria-label', `${names[id]}を移動。X ${pos.left}、Y ${pos.top}。矢印キーで1、Shiftで10移動`);
      }
      byId('menu-tip').style.height = tipHeight + 'px';
      byId('tip-height').value = String(tipHeight);
      byId('tip-height-number').value = String(tipHeight);
      byId('tip-height-value').textContent = tipHeight + 'px';
      exportLayout();
    }
    function save() {
      try {
        win.localStorage.setItem(storageKey, JSON.stringify(model.settings(layout, tipHeight)));
        byId('menu-layout-status').textContent = 'このブラウザに配置を保存しました。別の環境へ渡すときは設定をコピーしてください。';
      } catch {
        byId('menu-layout-status').textContent = 'この環境では自動保存できません。「配置をコピー」かJSON書き出しで控えてください。';
      }
    }
    function change(id, left, top, persist) {
      layout = model.positions({ ...layout, [id]: { left, top } }, layout, tipHeight);
      apply(); if (persist) save();
    }
    function finish() {
      if (!drag) return;
      const current = drag; drag = null;
      if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
      if (current.changed) save();
    }
    function syncEdit() {
      finish(); screen.dataset.editLayout = String(edit.checked);
      for (const id of Object.keys(model.boxes)) byId('move-' + id).hidden = !edit.checked;
    }
    for (const id of Object.keys(model.boxes)) {
      for (const axis of ['left', 'top']) {
        const input = byId(id + '-' + axis);
        listen(input, 'change', () => change(id, byId(id + '-left').value, byId(id + '-top').value, true));
      }
      const handle = byId('move-' + id);
      listen(handle, 'pointerdown', event => {
        if (!edit.checked || event.isPrimary === false || event.button !== 0 || drag) return;
        const width = screen.getBoundingClientRect().width;
        if (!(width > 0)) return;
        drag = { id, handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          left: layout[id].left, top: layout[id].top, scale: model.scaleFor(width), changed: false };
        handle.focus(); handle.setPointerCapture(event.pointerId); event.preventDefault();
      });
      listen(handle, 'pointermove', event => {
        if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;
        change(id, drag.left + (event.clientX - drag.x) / drag.scale, drag.top + (event.clientY - drag.y) / drag.scale, false);
        drag.changed = true;
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(handle, type, event => {
        if (drag && drag.id === id && drag.pointerId === event.pointerId) finish();
      });
      listen(handle, 'keydown', event => {
        if (!edit.checked) return;
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!direction) return;
        event.preventDefault(); const step = event.shiftKey ? 10 : 1;
        change(id, layout[id].left + direction[0] * step, layout[id].top + direction[1] * step, true);
      });
    }
    listen(edit, 'change', syncEdit);
    function resizeTip(value, persist) {
      finish(); tipHeight = model.normalizeTipHeight(value, tipHeight);
      layout = model.positions(layout, layout, tipHeight);
      apply(); if (persist) save();
    }
    listen(byId('tip-height'), 'input', () => resizeTip(byId('tip-height').value, false));
    listen(byId('tip-height'), 'change', () => resizeTip(byId('tip-height').value, true));
    listen(byId('tip-height-number'), 'change', () => resizeTip(byId('tip-height-number').value, true));
    listen(byId('tip-reset-height'), 'click', () => resizeTip(model.boxes.tip.height, true));
    listen(byId('menu-reset-layout'), 'click', () => { finish(); tipHeight = model.normalizeTipHeight(); layout = model.positions(); apply(); save(); });
    listen(byId('menu-copy-layout'), 'click', async () => {
      const json = byId('menu-layout-json').value;
      try {
        await win.navigator.clipboard.writeText(json);
        if (!disposed) byId('menu-layout-export-status').textContent = '配置をコピーしました。このチャットに貼ってください。';
      } catch {
        if (disposed) return;
        byId('menu-layout-details').open = true;
        byId('menu-layout-json').focus(); byId('menu-layout-json').select();
        byId('menu-layout-export-status').textContent = '自動コピーできません。選択したJSONをCtrl+Cでコピーしてください。';
      }
    });
    listen(byId('menu-download-layout'), 'click', () => {
      let url, link;
      try {
        url = win.URL.createObjectURL(new win.Blob([byId('menu-layout-json').value], { type: 'application/json;charset=utf-8' })); urls.add(url);
        link = doc.createElement('a'); link.href = url; link.download = 'solar-menu-layout.json';
        doc.body.appendChild(link); link.click();
        byId('menu-layout-export-status').textContent = '配置JSONの保存を開始しました。保存先はブラウザ側で確認してください。';
        const timer = win.setTimeout(() => { win.URL.revokeObjectURL(url); urls.delete(url); timers.delete(timer); }, 1000); timers.add(timer);
      } catch {
        if (url) { win.URL.revokeObjectURL(url); urls.delete(url); }
        byId('menu-layout-details').open = true;
        byId('menu-layout-export-status').textContent = '書き出しを開始できません。JSON欄から設定をコピーしてください。';
      } finally { if (link) link.remove(); }
    });
    try {
      const saved = JSON.parse(win.localStorage.getItem(storageKey) || 'null');
      if (saved !== null) {
        if (saved.schema !== model.schema || saved.positionUnit !== 'pixels' || saved.referenceResolution?.width !== 844 || saved.referenceResolution?.height !== 390) throw new Error('unsupported');
        tipHeight = model.normalizeTipHeight(saved.tipHeight);
        layout = model.positions(saved.positions, model.boxes, tipHeight);
        byId('menu-layout-status').textContent = 'このブラウザに保存した配置を復元しました。';
      } else byId('menu-layout-status').textContent = '変更した配置はこのブラウザに自動保存します。';
    } catch {
      byId('menu-layout-status').textContent = '保存配置を読み込めなかったため初期位置で開きました。コピー／JSON書き出しは使えます。';
    }
    function destroy() {
      if (disposed) return;
      finish(); disposed = true; disposers.splice(0).forEach(dispose => dispose());
      timers.forEach(timer => win.clearTimeout(timer)); timers.clear();
      urls.forEach(url => win.URL.revokeObjectURL(url)); urls.clear();
    }
    listen(win, 'pagehide', event => { if (event.persisted) finish(); else destroy(); });
    listen(win, 'resize', finish);
    apply(); syncEdit();
    return { destroy };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { mount };
  else mount(document, root, root.SolarMenuPreview);
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* 配色の調整UI。色相環のドラッグは1フレームに1回だけ反映。 */
(function (root) {
  'use strict';
  function mount(container, onChange) {
    const engine = root.SolarMaterials;
    let profiles = engine.normalize();
    let frame = null;
    let disposed = false;
    const names = { white: '白いガラス面', gold: '金色の枠', ochre: '黄土・琥珀色の面' };
    const labels = { hue: '色相', saturation: '鮮やかさ', lightness: '明るさ', shading: '陰影の強さ', gloss: '光沢' };
    const controls = {};
    const make = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text) e.textContent = text; return e; };
    const id = (key, field) => 'material-' + key + '-' + field;
    function refresh() {
      engine.keys.forEach(key => {
        const p = profiles[key], c = controls[key];
        c.original.checked = p.original;
        const color = 'hsl(' + p.hue + ' ' + p.saturation + '% ' + p.lightness + '%)';
        c.wheel.style.setProperty('--hue', p.hue + 'deg');
        c.wheel.style.setProperty('--sample', color);
        c.wheel.setAttribute('aria-valuenow', p.hue);
        c.wheel.setAttribute('aria-valuetext', p.hue + '度');
        Object.keys(labels).forEach(field => {
          c[field].input.value = p[field];
          c[field].output.textContent = p[field] + (field === 'hue' ? '度' : '％');
        });
      });
    }
    function schedule() {
      refresh();
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = null; if (!disposed) onChange(engine.normalize(profiles)); });
    }
    engine.keys.forEach(key => {
      const section = make('fieldset', 'material-section'), legend = make('legend', '', names[key]);
      section.append(legend);
      const top = make('div', 'material-top');
      const wheel = make('div', 'hue-wheel');
      wheel.tabIndex = 0; wheel.setAttribute('role', 'slider'); wheel.setAttribute('aria-label', names[key] + 'の色相環');
      wheel.setAttribute('aria-valuemin', '0'); wheel.setAttribute('aria-valuemax', '360');
      wheel.append(make('span', 'wheel-marker'), make('span', 'wheel-sample'));
      const originalLabel = make('label', 'check'), original = make('input'); original.type = 'checkbox';
      originalLabel.append(original, make('span', '', '元の色・質感'));
      top.append(wheel, originalLabel); section.append(top);
      controls[key] = { wheel, original };
      original.addEventListener('change', () => { profiles[key].original = original.checked; schedule(); });
      const fields = make('div', 'fields');
      Object.keys(labels).forEach(field => {
        const label = make('label'), row = make('span'), output = make('output');
        const input = make('input'); input.type = 'range'; input.min = 0; input.max = field === 'hue' ? 360 : field === 'saturation' ? 80 : 100;
        input.id = id(key, field); label.htmlFor = input.id;
        row.append(make('span', '', labels[field]), output); label.append(row, input); fields.append(label);
        controls[key][field] = { input, output };
        input.addEventListener('input', () => {
          if (field === 'hue' && profiles[key].original && profiles[key].saturation < 20) profiles[key].saturation = 35;
          profiles[key][field] = Number(input.value); profiles[key].original = false; schedule();
        });
      });
      const pick = event => {
        const rect = wheel.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
        if (Math.hypot(x, y) < rect.width * .23) return;
        if (profiles[key].original && profiles[key].saturation < 20) profiles[key].saturation = 35;
        profiles[key].hue = Math.round((Math.atan2(y, x) * 180 / Math.PI + 450) % 360);
        profiles[key].original = false; schedule();
      };
      let pointer = null;
      wheel.addEventListener('pointerdown', event => { if (event.button !== 0) return; pointer = event.pointerId; wheel.setPointerCapture(pointer); pick(event); });
      wheel.addEventListener('pointermove', event => { if (pointer === event.pointerId) pick(event); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => wheel.addEventListener(name, () => { pointer = null; }));
      wheel.addEventListener('keydown', event => {
        let value = profiles[key].hue, step = event.shiftKey ? 10 : 1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') value += step;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') value -= step;
        else if (event.key === 'Home') value = 0;
        else if (event.key === 'End') value = 360;
        else return;
        event.preventDefault();
        if (profiles[key].original && profiles[key].saturation < 20) profiles[key].saturation = 35;
        profiles[key].hue = event.key === 'End' ? 360 : (value + 360) % 360; profiles[key].original = false; schedule();
      });
      section.append(fields); container.append(section);
    });
    refresh();
    return {
      get: () => engine.normalize(profiles),
      set(data) { if (frame !== null) cancelAnimationFrame(frame); frame = null; profiles = engine.normalize(data); refresh(); onChange(engine.normalize(profiles)); },
      dispose() { disposed = true; if (frame !== null) cancelAnimationFrame(frame); }
    };
  }
  root.SolarMaterialControls = { mount };
})(window);

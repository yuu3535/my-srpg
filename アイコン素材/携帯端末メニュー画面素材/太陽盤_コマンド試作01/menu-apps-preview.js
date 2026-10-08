/* アプリの表示と入口見本のみ。装備・残金・名声・報酬のゲーム処理は呼ばない。 */
(function(root) {
  'use strict';
  function mount(doc,win,model,wheelModel) {
    const byId=id=>doc.getElementById(id), screen=byId('menu-screen'), dialog=byId('home-app-dialog');
    const buttons=Array.from(doc.querySelectorAll('[data-home-app]')), disposers=[], failures=new Set();
    let hovered=null, focused=null, wheelTip=wheelModel.description('items'), disposed=false;
    function listen(node,type,handler) { node.addEventListener(type,handler); disposers.push(()=>node.removeEventListener(type,handler)); }
    function drawTip() { const value=model.app(hovered||focused); byId('menu-tip').textContent=value ? value.tip : wheelTip; }
    function errorStatus() { byId('home-app-error').hidden=failures.size===0; byId('home-app-error').textContent=failures.size ? 'アプリ素材を読み込めません：'+Array.from(failures).join('・')+'。アプリアイコン_清書01フォルダを確認してください。' : ''; }
    function openApp(id) {
      const value=model.app(id); if (!value || (id==='ouroboros' && !byId('home-mystery').checked)) return;
      byId('home-app-title').textContent=value.label;
      byId('home-app-body').textContent=value.detail;
      byId('home-dialog-icon').hidden=id==='fortune';
      byId('home-dialog-icon').src=value.src;
      byId('menu-fortune').hidden=id!=='fortune';
      if (typeof dialog.showModal==='function') { if (!dialog.open) dialog.showModal(); }
      else dialog.setAttribute('open','');
    }
    function mystery() {
      const visible=byId('home-mystery').checked;
      screen.dataset.mystery=String(visible); byId('home-ouroboros').hidden=!visible;
      if (!visible) { if (hovered==='ouroboros') hovered=null; if (focused==='ouroboros') focused=null; }
      drawTip();
    }
    for (const button of buttons) {
      const id=button.dataset.homeApp;
      if (!model.app(id)) continue;
      listen(button,'pointerenter',()=>{hovered=id;drawTip();});
      listen(button,'pointerleave',()=>{hovered=null;drawTip();});
      listen(button,'focus',()=>{focused=id;drawTip();});
      listen(button,'blur',()=>{focused=null;drawTip();});
      listen(button,'click',()=>openApp(id));
      const image=button.querySelector('.app-art>img'), art=button.querySelector('.app-art'), fallback=button.querySelector('.app-fallback');
      function loaded() { art.dataset.loading='false'; image.hidden=false; fallback.hidden=true; failures.delete(model.apps[id].label); errorStatus(); }
      function failed() { art.dataset.loading='false'; image.hidden=true; fallback.hidden=false; failures.add(model.apps[id].label); errorStatus(); }
      listen(image,'load',loaded); listen(image,'error',failed);
      if (image.complete) { if (image.naturalWidth>0) loaded(); else failed(); }
    }
    const beta=byId('home-beta');
    for(const key of ['size','x','y','angle']) screen.style.setProperty('--app-beta-'+key,model.beta[key]+(key==='angle'?'deg':'%'));
    beta.hidden=!model.beta.visible;
    const sticker=beta.querySelector('img');
    function betaFailed() { beta.hidden=true;failures.add('β版シール');errorStatus(); }
    function betaLoaded() { beta.hidden=!model.beta.visible;failures.delete('β版シール');errorStatus(); }
    listen(sticker,'error',betaFailed);
    listen(sticker,'load',betaLoaded);
    if(sticker.complete) { if(sticker.naturalWidth>0)betaLoaded();else betaFailed(); }
    listen(byId('home-mystery'),'change',mystery);
    listen(byId('home-app-close'),'click',event=>{
      if (typeof dialog.close!=='function') { event.preventDefault();dialog.removeAttribute('open'); }
    });
    listen(win,'message',event=>{
      if (event.source!==byId('menu-wheel').contentWindow || !event.data || event.data.type!=='solar-menu-state') return;
      if (event.data.selected!==null && !Object.hasOwn(wheelModel.descriptions,event.data.selected)) return;
      wheelTip=wheelModel.description(event.data.selected);drawTip();
    });
    function destroy() { if(disposed)return;disposed=true;disposers.splice(0).forEach(dispose=>dispose()); }
    listen(win,'pagehide',event=>{if(!event.persisted)destroy();});
    mystery();errorStatus();
    return {destroy,openApp};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={mount};
  else mount(document,root,root.SolarMenuApps,root.SolarMenuPreview);
})(typeof globalThis!=='undefined'?globalThis:this);

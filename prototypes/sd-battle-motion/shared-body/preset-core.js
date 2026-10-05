/* キャラ×汎用兵種×体型の外見記録。DOM・保存先・本編には依存しない。 */
(function (root) {
  'use strict';
  const fit = typeof module !== 'undefined' ? require('./fit-core.js') : root.SharedBodyFit;
  const pixels = typeof module !== 'undefined' ? require('./pixel-core.js') : root.SharedBodyPixels;
  const FORMAT = 'srpg-generic-outfits', VERSION = 1, STORAGE_KEY = 'srpg.generic-outfits.v1';
  // abilityData.jsのclassLinesとcharacters.jsの子供IDに対応。兵種の採用変更ではない。
  const classIds = ['戦列下級','戦列攻撃上級','戦列防御上級','術下級','術軍師上級','術魔法上級','騎兵下級','騎馬上級','飛行上級','隠密下級','隠密暗殺上級','隠密遊撃上級'];
  const characters = { arshe: 'young_arshe', karima: 'young_karima' };
  const templates = Object.fromEntries(fit.outfitKeys.map(id => [id,{classId:fit.bodies[id].classId,bodyType:fit.bodies[id].bodyType}]));   // 兵種の衣装ごと（取り込んだ衣装も）
  const copy = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({ format: FORMAT, version: VERSION, state:'試作対象', records:[] });
  const fail = message => { throw new Error(message); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : fail('記録の構造が不正です');
  const number = (value,min,max,label) => Number.isFinite(value) && value>=min && value<=max ? value : fail(`${label}が範囲外です`);
  const bool = (value,label) => typeof value === 'boolean' ? value : fail(`${label}が不正です`);
  function text(value,max,label) {
    if (typeof value!=='string' || !value.trim() || value.length>max) fail(`${label}が不正です`);
    return value.trim();
  }
  function adjustment(value,reference=false) {
    object(value);
    return {scale:number(value.scale,reference ? .75 : .8,reference?1.25:1.2,'倍率'),x:number(value.x,reference?-120:-18,reference?120:18,'左右位置'),y:number(value.y,reference?-50:-12,reference?50:12,'上下位置')};
  }
  function palette(value) {
    object(value);
    return Object.fromEntries(pixels.groups.map(({id}) => {
      const setting=object(value[id]);
      return [id,{enabled:bool(setting.enabled,'色替えON/OFF'),hue:number(setting.hue,0,359,'色相'),saturation:number(setting.saturation,0,100,'彩度'),lightness:number(setting.lightness,-45,45,'明るさ')}];
    }));
  }
  function validateRecord(input) {
    object(input);
    const appearance=object(input.appearance), editor=object(input.editor), view=object(editor.view);
    const template=Object.hasOwn(templates,appearance.templateId) ? templates[appearance.templateId] : null;
    if (!template || input.classId!==template.classId || input.bodyType!==template.bodyType) fail('この兵種・体型の衣装素材は未登録です');
    const previewCharacter=Object.keys(characters).find(key=>characters[key]===input.characterId);
    if (!previewCharacter) fail('このキャラの元頭部は未登録です');
    const id=text(input.id,100,'記録ID');
    if (!/^[A-Za-z0-9-]+$/.test(id)) fail('記録IDが不正です');
    const revision=number(input.revision,1,1000000,'履歴番号');
    if (!Number.isInteger(revision)) fail('履歴番号は整数が必要です');
    const savedAt=text(input.savedAt,40,'保存日時');
    if (!Number.isFinite(Date.parse(savedAt))) fail('保存日時が不正です');
    return {id,revision,savedAt,state:'試作対象',characterId:input.characterId,classId:input.classId,bodyType:input.bodyType,
      name:text(input.name,80,'記録名'),
      appearance:{templateId:appearance.templateId,head:adjustment(appearance.head),palette:appearance.templateId==='lineA1' ? palette(appearance.palette) : null,seam:bool(appearance.seam,'首接合')},
      editor:{reference:adjustment(editor.reference,true),view:{overlay:bool(view.overlay,'重ね表示'),silhouette:bool(view.silhouette,'シルエット表示'),opacity:number(view.opacity,0,1,'不透明度'),mirror:bool(view.mirror,'反転'),guides:bool(view.guides,'ガイド')}}};
  }
  const key = record => JSON.stringify([record.characterId,record.classId,record.bodyType]);
  function validateLibrary(input) {
    object(input);
    if (input.format!==FORMAT || input.version!==VERSION) fail('対応していない記録形式です');
    if (!Array.isArray(input.records) || input.records.length>1000) fail('記録件数が不正です（上限1000件）');
    const records=input.records.map(validateRecord), ids=new Set(), revisions=new Set();
    for (const record of records) {
      const rk=JSON.stringify([key(record),record.revision]);
      if (ids.has(record.id) || revisions.has(rk)) fail('記録IDまたは履歴番号が重複しています');
      ids.add(record.id); revisions.add(rk);
    }
    return {...empty(),records};
  }
  function append(inputLibrary,inputRecord) {
    const library=validateLibrary(inputLibrary), groupKey=key(inputRecord);
    const revision=1+Math.max(0,...library.records.filter(r=>key(r)===groupKey).map(r=>r.revision));
    return validateLibrary({...library,records:[...library.records,validateRecord({...inputRecord,revision})]});
  }
  function merge(left,right) {
    let library=validateLibrary(left);
    for (const record of validateLibrary(right).records) {
      const existing=library.records.find(r=>r.id===record.id);
      if (existing) {
        if (JSON.stringify({...existing,revision:record.revision})!==JSON.stringify(record)) fail('同じ記録IDの内容が異なります。既存の記録は変更しません');
        continue;
      }
      // 同じキー・履歴番号が別の環境で使われていたら、追加履歴として残す。
      const collision=library.records.some(r=>key(r)===key(record) && r.revision===record.revision);
      library=collision ? append(library,record) : validateLibrary({...library,records:[...library.records,record]});
    }
    return library;
  }
  function latest(inputLibrary,characterId,classId,bodyType) {
    return validateLibrary(inputLibrary).records.filter(record=>record.characterId===characterId && record.classId===classId && record.bodyType===bodyType).sort((a,b)=>b.revision-a.revision)[0] || null;
  }
  function fromLegacy(input,{id,savedAt}) {
    if (![3,4].includes(input.version) || !Object.hasOwn(templates,input.selectedBody) || !Object.hasOwn(characters,input.selectedCharacter)) fail('旧JSONは衣装3案と元頭部のversion 3/4のみ対応しています');
    const body=input.selectedBody, character=input.selectedCharacter;
    return validateRecord({id,revision:1,savedAt,characterId:characters[character],classId:templates[body].classId,bodyType:templates[body].bodyType,name:`${fit.heads[character].label} / 旧JSONから取込`,
      appearance:{templateId:body,head:input.adjustments?.[body]?.[character],palette:body==='lineA1' ? input.palette?.characters?.[character] || pixels.paletteDefaults() : null,seam:input.seamView?.enabled ?? true},
      editor:{reference:input.referenceAdjustments?.[body]?.[character],view:{...input.referenceView,mirror:false,guides:false}}});
  }
  function parse(serialized,identity) {
    if (typeof serialized!=='string' || serialized.length>2*1024*1024) fail('JSONは2MB以下にしてください');
    let input;
    try { input=JSON.parse(serialized); } catch { fail('JSONを読み取れません。全文を貼り付けてください'); }
    object(input);
    if (input.format===FORMAT) return validateLibrary(input);
    if (input.version===5 && input.presetLibrary) return validateLibrary(input.presetLibrary);
    return {...empty(),records:[fromLegacy(input,identity)]};
  }
  function recipe(inputRecord) {
    const record=validateRecord(inputRecord), body=fit.bodies[record.appearance.templateId];
    const previewCharacter=Object.keys(characters).find(key=>characters[key]===record.characterId);
    const head=fit.extractedHeads[previewCharacter];
    return {kind:'static-composite',state:'試作対象',characterId:record.characterId,classId:record.classId,bodyType:record.bodyType,revision:record.revision,
      assetBase:'prototypes/sd-battle-motion/shared-body/assets/',
      body:copy(body),head:copy(head),adjustment:copy(record.appearance.head),
      palette:record.appearance.palette ? {mask:copy(fit.paletteMask),settings:copy(record.appearance.palette)} : null,
      seam:record.appearance.seam ? {body:copy(fit.seamMasks[record.appearance.templateId]),head:copy(fit.seamMasks[previewCharacter+'_extracted_head'])} : null,
      motion:null,weapon:null};
  }
  function workspace(input) {
    if (![3,4,5].includes(input.version)) return null;
    if (!Object.hasOwn(templates,input.selectedBody) || !Object.hasOwn(characters,input.selectedCharacter)) fail('この作業JSONの衣装・頭部は未対応です');
    const adjustments={},references={};
    for (const body of Object.keys(fit.bodies)) {
      adjustments[body]={};references[body]={};
      for (const character of Object.keys(fit.heads)) {
        adjustments[body][character]=adjustment(input.adjustments?.[body]?.[character] || fit.defaults());
        references[body][character]=adjustment(input.referenceAdjustments?.[body]?.[character] || fit.defaults(),true);
      }
    }
    const palettes=Object.fromEntries(Object.keys(characters).map(character=>[character,palette(input.palette?.characters?.[character] || pixels.paletteDefaults())]));
    const view=object(input.referenceView);
    return {selectedBody:input.selectedBody,selectedCharacter:input.selectedCharacter,adjustments,references,palettes,seam:bool(input.seamView?.enabled ?? true,'首接合'),view:{overlay:bool(view.overlay,'重ね表示'),silhouette:bool(view.silhouette,'シルエット'),opacity:number(view.opacity,0,1,'不透明度'),mirror:bool(input.editorView?.mirror ?? false,'反転'),guides:bool(input.editorView?.guides ?? false,'ガイド')}};
  }
  const api={FORMAT,VERSION,STORAGE_KEY,classIds,characters,templates,empty,copy,key,validateRecord,validateLibrary,append,merge,latest,parse,recipe,workspace};
  if (typeof module!=='undefined') module.exports=api;
  else root.SharedBodyPresets=api;
})(typeof globalThis!=='undefined' ? globalThis : this);

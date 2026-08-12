const API_URL='https://n8n.estyl.team/webhook/mol-terminy-aplikacja-magazynowa';

const $=id=>document.getElementById(id);
const els={
  loader:$('loader'),offline:$('offline'),connectionBadge:$('connectionBadge'),
  eanInput:$('eanInput'),eanStatus:$('eanStatus'),productData:$('productData'),skuValue:$('skuValue'),brandValue:$('brandValue'),nameValue:$('nameValue'),
  photoInput:$('photoInput'),fileName:$('fileName'),analyzeBtn:$('analyzeBtn'),analysisStatus:$('analysisStatus'),analysisData:$('analysisData'),batchValue:$('batchValue'),productionValue:$('productionValue'),shelfValue:$('shelfValue'),expiryValue:$('expiryValue'),decodeStatusValue:$('decodeStatusValue'),
  locationInput:$('locationInput'),locationStatus:$('locationStatus'),locationData:$('locationData'),locationValue:$('locationValue'),zoneValue:$('zoneValue'),
  qtyInput:$('qtyInput'),saveBtn:$('saveBtn'),saveSummary:$('saveSummary'),saveStatus:$('saveStatus'),saveCard:$('saveCard')
};

const state={product:null,analysis:null,location:null,busy:false};

function setStatus(el,type,text){
  el.className='status '+type;
  el.textContent=text;
  el.classList.remove('hidden');
}
function clearStatus(el){el.textContent='';el.className='status info hidden';}
function show(el){el.classList.remove('hidden');}
function hide(el){el.classList.add('hidden');}
function val(v,fallback='—'){const s=String(v??'').trim();return s||fallback;}

async function api(action,fields={},file=null){
  const fd=new FormData();
  fd.append('action',action);
  Object.entries(fields).forEach(([k,v])=>fd.append(k,String(v??'')));
  if(file)fd.append('data',file,file.name||'photo.jpg');
  let res;
  try{
    res=await fetch(API_URL,{method:'POST',body:fd,cache:'no-store'});
  }catch(err){
    throw new Error('NETWORK');
  }
  let data={};
  try{data=await res.json();}catch(err){throw new Error('BAD_RESPONSE');}
  if(!res.ok)throw new Error(data?.error||('HTTP_'+res.status));
  return data;
}

function setBusy(on,label='Przetwarzam…'){
  state.busy=on;
  els.analyzeBtn.disabled=on||!state.product||!els.photoInput.files?.[0];
  els.saveBtn.disabled=on||!canSave();
  els.connectionBadge.textContent=on?label:'Połączono';
}

function canSave(){
  const qty=Number(String(els.qtyInput.value||'').replace(',','.'));
  return Boolean(state.product&&state.analysis&&state.location&&Number.isFinite(qty)&&qty>0&&(state.analysis.batch||state.analysis.expiryDate));
}

function refreshSave(){
  const qty=Number(String(els.qtyInput.value||'').replace(',','.'));
  const parts=[];
  parts.push(state.product?'EAN ✓':'EAN');
  parts.push(state.analysis?'Analiza ✓':'Analiza');
  parts.push(state.location?'Lokalizacja ✓':'Lokalizacja');
  parts.push(Number.isFinite(qty)&&qty>0?'Ilość ✓':'Ilość');
  els.saveSummary.textContent=parts.join('  •  ');
  els.saveBtn.disabled=state.busy||!canSave();
}

function resetAnalysis(){
  state.analysis=null;
  els.photoInput.value='';
  els.fileName.textContent='';
  els.analyzeBtn.disabled=true;
  clearStatus(els.analysisStatus);
  hide(els.analysisData);
  ['batchValue','productionValue','shelfValue','expiryValue','decodeStatusValue'].forEach(id=>$(id).textContent='—');
}
function resetLocation(){
  state.location=null;
  els.locationInput.value='';
  clearStatus(els.locationStatus);
  hide(els.locationData);
  els.locationValue.textContent='—';els.zoneValue.textContent='—';
}
function resetAll(){
  state.product=null;
  els.eanInput.value='';
  clearStatus(els.eanStatus);
  hide(els.productData);
  els.skuValue.textContent='—';els.brandValue.textContent='—';els.nameValue.textContent='—';
  resetAnalysis();
  resetLocation();
  els.qtyInput.value='';
  clearStatus(els.saveStatus);
  refreshSave();
  setTimeout(()=>els.eanInput.focus(),80);
}

async function lookupEan(){
  const ean=els.eanInput.value.trim().replace(/\s+/g,'');
  if(!ean)return;
  resetAnalysis();resetLocation();els.qtyInput.value='';state.product=null;refreshSave();
  setStatus(els.eanStatus,'info','Szukam produktu…');setBusy(true,'EAN…');
  try{
    const d=await api('lookup_ean',{ean});
    if(!d.found){setStatus(els.eanStatus,'err','EAN nie został znaleziony.');hide(els.productData);return;}
    state.product=d;
    els.skuValue.textContent=val(d.SKU);els.brandValue.textContent=val(d.Producent);els.nameValue.textContent=val(d.Nazwa);
    show(els.productData);setStatus(els.eanStatus,'ok','Produkt rozpoznany.');
    setTimeout(()=>els.photoInput.click(),150);
  }catch(err){
    if(err.message==='NETWORK')setStatus(els.eanStatus,'err','Brak połączenia z serwerem.');
    else setStatus(els.eanStatus,'err','Błąd odczytu EAN: '+err.message);
  }finally{setBusy(false);refreshSave();}
}

async function analyzePhoto(){
  const file=els.photoInput.files?.[0];
  if(!state.product||!file)return;
  setStatus(els.analysisStatus,'info','Analizuję zdjęcie i dekoduję partię…');setBusy(true,'Analiza…');
  try{
    const d=await api('analyze_batch',{ean:state.product.EAN},file);
    if(!d.success){setStatus(els.analysisStatus,'err',d.message||d.error||'Analiza nie powiodła się.');return;}
    state.analysis=d;
    els.batchValue.textContent=val(d.batch);
    els.productionValue.textContent=val(d.productionDate);
    els.shelfValue.textContent=d.shelfLifeMonths?String(d.shelfLifeMonths)+' mies.':val(d.shelfLifeSource);
    els.expiryValue.textContent=val(d.expiryDate);
    els.decodeStatusValue.textContent=val(d.statusDekodowania);
    show(els.analysisData);
    if(d.expiryDate)setStatus(els.analysisStatus,'ok','Termin ustalony.');
    else if(d.batch)setStatus(els.analysisStatus,'warn','Partia rozpoznana, ale nie udało się ustalić pewnego terminu. Rekord może zostać zapisany z partią.');
    else setStatus(els.analysisStatus,'err','Nie udało się odczytać terminu ani partii. Zrób nowe zdjęcie.');
    if(d.expiryDate||d.batch)setTimeout(()=>els.locationInput.focus(),100);
  }catch(err){
    if(err.message==='NETWORK')setStatus(els.analysisStatus,'err','Brak połączenia z serwerem.');
    else setStatus(els.analysisStatus,'err','Błąd analizy: '+err.message);
  }finally{setBusy(false);refreshSave();}
}

async function lookupLocation(){
  const location=els.locationInput.value.trim().replace(/\s+/g,'');
  if(!location)return;
  state.location=null;refreshSave();setStatus(els.locationStatus,'info','Sprawdzam lokalizację…');setBusy(true,'Lokalizacja…');
  try{
    const d=await api('lookup_location',{location});
    if(!d.found){setStatus(els.locationStatus,'err','Lokalizacja nie została znaleziona.');hide(els.locationData);return;}
    state.location=d;
    els.locationValue.textContent=val(d.Lokalizacja);els.zoneValue.textContent=val(d.Strefa);
    show(els.locationData);setStatus(els.locationStatus,'ok','Lokalizacja poprawna.');
    setTimeout(()=>els.qtyInput.focus(),100);
  }catch(err){
    if(err.message==='NETWORK')setStatus(els.locationStatus,'err','Brak połączenia z serwerem.');
    else setStatus(els.locationStatus,'err','Błąd lokalizacji: '+err.message);
  }finally{setBusy(false);refreshSave();}
}

async function saveRecord(){
  if(!canSave())return;
  const qty=Number(String(els.qtyInput.value||'').replace(',','.'));
  clearStatus(els.saveStatus);setStatus(els.saveStatus,'info','Zapisuję rekord…');setBusy(true,'Zapis…');
  try{
    const d=await api('save',{
      ean:state.product.EAN,
      location:state.location.Lokalizacja,
      quantity:qty,
      batch:state.analysis.batch||'',
      expiryDate:state.analysis.expiryDate||'',
      statusDekodowania:state.analysis.statusDekodowania||'',
      sourceDekodowania:state.analysis.sourceDekodowania||''
    });
    if(!d.saved){setStatus(els.saveStatus,'err',d.message||d.error||'Rekord nie został zapisany.');return;}
    setStatus(els.saveStatus,'ok','Zapisano. Gotowe do kolejnego produktu.');
    els.saveCard.classList.remove('success-flash');void els.saveCard.offsetWidth;els.saveCard.classList.add('success-flash');
    setTimeout(resetAll,650);
  }catch(err){
    if(err.message==='NETWORK')setStatus(els.saveStatus,'err','Brak połączenia z serwerem.');
    else setStatus(els.saveStatus,'err','Błąd zapisu: '+err.message);
  }finally{setBusy(false);refreshSave();}
}

els.eanInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupEan();}});
els.photoInput.addEventListener('change',()=>{
  const file=els.photoInput.files?.[0];els.fileName.textContent=file?file.name:'';els.analyzeBtn.disabled=!state.product||!file||state.busy;
});
els.analyzeBtn.addEventListener('click',analyzePhoto);
els.locationInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupLocation();}});
els.qtyInput.addEventListener('input',refreshSave);
els.qtyInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!els.saveBtn.disabled){e.preventDefault();saveRecord();}});
els.saveBtn.addEventListener('click',saveRecord);

function updateOnline(){
  const online=navigator.onLine;
  els.offline.classList.toggle('show',!online);
  els.connectionBadge.textContent=online?'Połączono':'Offline';
}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}

window.addEventListener('load',()=>{
  updateOnline();refreshSave();
  setTimeout(()=>{els.loader.classList.add('hidden');els.eanInput.focus();},250);
});

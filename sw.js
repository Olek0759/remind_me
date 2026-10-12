const ST='kv';
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('remindme',1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function load(){const d=await idb();return new Promise(res=>{const q=d.transaction(ST).objectStore(ST).get('list');q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
async function save(l){const d=await idb();return new Promise(res=>{const t=d.transaction(ST,'readwrite');t.objectStore(ST).put(l,'list');t.oncomplete=res})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fmtMin=m=>m<60?m+' min':(Math.floor(m/60)+' godz.'+(m%60?' '+(m%60)+' min':''));
const all=()=>self.registration.getNotifications();
// główne (trwałe) powiadomienie tego przypomnienia
const shown=async(id,skip)=>(await all()).filter(n=>n.data&&n.data.id===id&&!n.data.pre&&n.tag!==skip);
async function show(r,skip){
  if((await shown(r.id,skip)).length)return;
  (await all()).filter(n=>n.data&&n.data.id===r.id&&n.data.pre).forEach(n=>n.close());
  return self.registration.showNotification('Remind me',{body:r.text,tag:r.id+'-'+Date.now(),requireInteraction:true,vibrate:[200,100,200],icon:'icon-192.png',badge:'icon-192.png',actions:[{action:'done',title:'Zrobione'}],data:{id:r.id}});
}
// przypomnienie uprzedzające: zwykłe powiadomienie, bez przycisku i bez wracania
function showPre(r){
  return self.registration.showNotification('Za '+fmtMin(r.pre),{body:r.text,tag:'pre-'+r.id,vibrate:[120],icon:'icon-192.png',badge:'icon-192.png',data:{id:r.id,pre:true}});
}
async function ping(){const cs=await clients.matchAll({includeUncontrolled:true});cs.forEach(c=>c.postMessage('update'))}
async function isOpen(id){const l=await load();const r=l.find(x=>x.id===id);return r&&!r.done?r:null}
async function check(){
  const list=await load(),now=Date.now();let ch=false;
  for(const r of list){
    if(r.done)continue;
    if(r.pre&&!r.preShown){
      const pt=r.at-r.pre*60000;
      if(pt<=now){r.preShown=true;ch=true;if(r.at>now)await showPre(r)}
    }
    if(r.at<=now)await show(r);
  }
  if(ch){await save(list);await ping()}
}
async function revive(id,skip){
  for(const d of [0,1500,4000]){
    if(d)await wait(d);
    const r=await isOpen(id);if(!r)return;
    await show(r,skip);
  }
}
const focusApp=async()=>{const cs=await clients.matchAll({type:'window',includeUncontrolled:true});if(cs[0])await cs[0].focus();else await clients.openWindow('./')};
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('message',e=>{if(e.data&&e.data.type==='check')e.waitUntil(check())});
self.addEventListener('periodicsync',e=>{if(e.tag==='check')e.waitUntil(check())});
self.addEventListener('notificationclick',e=>{
  const d=e.notification.data||{},id=d.id;
  if(d.pre){e.notification.close();e.waitUntil(focusApp());return}
  if(e.action==='done'){
    e.waitUntil((async()=>{const l=await load();const r=l.find(x=>x.id===id);if(r){r.done=true;r.doneAt=Date.now();await save(l)}e.notification.close();await ping()})());
  }else{
    e.waitUntil((async()=>{e.notification.close();await focusApp();await revive(id,e.notification.tag)})());
  }
});
self.addEventListener('notificationclose',e=>{
  const d=e.notification.data||{};
  if(d.id&&!d.pre)e.waitUntil(revive(d.id,e.notification.tag));
});

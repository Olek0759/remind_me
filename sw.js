const ST='kv';
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('remindme',1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function load(){const d=await idb();return new Promise(res=>{const q=d.transaction(ST).objectStore(ST).get('list');q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
async function save(l){const d=await idb();return new Promise(res=>{const t=d.transaction(ST,'readwrite');t.objectStore(ST).put(l,'list');t.oncomplete=res})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const shown=async id=>(await self.registration.getNotifications()).filter(n=>n.data&&n.data.id===id);
// Każde powiadomienie dostaje unikalny tag, żeby przeglądarka nie gubiła zdarzeń zamknięcia.
async function show(r){
  if((await shown(r.id)).length)return;
  return self.registration.showNotification('Remind me',{body:r.text,tag:r.id+'-'+Date.now(),requireInteraction:true,vibrate:[200,100,200],icon:'icon-192.png',badge:'icon-192.png',actions:[{action:'done',title:'Zrobione'}],data:{id:r.id}});
}
async function ping(){const cs=await clients.matchAll({includeUncontrolled:true});cs.forEach(c=>c.postMessage('update'))}
async function isOpen(id){const l=await load();const r=l.find(x=>x.id===id);return r&&!r.done?r:null}
async function check(){
  const list=await load(),now=Date.now();
  for(const r of list){if(!r.done&&r.at<=now)await show(r)}
}
// Po zamknięciu: pokaż od razu, potem sprawdź jeszcze kilka razy, czy powiadomienie na pewno wróciło.
async function revive(id){
  for(const d of [0,1500,4000]){
    if(d)await wait(d);
    const r=await isOpen(id);if(!r)return;
    await show(r);
  }
}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('message',e=>{if(e.data&&e.data.type==='check')e.waitUntil(check())});
self.addEventListener('periodicsync',e=>{if(e.tag==='check')e.waitUntil(check())});
self.addEventListener('notificationclick',e=>{
  const id=e.notification.data.id;
  if(e.action==='done'){
    e.waitUntil((async()=>{const l=await load();const r=l.find(x=>x.id===id);if(r){r.done=true;r.doneAt=Date.now();await save(l)}e.notification.close();await ping()})());
  }else{
    e.waitUntil((async()=>{e.notification.close();const cs=await clients.matchAll({type:'window',includeUncontrolled:true});if(cs[0])await cs[0].focus();else await clients.openWindow('./');await revive(id)})());
  }
});
self.addEventListener('notificationclose',e=>{
  const id=e.notification.data&&e.notification.data.id;
  if(id)e.waitUntil(revive(id));
});

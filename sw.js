const ST='kv';
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('remindme',1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function load(){const d=await idb();return new Promise(res=>{const q=d.transaction(ST).objectStore(ST).get('list');q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
async function save(l){const d=await idb();return new Promise(res=>{const t=d.transaction(ST,'readwrite');t.objectStore(ST).put(l,'list');t.oncomplete=res})}
const show=r=>self.registration.showNotification('Remind me',{body:r.text,tag:r.id,renotify:true,requireInteraction:true,vibrate:[200,100,200],icon:'icon-192.png',badge:'icon-192.png',actions:[{action:'done',title:'Zrobione'}],data:{id:r.id}});
async function ping(){const cs=await clients.matchAll({includeUncontrolled:true});cs.forEach(c=>c.postMessage('update'))}
async function check(){
  const list=await load(),now=Date.now();let ch=false;
  for(const r of list){if(!r.done&&r.at<=now&&now-(r.last||0)>=300000){await show(r);r.last=now;ch=true}}
  if(ch){await save(list);await ping()}
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
    // tapnięcie w treść NIE odhacza – powiadomienie wraca
    e.waitUntil((async()=>{const l=await load();const r=l.find(x=>x.id===id);e.notification.close();if(r&&!r.done)await show(r)})());
  }
});
self.addEventListener('notificationclose',e=>{
  const id=e.notification.data&&e.notification.data.id;
  e.waitUntil((async()=>{const l=await load();const r=l.find(x=>x.id===id);if(r&&!r.done)await show(r)})());
});

// Tokens and media live only in memory. Never cache a Drive response or a session.
const CACHE='eunjae-drive-shell-v3';
const scope=new URL(self.registration.scope);
const SHELL=['./','index.html','styles.css','app.js','config.js?v=oauth-1','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png'].map(p=>new URL(p,scope).href);
const sessions=new Map(),pending=new Map();
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('eunjae-shell-')||k.startsWith('eunjae-drive-shell-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
function remember(clientId,data){
 if(!clientId||data?.type!=='DRIVE_SESSION'||typeof data.sid!=='string'||typeof data.accessToken!=='string'||data.expiresAt<=Date.now()||!Array.isArray(data.files))return false;
 sessions.set(clientId,{sid:data.sid,accessToken:data.accessToken,expiresAt:data.expiresAt,files:new Map(data.files.filter(f=>/^[\w-]+$/.test(f.id)&&Number.isFinite(f.size)&&f.size>0).map(f=>[f.id,f.size]))});return true;
}
self.addEventListener('message',event=>{
 const clientId=event.source?.id,data=event.data;
 if(data?.type==='CLOSE_DRIVE_SESSION'&&sessions.get(clientId)?.sid===data.sid){sessions.delete(clientId);for(const controller of pending.get(clientId)||[])controller.abort();pending.delete(clientId);}
 if(data?.type==='DRIVE_SESSION'){const ok=remember(clientId,data);event.ports[0]?.postMessage({ok});}
});
async function restore(clientId,sid){
 const client=await self.clients.get(clientId);if(!client)return null;
 // Worker processes can be evicted. Recover from the owning page, never storage.
 await new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve();},2500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();remember(clientId,e.data);resolve();};client.postMessage({type:'NEED_DRIVE_SESSION',sid},[channel.port2]);});
 return sessions.get(clientId);
}
async function notify(clientId,sid,code){const client=await self.clients.get(clientId);client?.postMessage({type:'DRIVE_MEDIA_ERROR',sid,code});}
function failure(status){return new Response(null,{status,headers:{'Cache-Control':'no-store'}});}
async function stream(event,url){
 const clientId=event.clientId,sid=url.searchParams.get('session');
 if(!clientId||!sid)return failure(401);
 let session=sessions.get(clientId);if(!session)session=await restore(clientId,sid);
 if(!session||session.sid!==sid||session.expiresAt<=Date.now()){await notify(clientId,sid,'auth-expired');return failure(401);}
 const fileId=url.pathname.slice(new URL('__drive_audio/',scope).pathname.length),size=session.files.get(fileId);
 if(!size)return failure(403);
 const range=event.request.headers.get('Range');
 if(range&&!/^bytes=(\d+-\d*|-\d+)$/.test(range))return failure(416);
 const controller=new AbortController();if(!pending.has(clientId))pending.set(clientId,new Set());pending.get(clientId).add(controller);
 event.request.signal.addEventListener('abort',()=>controller.abort(),{once:true});
 try{
  const upstream=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers:{Authorization:`Bearer ${session.accessToken}`,...(range?{Range:range}:{})},cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!upstream.ok){let code=upstream.status===401?'auth-expired':upstream.status===429?'drive-quota':'drive-error';if(upstream.status===403||upstream.status===404){let reason='';try{reason=(await upstream.clone().json()).error?.errors?.[0]?.reason;}catch{}code=['rateLimitExceeded','userRateLimitExceeded','downloadQuotaExceeded'].includes(reason)?'drive-quota':'permission-denied';}await notify(clientId,sid,code);pending.get(clientId)?.delete(controller);return failure(upstream.status);}
  const headers=new Headers({'Content-Type':'audio/mpeg','Cache-Control':'private, no-store, max-age=0','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'});
  let contentRange=upstream.headers.get('Content-Range');
  // Some CORS configurations don't expose Content-Range. A valid single range
  // and the Drive files.list size suffice to reconstruct it only for a 206.
  if(upstream.status===206&&!contentRange&&range){const [a,b]=range.slice(6).split('-');const start=a?Number(a):Math.max(0,size-Number(b)),end=a?(b?Math.min(Number(b),size-1):size-1):size-1;contentRange=`bytes ${start}-${end}/${size}`;}
  if(contentRange)headers.set('Content-Range',contentRange);
  const length=upstream.headers.get('Content-Length');if(length)headers.set('Content-Length',length);
  const reader=upstream.body.getReader();
  const body=new ReadableStream({async pull(target){try{const {done,value}=await reader.read();if(done){pending.get(clientId)?.delete(controller);target.close();}else target.enqueue(value);}catch(e){pending.get(clientId)?.delete(controller);target.error(e);}},cancel(){controller.abort();pending.get(clientId)?.delete(controller);return reader.cancel().catch(()=>{});}});
  return new Response(body,{status:upstream.status,headers});
 }catch(e){pending.get(clientId)?.delete(controller);if(e.name!=='AbortError')await notify(clientId,sid,'drive-network');return failure(503);}
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==scope.origin)return;
 if(url.pathname.startsWith(new URL('__drive_audio/',scope).pathname)){event.respondWith(event.request.method==='GET'?stream(event,url):failure(405));return;}
 if(event.request.method!=='GET'||!SHELL.includes(url.href))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,clone)));}return response;}).catch(()=>caches.match(event.request).then(hit=>hit||Response.error())));
});

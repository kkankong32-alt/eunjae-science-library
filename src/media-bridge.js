import {sessionCredentials,authError} from './google-auth.js';
let readyPromise,activeSession=null;
const base=()=>new URL('./',document.baseURI);
export function prepareWorker(){
 if(!('serviceWorker'in navigator)||!globalThis.isSecureContext)return Promise.resolve(false);
 if(!readyPromise)readyPromise=(async()=>{
  const ready=(async()=>{
  await navigator.serviceWorker.register(new URL('service-worker.js',base()),{scope:base().pathname,updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('worker-timeout'));},6000);function changed(){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();}navigator.serviceWorker.addEventListener('controllerchange',changed);});
  return !!navigator.serviceWorker.controller;
  })();
  let timer;try{return await Promise.race([ready,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),6000);})]);}finally{clearTimeout(timer);}
 })().catch(()=>false);
 return readyPromise;
}
function send(message){return new Promise((resolve,reject)=>{const worker=navigator.serviceWorker?.controller;if(!worker){reject(Error('no-worker'));return;}const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('worker-timeout'));},3000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();e.data?.ok?resolve():reject(Error('worker-rejected'));};worker.postMessage(message,[channel.port2]);});}
function payload(){return {type:'DRIVE_SESSION',...activeSession,...sessionCredentials()};}
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>{
 if(event.source!==navigator.serviceWorker.controller)return;
 if(event.data?.type==='NEED_DRIVE_SESSION'){
  try{if(activeSession?.sid===event.data.sid)event.ports[0]?.postMessage(payload());else event.ports[0]?.postMessage(null);}catch{event.ports[0]?.postMessage(null);}
 }
 if(event.data?.type==='DRIVE_MEDIA_ERROR'&&event.data.sid===activeSession?.sid)window.dispatchEvent(new CustomEvent('drive-media-error',{detail:authError(event.data.code)}));
});
export async function openDriveSession(books){
 closeDriveSession();activeSession={sid:crypto.randomUUID(),files:books.filter(b=>b.canDownload).map(b=>({id:b.fileId,size:Number(b.size)}))};
 if(!await prepareWorker())return false;
 try{await send(payload());return true;}catch{return false;}
}
export function mediaURL(fileId){if(!activeSession?.files.some(f=>f.id===fileId))throw authError('permission-denied');const url=new URL(`__drive_audio/${encodeURIComponent(fileId)}`,base());url.searchParams.set('session',activeSession.sid);return url.href;}
export function closeDriveSession(){if(activeSession)navigator.serviceWorker?.controller?.postMessage({type:'CLOSE_DRIVE_SESSION',sid:activeSession.sid});activeSession=null;}

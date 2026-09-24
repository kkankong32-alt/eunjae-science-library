import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');
function worker(fetchImpl){const handlers={},messages=[],scope='https://family.github.io/science/';const context={URL,Map,Set,Number,Date,Promise,Headers,Response,ReadableStream,AbortController,setTimeout,clearTimeout,MessageChannel,fetch:fetchImpl,caches:{},self:{registration:{scope},clients:{get:async()=>({postMessage:m=>messages.push(m)})},addEventListener:(type,fn)=>handlers[type]=fn}};vm.runInNewContext(source,context);return {handlers,messages};}
function setSession(w){w.handlers.message({source:{id:'owner'},data:{type:'DRIVE_SESSION',sid:'session',accessToken:'only-memory-token',expiresAt:Date.now()+60000,files:[{id:'file1',size:100}]},ports:[{postMessage(){}}]});}
function request(w,id='file1',clientId='owner',range='bytes=10-19'){let response;w.handlers.fetch({clientId,request:new Request(`https://family.github.io/science/__drive_audio/${id}?session=session`,{headers:{Range:range}}),respondWith:p=>response=p});return response;}
test('Range와 Bearer 헤더로 files.get alt=media 호출, 응답을 캐시하지 않는다',async()=>{
 let called;const w=worker(async(url,options)=>{called={url,options};return new Response(new Uint8Array(10),{status:206,headers:{'Content-Length':'10'}})});setSession(w);const r=await request(w);assert.equal(called.url,'https://www.googleapis.com/drive/v3/files/file1?alt=media');assert.equal(called.options.headers.Authorization,'Bearer only-memory-token');assert.equal(called.options.headers.Range,'bytes=10-19');assert.equal(called.options.cache,'no-store');assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 10-19/100');assert.match(r.headers.get('Cache-Control'),/no-store/);assert.equal((await r.arrayBuffer()).byteLength,10);
});
test('전체 다운로드 완료를 기다리지 않고 응답 스트림을 반환한다',async()=>{
 let controller;const body=new ReadableStream({start(c){controller=c;c.enqueue(new Uint8Array([1]));}});const w=worker(async()=>new Response(body));setSession(w);const response=await request(w);const reader=response.body.getReader();assert.deepEqual([...((await reader.read()).value)],[1]);controller.enqueue(new Uint8Array([2]));controller.close();assert.deepEqual([...((await reader.read()).value)],[2]);await reader.read();
});
test('목록 밖 파일과 클라이언트 없는 요청은 Google API에 전달하지 않는다',async()=>{
 let calls=0;const w=worker(async()=>{calls++;return new Response();});setSession(w);assert.equal((await request(w,'not-listed')).status,403);assert.equal((await request(w,'file1','')).status,401);assert.equal(calls,0);
});
test('잘못된 Range 거부 및 Google의 인증 만료 전달',async()=>{
 const w=worker(async()=>new Response(null,{status:401}));setSession(w);assert.equal((await request(w,'file1','owner','bytes=1-2,4-5')).status,416);assert.equal((await request(w)).status,401);assert.equal(w.messages[0].code,'auth-expired');
});

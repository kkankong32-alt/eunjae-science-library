// Integration fixture: real MP3 bytes, simulated GIS/Drive API; no real OAuth claim.
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';import assert from 'node:assert/strict';
const base='http://127.0.0.1:4174/science-library/';
const originals=JSON.parse(await readFile('.private/library.json','utf8'));
const fixtures=await Promise.all(originals.map(async b=>{const source=path.resolve('../../work/source-audio',b.originalFilename);return {...b,fileId:`drive-${b.id}`,source,size:(await stat(source)).size};}));
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('test-results/drive',{recursive:true});const reports=[];
async function setup({denied=false,expiry=3600,noWorker=false,corruptStream=false}={}){
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:noWorker?'block':'allow'}),calls=[],errors=[];let mediaStatus=200;
 await context.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:`window.LIBRARY_CONFIG={GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_DRIVE_FOLDER_ID:'test-folder',ALLOWED_EMAILS:[],PARENT_EMAILS:[]};`}));
 await context.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'fixture-token',expires_in:${expiry},scope:'openid email profile https://www.googleapis.com/auth/drive.readonly'})}),hasGrantedAllScopes:()=>true},id:{disableAutoSelect(){}}}};`}));
 await context.route('https://www.googleapis.com/**',async route=>{
  const request=route.request(),url=new URL(request.url()),headers=request.headers();calls.push({path:url.pathname,query:url.search,auth:headers.authorization,range:headers.range,worker:!!request.serviceWorker()});
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Range','Access-Control-Expose-Headers':'Content-Range,Content-Length,Accept-Ranges'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(headers.authorization!=='Bearer fixture-token')return route.fulfill({status:401,headers:cors,body:'{}'});
  if(url.pathname.includes('userinfo'))return route.fulfill({contentType:'application/json',headers:cors,json:{sub:'google-child',email:'child@example.test',email_verified:true}});
  if(url.pathname.endsWith('/test-folder'))return route.fulfill({status:denied?403:200,headers:cors,contentType:'application/json',json:denied?{error:{errors:[{reason:'insufficientFilePermissions'}]}}:{id:'test-folder',mimeType:'application/vnd.google-apps.folder'}});
  if(url.pathname.endsWith('/files')){const records=fixtures.map(b=>({id:b.fileId,name:b.originalFilename,mimeType:'audio/mpeg',size:String(b.size),modifiedTime:'2026-09-24T00:00:00Z',capabilities:{canDownload:true}})).reverse();const second=url.searchParams.get('pageToken');return route.fulfill({headers:cors,contentType:'application/json',json:{files:second?records.slice(12):records.slice(0,12),...(second?{}:{nextPageToken:'page2'})}});}
  const book=fixtures.find(b=>url.pathname.endsWith('/'+b.fileId));
  if(book&&url.searchParams.get('alt')==='media'){
   if(mediaStatus!==200)return route.fulfill({status:mediaStatus,headers:cors,contentType:'application/json',json:{error:{errors:[{reason:mediaStatus===403?'insufficientFilePermissions':'authError'}]}}});
   if(corruptStream&&request.serviceWorker())return route.fulfill({status:200,headers:{...cors,'Content-Type':'audio/mpeg'},body:'unsupported-media-fixture'});
   const data=await readFile(book.source);let start=0,end=data.length-1,status=200;
   if(headers.range){const [,a,z]=/^bytes=(\d*)-(\d*)$/.exec(headers.range);start=a?Number(a):Math.max(0,data.length-Number(z));end=a?(z?Math.min(Number(z),end):end):end;status=206;}
   return route.fulfill({status,headers:{...cors,'Content-Type':'audio/mpeg','Content-Length':String(end-start+1),'Accept-Ranges':'bytes',...(status===206?{'Content-Range':`bytes ${start}-${end}/${data.length}`}:{})},body:data.subarray(start,end+1)});
  }
  return route.fulfill({status:404,headers:cors,body:'{}'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>!!globalThis.google?.accounts?.oauth2);if(!noWorker){await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);}
 return {context,page,calls,errors,setMediaStatus:s=>mediaStatus=s};
}
try{
 const {context,page,calls,errors,setMediaStatus}=await setup();
 await page.locator('#login').click();await page.locator('.book-card').last().waitFor();assert.equal(await page.locator('.book-card').count(),fixtures.length);assert.deepEqual(await page.locator('.book-card').evaluateAll(es=>es.map(e=>e.dataset.book)),fixtures.map(b=>b.fileId));
 assert.equal(calls.filter(c=>c.path.endsWith('/files')).length,2);assert.ok(calls.filter(c=>c.path.endsWith('/files')).every(c=>new URLSearchParams(c.query).get('q').includes("mimeType = 'audio/mpeg'")));reports.push('Drive 폴더 접근 확인 후 페이지네이션·실제 MIME 필터·숫자 정렬');
 await page.locator('[data-favorite="drive-001"]').click();await page.locator('[data-play="drive-001"]').last().click();await page.waitForFunction(()=>document.querySelector('#mini-player [data-action="toggle"]').getAttribute('aria-label')==='일시정지');
 const media=calls.filter(c=>c.query.includes('alt=media'));assert.ok(media.some(c=>c.worker&&c.range&&c.auth==='Bearer fixture-token'));assert.ok(!media.some(c=>c.query.includes('fixture-token')));reports.push('실제 MP3를 Service Worker → 인증 헤더 + Range → files.get alt=media로 재생');
 await page.locator('#mini-player [data-action="toggle"]').click();await page.locator('#open-player').click();await page.locator('#full-player .seek').fill('60');await page.locator('#full-player .seek').dispatchEvent('change');await page.waitForTimeout(250);assert.equal(await page.locator('#full-player .current-time').textContent(),'1:00');await page.getByRole('button',{name:'10초 앞으로'}).click();assert.equal(await page.locator('#full-player .current-time').textContent(),'1:10');await page.getByRole('button',{name:'10초 뒤로'}).click();await page.getByRole('button',{name:'플레이어 닫기'}).click();
 await page.reload();await page.waitForFunction(()=>!!globalThis.google?.accounts?.oauth2);await page.locator('#login').click();await page.locator('.book-card').last().waitFor();assert.equal(await page.locator('[data-favorite="drive-001"]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#featured').textContent(),/1:00/);await page.locator('#featured [data-play]').click();await page.waitForFunction(()=>document.querySelector('#mini-player .current-time').textContent.startsWith('1:'));
 await page.locator('#mini-player [data-action="next"]').click();await page.waitForFunction(()=>document.querySelector('#mini-title').textContent.includes('Trees'));await page.locator('#mini-player [data-action="previous"]').click();await page.waitForFunction(()=>document.querySelector('#mini-title').textContent.includes('Dog'));reports.push('재생/일시정지/탐색/±10초/이전·다음/재로그인 이어듣기·즐겨찾기 유지');
 for(const [name,width,height]of [['mobile',375,812],['large-mobile',430,932],['tablet',768,1024],['laptop',1366,768],['desktop',1920,1080]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`test-results/drive/home-${name}.png`});if(name==='mobile'){await page.locator('#open-player').click();await page.screenshot({path:'test-results/drive/player-mobile.png'});await page.getByRole('button',{name:'플레이어 닫기'}).click();}}
 reports.push('5개 화면 크기 가로 넘침 없음, GitHub Pages 하위 경로의 CSS·표지·플레이어·manifest 정상');
 const privateStorage=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!privateStorage.includes('fixture-token'));const keys=await page.evaluate(async()=>{const all=[];for(const n of await caches.keys()){const cache=await caches.open(n);all.push(...(await cache.keys()).map(r=>r.url));}return all;});assert.ok(keys.every(k=>!k.includes('__drive_audio')&&!k.includes('googleapis')));reports.push('토큰 localStorage/URL 저장 없음, 음원 CacheStorage 저장 없음');
 setMediaStatus(401);await page.locator('[data-play="drive-003"]').first().click();await page.waitForFunction(()=>!document.querySelector('#welcome').hidden);assert.match(await page.locator('#welcome-message').textContent(),/다시 로그인/);assert.equal(await page.locator('#books').textContent(),'');reports.push('음원 요청 401 시 기록 보존·목록 제거·재로그인 안내');assert.deepEqual(errors,[]);await context.close();
 const denied=await setup({denied:true});await denied.page.locator('#login').click();await denied.page.locator('#denied').waitFor({state:'visible'});assert.equal(await denied.page.locator('#books').textContent(),'');assert.equal(denied.calls.filter(c=>c.path.endsWith('/files')||c.query.includes('alt=media')).length,0);reports.push('공유 권한 없는 폴더 403 시 책 목록·음원 요청 없음');await denied.context.close();
 for(const options of [{noWorker:true},{corruptStream:true}]){const fallback=await setup(options);await fallback.page.locator('#login').click();await fallback.page.locator('.book-card').last().waitFor();await fallback.page.locator('[data-play="drive-001"]').last().click();await fallback.page.waitForFunction(()=>document.querySelector('#mini-player [data-action="toggle"]').getAttribute('aria-label')==='일시정지');assert.ok(fallback.calls.some(c=>c.query.includes('alt=media')&&!c.worker&&c.auth==='Bearer fixture-token'));assert.deepEqual(fallback.errors,[]);await fallback.context.close();}
 reports.push('Service Worker 차단 / 미디어 스트림 비호환 시 인증된 Blob 경로로 자동 재생');
 await writeFile('test-results/drive/results.json',JSON.stringify({fixture:true,reports},null,2));console.log(reports.join('\n'));
}finally{await browser.close();}

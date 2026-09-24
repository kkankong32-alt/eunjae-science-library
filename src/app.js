import {configured,PARENT_EMAILS} from './config.js';
import * as auth from './google-auth.js';
import * as drive from './drive.js';
import {prepareWorker,openDriveSession,closeDriveSession,mediaURL} from './media-bridge.js';
import {time,listened,localDay} from './core.js';
import {Progress} from './progress.js';
import {Player} from './player.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEMO=__DEMO__ && ['localhost','127.0.0.1'].includes(location.hostname);
let streaming=false,books=[],progress,player,user,filter='all',coverURLs=new Map(),session=0,lastPlaying='',lastFeature='',toastTimer,coverTasks=[];
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function error(e){
 if(e?.code==='permission-denied'){clearSession();auth.clearToken();show('denied');return;}
 if(e?.code==='auth-expired'){clearSession();auth.clearToken();show('welcome');$('welcome-message').textContent='Google 연결 시간이 끝났어요. 다시 로그인하면 듣던 곳부터 이어갈 수 있어요.';return;}
 const messages={'drive-quota':'Google Drive의 이용 한도에 도달했어요. 잠시 후 다시 들어 주세요.','drive-network':'인터넷 연결을 확인한 뒤 책을 다시 선택해 주세요.','local-storage':'이 기기에 기록을 저장하지 못했어요. 브라우저 저장 공간과 설정을 확인해 주세요.'};
 toast(!navigator.onLine?'인터넷 연결을 확인해 주세요. 기록은 이 기기에 보관돼요.':e?.name==='NotAllowedError'?'재생 버튼을 한 번 더 눌러 주세요.':messages[e?.code]||messages[e?.message]||'음원을 불러오지 못했어요. 연결을 확인하고 책을 다시 선택해 주세요.');
}
function show(id){for(const view of ['welcome','loading','denied','library-app'])$(view).hidden=view!==id;}
function clearSession(){session++;closeDriveSession();streaming=false;player?.destroy();progress?.flush();progress?.close();player=null;progress=null;books=[];coverTasks=[];for(const url of coverURLs.values())URL.revokeObjectURL(url);coverURLs.clear();$('books').replaceChildren();$('featured').replaceChildren();$('mini-player').hidden=true;$('full-player').close();$('full-cover').removeAttribute('src');$('mini-cover').removeAttribute('src');$('mini-title').textContent='';$('full-title').textContent='';lastFeature='';lastPlaying='';}
async function source(book,{signal}={}){
 if(__DEMO__ && DEMO)return {url:new URL(`__demo/${book.audioFile}`,document.baseURI).href,dispose(){},mode:'local-range'};
 if(!book.canDownload)throw auth.authError('permission-denied');
 auth.sessionCredentials();
 if(streaming)return {url:mediaURL(book.fileId),dispose(){},mode:'drive-range',fallback:async()=>{toast('이 브라우저에서는 음원을 내려받은 뒤 재생해요. 잠시만 기다려 주세요.');const data=await drive.blob(book.fileId,{signal});const url=URL.createObjectURL(data);return {url,dispose:()=>URL.revokeObjectURL(url),mode:'blob-fallback'};}};
 const blob=await drive.blob(book.fileId,{signal});const url=URL.createObjectURL(blob);
 return {url,dispose:()=>URL.revokeObjectURL(url),mode:'blob-fallback'};
}
async function enter(account){clearSession();user=account;const generation=session;show('loading');
 try{if(!DEMO)await drive.authorize();const result=__DEMO__ && DEMO?await fetch(new URL('__demo/library.json',document.baseURI),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('library');return r.json();}):await drive.library();if(generation!==session)return;books=result;
  if(!DEMO)streaming=await openDriveSession(books);if(generation!==session)return;
  for(const book of books)coverURLs.set(book.id,new URL(book.coverFile,document.baseURI).href);
  progress=new Progress(account.uid,null,()=>{if(player){updateStats();updateCardStates();renderFeatured();}},error);
  player=new Player({books,progress,source,onChange:updatePlayer,onError:error});
  $('account-name').textContent=account.email||'은재의 로컬 라이브러리';$('account-role').textContent=DEMO?'이 브라우저에 학습 기록이 저장됩니다.':PARENT_EMAILS.includes(account.email?.toLowerCase())?'부모 계정 · 이 기기에 기록 저장':'은재 계정 · 이 기기에 기록 저장';$('avatar').hidden=!account.photoURL;$('avatar-text').hidden=!!account.photoURL;if(account.photoURL)$('avatar').src=account.photoURL;
  $('category').innerHTML='<option value="all">모든 주제</option>'+[...new Set(books.map(b=>b.category))].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');filter='all';$('search').value='';$('category').value='all';$('demo-badge').hidden=!DEMO;$('account-menu').hidden=true;
  renderBooks();renderFeatured(true);updateStats();show('library-app');
  if(!DEMO&&!streaming)toast('이 브라우저에서는 음원을 내려받은 뒤 재생해요. 잠시만 기다려 주세요.');
 }catch(e){if(generation!==session)return;clearSession();if(e.code==='permission-denied')show('denied');else{show('welcome');$('welcome-message').textContent='책장을 불러오지 못했어요. 인터넷 연결과 Google Drive 폴더 설정을 확인해 주세요.';}}
}
function image(book,extra=''){const src=coverURLs.get(book.id);return `<img data-cover="${book.id}" ${src?`src="${src}"`:''} alt="${esc(book.title)} 표지" ${extra}>`;}
function visibleBooks(){const q=$('search').value.trim().toLocaleLowerCase(),category=$('category').value;let list=books.filter(b=>{const p=progress.get(b.id);return (!q||b.title.toLocaleLowerCase().includes(q))&&(category==='all'||b.category===category)&&(filter==='all'||filter==='favorites'&&p.favorite||filter==='completed'&&p.completed||filter==='recent'&&p.lastPlayedAt);});if(filter==='recent')list.sort((a,b)=>(progress.get(b.id).lastPlayedAt||0)-(progress.get(a.id).lastPlayedAt||0));return list;}
function renderBooks(){if(!progress)return;const list=visibleBooks();$('book-count').textContent=`${books.length}권`;$('result-message').textContent=`${list.length}권의 책`;
 $('books').innerHTML=list.map(b=>`<article class="book-card" data-book="${b.id}"><button class="cover-button" data-play="${b.id}" aria-label="${esc(b.title)} 듣기">${image(b,'loading="lazy"')}<span class="card-badge" hidden></span></button><div class="book-meta"><span>${esc(b.category)} · ${String(b.order).padStart(2,'0')}</span><span>${b.duration?time(b.duration):'듣기'}</span></div><h3>${esc(b.title)}</h3><div class="card-actions"><button class="listen" data-play="${b.id}" aria-label="${esc(b.title)} 듣기"><span aria-hidden="true">▶</span> 듣기</button><button class="favorite" data-favorite="${b.id}" aria-label="${esc(b.title)} 즐겨찾기" aria-pressed="false">♡</button></div></article>`).join('');
 $('empty').hidden=!!list.length;$('empty-message').textContent=$('search').value?'다른 제목으로 찾아볼까요?':filter==='favorites'?'마음에 드는 책의 하트를 눌러 모아 보세요.':filter==='completed'?'이야기의 90%를 들으면 여기에 모여요.':'첫 번째 이야기를 골라 볼까요?';document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});updateCardStates();}
function updateCardStates(){if(!progress)return;document.querySelectorAll('[data-book]').forEach(card=>{const id=card.dataset.book,p=progress.get(id),active=player?.book?.id===id&&!player.audio.paused;card.classList.toggle('playing',active);const badge=card.querySelector('.card-badge');badge.hidden=!active&&!p.completed;badge.innerHTML=active?'<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span> 재생 중':'✓ 다 들었어요';const fav=card.querySelector('[data-favorite]');fav.textContent=p.favorite?'♥':'♡';fav.setAttribute('aria-pressed',!!p.favorite);});}
function renderFeatured(force=false){if(!progress)return;const recent=[...books].sort((a,b)=>(progress.get(b.id).lastPlayedAt||0)-(progress.get(a.id).lastPlayedAt||0)),b=recent[0];if(!b){$('featured').innerHTML='<div class="featured-copy"><h2>책장을 준비하고 있어요</h2><p>아직 등록된 이야기가 없어요.</p></div>';return;}
 const p=progress.get(b.id),resume=!!p.lastPlayedAt,percent=b.duration?Math.min(100,Math.floor((p.position||0)/b.duration*100)):0,key=`${b.id}:${resume}:${percent}`;if(!force&&lastFeature===key)return;lastFeature=key;
 $('featured').innerHTML=`<div class="featured-copy"><span class="eyebrow">${resume?'CONTINUE YOUR ADVENTURE · 이어 듣기':'LET’S START EXPLORING · 첫 번째 이야기'}</span><h2>${esc(b.title)}</h2><p>${resume?'어제의 호기심을 오늘도 이어가요.':'익숙한 세상 속, 새로운 이야기를 만나 봐요.'}</p><div class="feature-actions"><button class="primary" data-play="${b.id}"><span aria-hidden="true">▶</span> ${resume?'이어서 듣기':'이야기 듣기'}</button>${resume?`<span class="feature-progress">${time(p.position)} / ${b.duration?time(b.duration):'듣기'}<progress value="${percent}" max="100" aria-label="현재 재생 위치"></progress></span>`:`<span class="feature-progress">${esc(b.category)} · ${b.duration?time(b.duration):'듣기'}</span>`}</div></div><div class="featured-art">${image(b)}</div>`;}
function updateStats(){if(!progress)return;const all=Object.values(progress.data),today=all.filter(p=>p.lastPlayedDay===localDay()).length,complete=all.filter(p=>p.completed).length;$('daily-message').textContent=today?`오늘 ${today}개의 이야기를 들었어요!${complete?' · 완료 '+complete+'권':''}`:'작은 발견이 쌓이는 하루';}
function updatePlayer(){if(!player?.book)return;const b=player.book,p=progress.get(b.id),playing=!player.audio.paused,cover=coverURLs.get(b.id);$('mini-player').hidden=false;$('mini-title').textContent=b.title;$('full-title').textContent=b.title;$('mini-category').textContent=player.loading?'음원을 준비하고 있어요…':b.category;$('full-category').textContent=b.category;
 if(cover){$('mini-cover').src=cover;$('full-cover').src=cover;}$('full-status').textContent=player.loading?'이야기를 불러오고 있어요…':p.completed?'✓ 이 이야기를 다 들었어요. 멋진 발견이었어!':'천천히, 은재의 속도로 들어요.';
 document.querySelectorAll('[data-action="toggle"]').forEach(button=>{button.textContent=player.loading?'…':playing?'Ⅱ':'▶';button.setAttribute('aria-label',playing?'일시정지':'재생');button.disabled=player.loading;});
 document.querySelectorAll('[data-action="previous"]').forEach(e=>e.disabled=b.id===books[0]?.id);document.querySelectorAll('[data-action="next"]').forEach(e=>e.disabled=b.id===books.at(-1)?.id);
 const total=Number.isFinite(player.audio.duration)?player.audio.duration:b.duration,current=player.audio.currentTime||0;document.querySelectorAll('.current-time').forEach(e=>e.textContent=time(current));document.querySelectorAll('.duration-time').forEach(e=>e.textContent=time(total));document.querySelectorAll('.seek').forEach(e=>{e.max=total;if(document.activeElement!==e)e.value=current;e.style.setProperty('--seek',`${total?current/total*100:0}%`);e.setAttribute('aria-valuetext',`${time(current)} / ${time(total)}`);e.disabled=player.loading;});
 for(const id of ['mini-favorite','full-favorite']){$(id).textContent=p.favorite?'♥':'♡';$(id).setAttribute('aria-pressed',!!p.favorite);}const state=`${b.id}:${playing}`;if(state!==lastPlaying){lastPlaying=state;updateCardStates();}
 if('mediaSession'in navigator){navigator.mediaSession.playbackState=playing?'playing':'paused';if(Number.isFinite(total)&&total>0)try{navigator.mediaSession.setPositionState({duration:total,position:Math.min(current,total),playbackRate:1});}catch{}}
}
function favorite(id){if(!progress)return;const next=!progress.get(id).favorite;progress.set(id,{favorite:next});progress.flush();if(filter==='favorites')renderBooks();updatePlayer();toast(next?'즐겨찾기에 담았어요.':'즐겨찾기에서 꺼냈어요.');}
document.addEventListener('click',event=>{const play=event.target.closest('[data-play]');if(play)player?.select(books.find(b=>b.id===play.dataset.play));const fav=event.target.closest('[data-favorite]');if(fav)favorite(fav.dataset.favorite);const tab=event.target.closest('[data-filter]');if(tab){filter=tab.dataset.filter;renderBooks();}const action=event.target.closest('[data-action]')?.dataset.action;if(action&&player){if(action==='toggle')player.toggle();if(action==='previous')player.step(-1);if(action==='next')player.step(1);if(action==='back')player.seek(player.audio.currentTime-10);if(action==='forward')player.seek(player.audio.currentTime+10);}if(!event.target.closest('.header-tools'))$('account-menu').hidden=true;});
$('search').addEventListener('input',renderBooks);$('category').addEventListener('change',renderBooks);$('reset-filters').onclick=()=>{filter='all';$('search').value='';$('category').value='all';renderBooks();};
$('profile').onclick=()=>{$('account-menu').hidden=!$('account-menu').hidden;$('profile').setAttribute('aria-expanded',!$('account-menu').hidden);};
document.querySelector('.brand').onclick=e=>{e.preventDefault();$('reset-filters').click();window.scrollTo({top:0,behavior:'smooth'});};
$('open-player').onclick=()=>{$('full-player').showModal();updatePlayer();};$('full-player').addEventListener('click',e=>{if(e.target===$('full-player')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
for(const id of ['mini-favorite','full-favorite'])$(id).onclick=()=>player?.book&&favorite(player.book.id);
document.querySelectorAll('.seek').forEach(e=>{e.addEventListener('input',()=>{player?.seek(Number(e.value));});e.addEventListener('change',()=>progress?.flush());});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('library-app').hidden){e.preventDefault();$('search').focus();}if(e.key==='Escape')$('account-menu').hidden=true;});
async function signIn(){
 $('login').disabled=true;$('welcome-message').textContent='';
 try{
  if(!configured){$('welcome-message').textContent='보호자가 Google 로그인 설정과 Drive 폴더 ID를 입력하면 시작할 수 있어요.';return;}
  const account=await auth.login();await enter(account);
 }catch(e){
  if(e.code==='permission-denied'){show('denied');return;}
  const messages={'popup_closed':'로그인 창을 닫았어요. 준비되면 다시 시작해 주세요.','popup_failed_to_open':'브라우저에서 팝업을 허용한 다음 다시 눌러 주세요.','access_denied':'Google Drive 읽기 권한을 허용해야 이야기를 들을 수 있어요.','scope-denied':'Google Drive 읽기 권한을 허용해야 이야기를 들을 수 있어요.','google-loading':'Google 로그인을 준비하고 있어요. 잠시 후 다시 눌러 주세요.'};
  $('welcome-message').textContent=messages[e.code]||'Google 로그인에 연결하지 못했어요. 인터넷 연결과 로그인 설정을 확인해 주세요.';
  if(e.code==='google-loading')auth.prepareGoogle().catch(()=>{});
 }finally{$('login').disabled=false;}
}
$('login').onclick=signIn;$('demo').hidden=!DEMO;$('demo').onclick=()=>enter({uid:'local-demo',email:'로컬 체험'});
async function leave(){player?.save();await progress?.flush();clearSession();auth.logout();show('welcome');}
$('logout').onclick=()=>leave().catch(()=>toast('로그아웃을 마치지 못했어요. 다시 눌러 주세요.'));$('switch-account').onclick=async()=>{await leave();if(DEMO)return;await signIn();};
function connection(){$('connection').hidden=navigator.onLine;}
window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});$('install').onclick=async()=>{await installPrompt?.prompt();installPrompt=null;$('install').hidden=true;};
auth.onSessionExpired(()=>error(auth.authError('auth-expired')));
window.addEventListener('drive-media-error',event=>error(event.detail));
if(!DEMO&&configured)auth.prepareGoogle().catch(()=>{$('welcome-message').textContent='Google 로그인에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';});
prepareWorker();

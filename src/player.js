import {mergeRanges,listened,localDay} from './core.js';
export class Player {
 constructor({books,progress,source,onChange,onError}){Object.assign(this,{books,progress,source,onChange,onError});this.audio=new Audio();this.audio.preload='metadata';this.generation=0;this.previous=null;this.lastSaved=0;
  this.audio.addEventListener('timeupdate',()=>{this.collect();this.onChange();if(Date.now()-this.lastSaved>15000)this.save();});
  this.audio.addEventListener('seeking',()=>{this.previous=null;});
  this.audio.addEventListener('seeked',()=>{this.previous=this.audio.currentTime;this.save();});
  for(const name of ['play','pause','ended','loadedmetadata','durationchange'])this.audio.addEventListener(name,()=>{if(name==='pause'||name==='ended'){this.collect();this.save();this.progress.flush();}this.onChange();});
  this.audio.addEventListener('error',()=>{if(this.audio.src&&!this.loading){this.failed=true;this.onError(new Error('audio'));}});
  this.visibility=()=>{if(document.hidden){this.collect();this.save();this.progress.flush();}};document.addEventListener('visibilitychange',this.visibility);window.addEventListener('pagehide',this.visibility);
  if('mediaSession'in navigator){for(const [name,fn]of Object.entries({play:()=>this.play(),pause:()=>this.audio.pause(),previoustrack:()=>this.step(-1),nexttrack:()=>this.step(1),seekbackward:()=>this.seek(this.audio.currentTime-10),seekforward:()=>this.seek(this.audio.currentTime+10),seekto:d=>this.seek(d.seekTime)}))try{navigator.mediaSession.setActionHandler(name,fn);}catch{}}
 }
 collect(){if(!this.book||this.loading)return;const current=this.audio.currentTime;if(!this.audio.seeking&&this.previous!==null&&current>this.previous&&current-this.previous<2){this.ranges=mergeRanges([...this.ranges,[this.previous,current]]);}this.previous=current;}
 save(){if(!this.book||this.loading)return;this.ranges=mergeRanges([...this.ranges,...(this.progress.get(this.book.id).ranges||[])]);const total=Number.isFinite(this.audio.duration)?this.audio.duration:this.book.duration;this.progress.set(this.book.id,{position:this.audio.currentTime,ranges:this.ranges,completed:this.progress.get(this.book.id).completed||(total>0&&listened(this.ranges)>=total*.9),lastPlayedAt:Date.now(),lastPlayedDay:localDay()});this.lastSaved=Date.now();}
 async select(book){if(this.book?.id===book.id&&!this.loading&&this.audio.src&&!this.failed){return this.toggle();}this.collect();this.save();this.progress.flush();const token=++this.generation;this.abort?.abort();this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.transport?.dispose();this.transport=null;this.abort=new AbortController();this.book=book;this.loading=true;this.failed=false;this.previous=null;this.ranges=this.progress.get(book.id).ranges||[];this.onChange();
  try{const transport=await this.source(book,{signal:this.abort.signal});if(token!==this.generation){transport.dispose();return;}this.transport=transport;try{await this.loadTransport(transport);}catch(e){
    if(token!==this.generation||this.abort.signal.aborted)throw e;
    if(!transport.fallback)throw e;
    this.audio.removeAttribute('src');this.audio.load();transport.dispose();
    const fallback=await transport.fallback();if(token!==this.generation){fallback.dispose();return;}
    this.transport=fallback;await this.loadTransport(fallback);
   };if(token!==this.generation)return;this.loading=false;const p=this.progress.get(book.id);const duration=Number.isFinite(this.audio.duration)?this.audio.duration:book.duration;if(duration>0)book.duration=duration;this.audio.currentTime=p.position>=duration-1?0:Math.min(p.position||0,duration||0);this.progress.set(book.id,{playCount:(p.playCount||0)+1,lastPlayedAt:Date.now(),lastPlayedDay:localDay()});
   if('mediaSession'in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:book.title,artist:'은재의 Dr. Seuss Science Library'});await this.play();
  }catch(e){if(token===this.generation){this.loading=false;this.failed=true;this.onChange();this.onError(e);}}
 }
 loadTransport(transport){return new Promise((resolve,reject)=>{const signal=this.abort.signal;const timer=setTimeout(()=>fail(),transport.mode==='drive-range'?12000:30000);const clean=()=>{clearTimeout(timer);this.audio.removeEventListener('loadedmetadata',ok);this.audio.removeEventListener('error',fail);signal.removeEventListener('abort',fail);};const ok=()=>{clean();resolve();};const fail=()=>{clean();reject(new Error('audio'));};this.audio.addEventListener('loadedmetadata',ok);this.audio.addEventListener('error',fail);signal.addEventListener('abort',fail,{once:true});this.audio.src=transport.url;});}
 async play(){const generation=this.generation;try{await this.audio.play();}catch(e){if(generation===this.generation&&e.name!=='AbortError')this.onError(e);}}
 toggle(){if(this.loading)return;if((!this.audio.src||this.failed)&&this.book)return this.select(this.book);this.audio.paused?this.play():this.audio.pause();}
 seek(t){if(!this.book||this.loading)return;this.collect();this.previous=null;this.audio.currentTime=Math.max(0,Math.min(this.audio.duration||this.book.duration,t));this.save();this.onChange();}
 step(delta){const i=this.books.findIndex(b=>b.id===this.book?.id),next=this.books[i+delta];if(next)this.select(next);}
 destroy(){this.collect();this.save();++this.generation;this.abort?.abort();this.book=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.transport?.dispose();document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.visibility);if('mediaSession'in navigator){navigator.mediaSession.metadata=null;for(const n of ['play','pause','previoustrack','nexttrack','seekbackward','seekforward','seekto'])navigator.mediaSession.setActionHandler(n,null);}}
}


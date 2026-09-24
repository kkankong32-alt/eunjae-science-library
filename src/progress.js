import {combine} from './core.js';
// A small adapter boundary for adding optional device sync in the future.
export class LocalProgressStore {
 constructor(key){this.key=key;}
 read(){const raw=JSON.parse(localStorage.getItem(this.key)||'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}
 write(data){localStorage.setItem(this.key,JSON.stringify(data));}
}
export class Progress {
 constructor(uid,_unused,onChange,onError,store=new LocalProgressStore(`eunjae-progress:${uid}`)){
  Object.assign(this,{uid,onChange,onError,store});this.key=store.key;this.closed=false;
  try{this.data=store.read();}catch{this.data={};onError(new Error('local-storage'));}
  this.onStorage=event=>{if(event.key!==this.key||this.closed)return;try{for(const [id,p]of Object.entries(store.read()))this.data[id]=combine(this.data[id],p);onChange();}catch{onError(new Error('local-storage'));}};
  window.addEventListener('storage',this.onStorage);
 }
 get(id){return this.data[id]||{position:0,ranges:[],favorite:false,completed:false,playCount:0};}
 set(id,patch){this.data[id]={...this.get(id),...patch,updatedAt:Date.now()};this.persist();this.onChange();}
 persist(){try{this.store.write(this.data);}catch{this.onError(new Error('local-storage'));}}
 async flush(){if(!this.closed)this.persist();}
 close(){this.closed=true;window.removeEventListener('storage',this.onStorage);}
}

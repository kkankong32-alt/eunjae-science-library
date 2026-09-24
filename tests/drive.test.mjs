import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapFiles} from '../src/library.js';
import {LocalProgressStore,Progress} from '../src/progress.js';
const file=(id,name,mimeType='audio/mpeg')=>({id,name,mimeType,size:'1000',modifiedTime:'2026-09-24T00:00:00Z'});
test('실제 반환 파일을 숫자로 정렬하고 mimeType으로 거른다',()=>{
 const books=mapFiles([file('ten','10 ten.mp3'),file('two','2 two.mp3'),file('one','1 one.mp3'),file('png','3 image.mp3','image/png')],[]);
 assert.deepEqual(books.map(b=>b.fileId),['one','two','ten']);assert.equal(books[0].size,'1000');assert.equal(books[0].modifiedTime,'2026-09-24T00:00:00Z');
});
test('번호와 파일명이 바뀌어도 파일 ID로 기록을 식별한다',()=>{
 assert.equal(mapFiles([file('stable-id','99 renamed.mp3')],[])[0].id,'stable-id');
});
test('표지 목록이 Drive에 없는 파일을 만들지 않는다',()=>{
 const catalog=[{originalFilename:'1 one.mp3',title:'Original title',duration:60,category:'자연',coverFile:'covers/001.svg'},{originalFilename:'missing.mp3',title:'Not in Drive'}];
 const books=mapFiles([file('one','1 one.mp3'),file('new','2 new.mp3')],catalog);assert.equal(books.length,2);assert.equal(books[0].title,'Original title');assert.equal(books[1].coverFile,'covers/discovery.svg');assert.equal(mapFiles([],catalog).length,0);
});
test('계정별 로컬 기록 격리, 다시 읽기 및 손상 데이터 복구',()=>{
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};globalThis.window={addEventListener(){},removeEventListener(){}};
 const errors=[],one=new Progress('child',null,()=>{},e=>errors.push(e));one.set('file1',{favorite:true,position:60});one.close();const reopened=new Progress('child',null,()=>{},e=>errors.push(e)),parent=new Progress('parent',null,()=>{},e=>errors.push(e));assert.equal(reopened.get('file1').position,60);assert.equal(reopened.get('file1').favorite,true);assert.equal(parent.get('file1').favorite,false);
 values.set('eunjae-progress:broken','not json');const broken=new Progress('broken',null,()=>{},e=>errors.push(e));assert.equal(broken.get('x').position,0);assert.equal(errors.length,1);reopened.close();parent.close();broken.close();
});

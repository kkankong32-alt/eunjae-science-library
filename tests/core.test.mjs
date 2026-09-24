import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeRanges,listened,combine,time} from '../src/core.js';
test('반복 청취는 중복 합산하지 않고 떨어진 구간은 보존한다',()=>{assert.deepEqual(mergeRanges([[0,10],[5,15],[25,30]]),[[0,15],[25,30]]);assert.equal(listened([[0,10],[0,10],[90,100]]),20);});
test('탐색으로 마지막에 도착해도 완료하지 않는다',()=>{assert.equal(listened([[0,5],[95,100]])>=100*.9,false);assert.equal(listened([[0,50],[50,90]])>=100*.9,true);});
test('다른 기기의 구간 병합 및 최신 즐겨찾기 보존',()=>{const p=combine({ranges:[[0,50]],favorite:true,completed:true,updatedAt:20,playCount:3},{ranges:[[45,80]],favorite:false,updatedAt:10,playCount:1});assert.equal(p.favorite,true);assert.equal(p.completed,true);assert.equal(p.playCount,3);assert.equal(listened(p.ranges),80);});
test('시간 포맷',()=>{assert.equal(time(629),'10:29');assert.equal(time(NaN),'0:00');});

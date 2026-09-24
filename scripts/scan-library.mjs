import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
const root = path.resolve(process.argv[2] || '../../work/source-audio');
async function walk(dir) { return (await readdir(dir,{withFileTypes:true})).filter(e=>e.isFile()).map(e=>path.join(dir,e.name)); }
const corrections={ 'who hatches the wgg':'Who Hatches the Egg?', 'my oh my a butterly':'My, Oh My — a Butterfly!', 'one vote tow votes i vote you vote':'One Vote, Two Votes, I Vote, You Vote', 'one cent tow cents':'One Cent, Two Cents', "oh say can yay what's the weather today":"Oh Say Can You Say What's the Weather Today?" };
const topics=[[/dog|pup|cat|pets|horse|safari|camel|mammal/,'동물','animals'],[/tree|seed|rain forest/,'자연','plants'],[/pollywog|hatches|butter|bugs|sight/,'작은 생명','little'],[/clam|whale|fish|shark/,'바다','ocean'],[/space/,'우주','space'],[/weather|high low/,'날씨','weather'],[/desert|ice|map/,'지구','earth'],[/di-no|dino|mastodon|reptile|feather/,'동물','animals'],[/inside/,'우리 몸','body'],[/invent/,'발명','invention'],[/vote|cent/,'세상 이야기','world']];
const files=(await walk(root)).filter(p=>/\.mp3$/i.test(p)).sort((a,b)=>path.basename(a).localeCompare(path.basename(b),'en',{numeric:true}));
if(!files.length) throw new Error('지정한 폴더에 MP3가 없습니다.');
const library=[];
for (const [index,file] of files.entries()) {
 const name=path.basename(file),raw=name.replace(/\.mp3$/i,'').replace(/^\d+[ ._-]*/, '').trim();
 const title=corrections[raw.toLowerCase()]||raw.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
 const topic=topics.find(([re])=>re.test(raw.toLowerCase()))||[null,'탐험','earth'];
 const meta=await parseFile(file,{duration:true});
 if(!Number.isFinite(meta.format.duration)) throw new Error(`음원 길이 확인 실패: ${name}`);
 const id=String(index+1).padStart(3,'0');
 library.push({id,order:Number(name.match(/^\d+/)?.[0]||index+1),title,displayTitle:title,bookTitle:title,bookTitleNote:'파일명에서 유추한 제목이며 출판사 서지 정보로 검증하지 않았습니다.',originalFilename:name,sourcePath:file,audioFile:`audio/${id}.mp3`,coverFile:`covers/${id}.svg`,duration:Math.round(meta.format.duration*100)/100,category:topic[1],theme:topic[2],categoryNote:'파일명 주제에 근거한 분류'});
}
await mkdir('.private',{recursive:true});
await writeFile('.private/library.json',JSON.stringify(library,null,2));
await writeFile('.private/scan-report.md','# 실제 MP3 조사 결과\n\n총 '+library.length+'개. 원본 파일명은 변경하지 않았습니다. 관련 책 제목과 분류는 파일명에서 추정했습니다.\n\n|번호|실제 파일명|표시/관련 책 제목|분류|길이(초)|경로|\n|---|---|---|---|---|---|\n'+library.map(b=>`|${b.order}|${b.originalFilename}|${b.title}|${b.category}|${b.duration}|${b.sourcePath}|`).join('\n'));
console.log(`${library.length}개 조사 완료. ${Math.round(library.reduce((s,b)=>s+b.duration,0)/60)}분. .private/library.json`);


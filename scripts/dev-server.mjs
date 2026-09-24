import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {buildApp} from './build.mjs';
const production=process.argv.includes('--production');await buildApp(!production);
const publicRoot=path.resolve(production?'dist':'.demo-dist'),port=Number(process.env.PORT||4173),base=process.env.BASE_PATH||'/';
if(!base.startsWith('/')||!base.endsWith('/'))throw Error('BASE_PATH needs leading and trailing slashes');
const books=production?[]:JSON.parse(await readFile('.private/library.json','utf8'));
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');if(!url.pathname.startsWith(base)){res.writeHead(404).end();return;}
 let relative=decodeURIComponent(url.pathname.slice(base.length))||'index.html';
 if(relative==='__demo/library.json'&&!production){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(books.map(({sourcePath,...book})=>book)));return;}
 if(relative.startsWith('__demo/')&&!production){const book=books.find(b=>`__demo/${b.audioFile}`===relative);if(!book){res.writeHead(404).end();return;}
  // Read the original source file in place; never copy MP3 into the project.
  const filename=book.sourcePath,size=(await stat(filename)).size;let start=0,end=size-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416).end();return;}start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}status=206;}
  res.writeHead(status,{'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'private, no-store',...(status===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(filename,{start,end});res.on('close',()=>stream.destroy());stream.pipe(res);return;
 }
 const target=path.resolve(publicRoot,relative);if(!target.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
 const data=await readFile(target),type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(target)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(data);
 }catch{res.writeHead(404).end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}${base} (${production?'PRODUCTION':'LOCAL DEMO'})`));

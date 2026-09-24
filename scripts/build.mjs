import {build} from 'esbuild';
import {mkdir,cp,readFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
export async function buildApp(demo=false){const out=demo?'.demo-dist':'dist';const resolved=path.resolve(out);if(path.dirname(resolved)!==process.cwd()||!['dist','.demo-dist'].includes(path.basename(resolved)))throw Error('Unsafe build path');await rm(resolved,{recursive:true,force:true});await mkdir(out,{recursive:true});await cp('public',out,{recursive:true});await build({entryPoints:['src/app.js'],bundle:true,format:'esm',outfile:`${out}/app.js`,minify:!demo,define:{__DEMO__:String(demo)},splitting:false});
 async function inspect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())await inspect(name);else if(/\.(mp3|dab|dp)$/i.test(name)||/library\.json|scan-report|credentials|service-account/i.test(name))throw Error(`배포 금지 파일: ${name}`);}}
 await inspect(out);if(!demo){const js=await readFile('dist/app.js','utf8');if(js.includes('__demo/'))throw Error('배포 파일에 DEMO 경로가 있습니다.');if(/firebase(storage|app|io)|firestore/i.test(js))throw Error('Firebase reference in production bundle');}console.log(demo?'로컬 DEMO 빌드 완료':'PRODUCTION 빌드 완료: Firebase·음원·DEMO 경로 없음');}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve('scripts/build.mjs'))await buildApp(false);

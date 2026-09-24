export const naturalFiles=(a,b)=>{
 const an=Number(a.name.match(/^\s*(\d+)/)?.[1]??Infinity),bn=Number(b.name.match(/^\s*(\d+)/)?.[1]??Infinity);
 return (an-bn)||a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id);
};
export function mapFiles(files,catalog){
 const byName=new Map(catalog.map(b=>[b.originalFilename,b]));
 return files.filter(f=>f.mimeType==='audio/mpeg'&&!f.trashed).sort(naturalFiles).map((f,index)=>{
  const known=byName.get(f.name),title=known?.title||f.name.replace(/\.mp3$/i,'').replace(/^\s*\d+[ ._-]*/,'').trim();
  return {id:f.id,fileId:f.id,name:f.name,mimeType:f.mimeType,size:f.size,modifiedTime:f.modifiedTime,
   order:Number(f.name.match(/^\s*(\d+)/)?.[1]||index+1),title,displayTitle:title,originalFilename:f.name,
   category:known?.category||'탐험',duration:known?.duration||0,coverFile:known?.coverFile||'covers/discovery.svg',
   audioFile:f.id,canDownload:f.capabilities?.canDownload!==false};
 });
}

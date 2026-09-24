import {GOOGLE_DRIVE_FOLDER_ID} from './config.js';
import {authenticatedFetch,authError} from './google-auth.js';
import {mapFiles} from './library.js';
const API='https://www.googleapis.com/drive/v3/files';
export async function authorize(){
 const params=new URLSearchParams({fields:'id,mimeType,trashed',supportsAllDrives:'true'});
 const folder=await authenticatedFetch(`${API}/${encodeURIComponent(GOOGLE_DRIVE_FOLDER_ID)}?${params}`).then(r=>r.json());
 if(folder.trashed||folder.mimeType!=='application/vnd.google-apps.folder')throw authError('folder-invalid');
}
export async function library(){
 const files=[],seen=new Set();let pageToken='';
 do {const params=new URLSearchParams({q:`'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false and mimeType = 'audio/mpeg'`,fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,size,modifiedTime,capabilities(canDownload))',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)params.set('pageToken',pageToken);
  const page=await authenticatedFetch(`${API}?${params}`).then(r=>r.json());if(page.incompleteSearch)throw authError('drive-incomplete');
  for(const file of page.files||[])if(!seen.has(file.id)){seen.add(file.id);files.push(file);}pageToken=page.nextPageToken||'';
 }while(pageToken);
 const response=await fetch(new URL('./data/cover-catalog.json',document.baseURI));if(!response.ok)throw authError('cover-catalog');
 return mapFiles(files,await response.json());
}
// Compatibility fallback only. Normal playback uses the worker's Range stream.
export async function blob(fileId,{signal}={}){
 return (await authenticatedFetch(`${API}/${encodeURIComponent(fileId)}?alt=media`,{signal})).blob();
}

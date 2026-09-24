import {GOOGLE_CLIENT_ID,ALLOWED_EMAILS} from './config.js';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
let accessToken='',expiresAt=0,expiryTimer,tokenClient,loadPromise,onExpired=()=>{};
export const authError=(code,message=code)=>Object.assign(new Error(message),{code});
export function onSessionExpired(callback){onExpired=callback;}
export function sessionCredentials(){if(!accessToken||Date.now()>=expiresAt)throw authError('auth-expired');return {accessToken,expiresAt};}
export function clearToken(){clearTimeout(expiryTimer);accessToken='';expiresAt=0;}
export function expire(){if(accessToken){clearToken();onExpired();}}
export function prepareGoogle(){
 if(globalThis.google?.accounts?.oauth2)return Promise.resolve();
 if(!loadPromise)loadPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;const timer=setTimeout(()=>{loadPromise=null;script.remove();reject(authError('google-load'));},15000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);loadPromise=null;script.remove();reject(authError('google-load'));};document.head.append(script);});
 return loadPromise;
}
// GIS is preloaded so the click still has user activation when opening the popup.
export function login(){
 if(!globalThis.google?.accounts?.oauth2)return Promise.reject(authError('google-loading'));
 return new Promise((resolve,reject)=>{
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:`openid email profile ${DRIVE_SCOPE}`,include_granted_scopes:false,
   error_callback:e=>reject(authError(e.type||'google-login')),
   callback:async response=>{try{
    if(response.error)throw authError(response.error);
    if(!google.accounts.oauth2.hasGrantedAllScopes(response,DRIVE_SCOPE))throw authError('scope-denied');
    accessToken=response.access_token;expiresAt=Date.now()+Math.max(0,Number(response.expires_in||3600)-30)*1000;
    const profile=await authenticatedFetch('https://www.googleapis.com/oauth2/v3/userinfo').then(r=>r.json());
    if(!profile.sub||!profile.email_verified)throw authError('permission-denied');
    if(ALLOWED_EMAILS.length&&!ALLOWED_EMAILS.includes(profile.email?.toLowerCase()))throw authError('permission-denied');
    clearTimeout(expiryTimer);expiryTimer=setTimeout(expire,Math.max(0,expiresAt-Date.now()));
    resolve({uid:profile.sub,email:profile.email,photoURL:profile.picture||'',name:profile.name||'은재'});
   }catch(e){clearToken();reject(e);}}
  });
  tokenClient.requestAccessToken({prompt:'select_account'});
 });
}
export async function authenticatedFetch(url,options={}){
 const {accessToken}=sessionCredentials();
 const response=await fetch(url,{...options,credentials:'omit',cache:'no-store',headers:{...options.headers,Authorization:`Bearer ${accessToken}`}});
 if(response.status===401){expire();throw authError('auth-expired');}
 if(!response.ok){let reason='';try{reason=(await response.clone().json()).error?.errors?.[0]?.reason||'';}catch{}
  if(response.status===429||['rateLimitExceeded','userRateLimitExceeded','downloadQuotaExceeded'].includes(reason))throw authError('drive-quota');
  if(response.status===403||response.status===404)throw authError('permission-denied');
  throw authError('drive-error');
 }
 return response;
}
export function logout(){clearToken();globalThis.google?.accounts?.id?.disableAutoSelect?.();}

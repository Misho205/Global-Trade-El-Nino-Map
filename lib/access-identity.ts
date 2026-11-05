import {BillingError} from './billing-policy.ts';
type Settings = Record<string,unknown>;
type AccessKey=JsonWebKey & {kid?:string};
let keyCache:{issuer:string;until:number;keys:AccessKey[]}|null=null;
export function accessIssuer(settings:Settings){
 const team=String(settings.ACCESS_TEAM_DOMAIN||'');
 if(!/^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(team))throw new BillingError(503,'Account sign-in is not configured.');
 return 'https://'+team;
}
function decode(part:string){return Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function verifyAccessJWT(token:string,issuer:string,audience:string,keys:AccessKey[],now=Date.now()){
 try{
  if(token.length>16000)throw Error();const pieces=token.split('.');if(pieces.length!==3)throw Error();
  const header=JSON.parse(new TextDecoder().decode(decode(pieces[0]))),claims=JSON.parse(new TextDecoder().decode(decode(pieces[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error();
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error();
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1])))throw Error();
  if(claims.iss!==issuer||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now/1000||claims.exp>now/1000+86400*31||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now/1000+30))||typeof claims.sub!=='string'||claims.sub.length>200||!claims.sub||typeof claims.email!=='string'||claims.email.length>254||!claims.email.includes('@'))throw Error();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(issuer+'\0'+claims.sub));
  return {id:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),email:claims.email};
 }catch{throw new BillingError(401,'Sign in through the configured Cloudflare Access application.');}
}
export async function accountIdentity(request:Request,settings:Settings){
 const issuer=accessIssuer(settings),audience=String(settings.ACCESS_AUD||'');if(!audience)throw new BillingError(503,'Account sign-in is not configured.');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)throw new BillingError(401,'Sign in to access your account.');
 if(!keyCache||keyCache.issuer!==issuer||keyCache.until<Date.now()){
  const response=await fetch(issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new BillingError(503,'Sign-in verification temporarily unavailable.');
  const body:any=await response.json();if(!Array.isArray(body.keys))throw new BillingError(503,'Sign-in verification temporarily unavailable.');
  keyCache={issuer,until:Date.now()+300000,keys:body.keys};
 }
 return verifyAccessJWT(token,issuer,audience,keyCache.keys);
}

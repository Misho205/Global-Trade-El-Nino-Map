import {BillingError} from './billing-policy.ts';
export function auth0Configuration(s:Record<string,unknown>){
 if(s.AUTH_PROVIDER!=='auth0')return null;
 // Pilot only until stateful revocation, verified migration and hosted E2E are delivered.
 if(s.ATLAS_ENVIRONMENT!=='staging')throw new BillingError(503,'Auth0 pilot is restricted to staging.');
 const domain=String(s.AUTH0_DOMAIN||'');
 if(!/^[a-z0-9][a-z0-9.-]*\.auth0\.com$/.test(domain)||domain.includes('..'))throw new BillingError(503,'Invalid Auth0 tenant domain.');
 const clientID=String(s.AUTH0_CLIENT_ID||''),clientSecret=String(s.AUTH0_CLIENT_SECRET||''),secret=String(s.AUTH0_SESSION_ENCRYPTION_KEY||'');
 if(!clientID||!clientSecret||secret.length<64)throw new BillingError(503,'Auth0 is not configured.');
 let baseURL:string;
 try{const u=new URL(String(s.PUBLIC_APP_URL||''));if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error();baseURL=u.origin;}catch{throw new BillingError(503,'Canonical HTTPS origin required.');}
 return {domain,clientID,clientSecret,baseURL,authRequired:false,idpLogout:true,authorizationParams:{scope:'openid profile email',response_type:'code' as const,response_mode:'query' as const},session:{secret,rolling:true,absoluteDuration:28800,inactivityDuration:1800,cookie:{name:'__Host-atlas-session',sameSite:'lax' as const,secure:true}}};
}
export async function auth0Account(user:unknown,domain:string){
 const u=user as {sub?:unknown;email?:unknown;email_verified?:unknown}|undefined;
 if(!u||typeof u.sub!=='string'||!u.sub||u.sub.length>200||typeof u.email!=='string'||u.email.length>254||!u.email.includes('@')||u.email_verified!==true)throw new BillingError(401,'Sign in with a verified email address.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('https://'+domain+'/\0'+u.sub));
 return {id:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),email:u.email};
}
export function customerAuthPath(path:string){return path==='/account'||path==='/account/security'||path.startsWith('/api/v1/account/')||path==='/organizations'||path.startsWith('/api/v1/organizations')||path.startsWith('/auth/')||path==='/api/billing/status'||path==='/api/billing/checkout'||path==='/api/billing/portal'||path.startsWith('/api/pro/');}

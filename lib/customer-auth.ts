import {D1AuthSessionStore} from './auth-session-store';
import {AsyncLocalStorage} from 'node:async_hooks';
import {Hono} from 'hono';
import {auth,type OIDCEnv} from '@auth0/auth0-hono';
import {auth0Configuration,auth0Account,customerAuthPath} from './auth0-policy';
type Identity={id:string;email:string};
const identities=new AsyncLocalStorage<Identity|undefined>();
export const currentAuth0Identity=()=>identities.getStore();
export async function withCustomerAuth(request:Request,settings:Record<string,unknown>,next:()=>Promise<Response>):Promise<Response>{
 const path=new URL(request.url).pathname;
 if(settings.AUTH_PROVIDER!=='auth0'||!customerAuthPath(path))return next();
 try{
  const config=auth0Configuration(settings)!;
  // Per-request SDK instance prevents cross-environment configuration capture.
  const app=new Hono<OIDCEnv>();
  if(!settings.DB)throw Error('Session storage unavailable');
  app.use('*',auth({...config,session:{...config.session,store:new D1AuthSessionStore(settings.DB as D1Database,'https://'+config.domain+'/')}}));
  app.all('*',async c=>{
   const session=await c.var.auth0Client?.getSession(c);
   if(!session?.user){
    if(path==='/account'||path==='/account/security'||path==='/organizations')return c.redirect('/auth/login?returnTo='+encodeURIComponent(path));
    return c.json({error:'Sign in required.'},401);
   }
   const identity=await auth0Account(session.user,config.domain);
   return identities.run(identity,next);
  });
  app.onError(()=>Response.json({error:'Sign-in service unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}}));
  const response=await app.fetch(request,{});
  response.headers.set('Cache-Control','no-store');return response;
 }catch{return Response.json({error:'Sign-in service is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

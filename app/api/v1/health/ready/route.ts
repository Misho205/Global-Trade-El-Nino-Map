import {env} from 'cloudflare:workers';
import {databaseReady} from '@/lib/readiness';
import {auth0Configuration} from '@/lib/auth0-policy';
import {billingJobsEnabled} from '@/lib/billing-jobs';
export async function GET(){
 const s=env as unknown as Record<string,unknown>;let ready=false;
 try{
  const configured=(s.AUTH_PROVIDER!=='auth0'||!!auth0Configuration(s))&&(s.BILLING_ASYNC_ENABLED!=='true'||billingJobsEnabled(s));
  ready=configured&&await databaseReady(env.DB,s.ORGANIZATIONS_ENABLED==='true',s.AUTH_PROVIDER==='auth0',s.BILLING_ASYNC_ENABLED==='true');
 }catch{ready=false;}
 return Response.json({status:ready?'ready':'not_ready'},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
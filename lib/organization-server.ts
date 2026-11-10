import {ZodError} from 'zod';
import {BillingError} from './billing-policy';
import {billingIdentity,billingSettings,billingDB,billingFailure,billingJSON} from './billing-server';
export async function organizationRequest(request:Request,write:boolean,run:(db:D1Database,actor:{id:string;email:string})=>Promise<unknown>){
 const requestId=crypto.randomUUID(),started=Date.now();let response:Response;
 try{
  const s=billingSettings();
  if(s.ORGANIZATIONS_ENABLED!=='true'||s.AUTH_PROVIDER!=='auth0'||s.ATLAS_ENVIRONMENT!=='staging')throw new BillingError(503,'Organization pilot is not enabled.');
  const actor=await billingIdentity(request,write);response=billingJSON(await run(billingDB(),actor));
 }catch(error){response=error instanceof ZodError?Response.json({error:'Invalid organization request.'},{status:400,headers:{'Cache-Control':'no-store'}}):billingFailure(error);}
 response.headers.set('X-Request-ID',requestId);
 // Never log request bodies, paths containing identifiers, emails, tokens or SDK errors.
 console.info(JSON.stringify({event:'organization_request',requestId,method:request.method,status:response.status,durationMs:Date.now()-started}));
 return response;
}
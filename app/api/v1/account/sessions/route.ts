import {z} from 'zod';
import {billingIdentity,billingSettings,billingDB,billingFailure,billingJSON,limitedJSON} from '@/lib/billing-server';
import {D1AuthSessionStore} from '@/lib/auth-session-store';
import {auth0Configuration} from '@/lib/auth0-policy';
async function handle(request:Request,write:boolean){try{
 const settings=billingSettings(),config=auth0Configuration(settings);if(!config)return Response.json({error:'Session management requires Auth0.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const actor=await billingIdentity(request,write),store=new D1AuthSessionStore(billingDB(),'https://'+config.domain+'/');
 if(!write)return billingJSON({sessions:await store.listForAccount(actor.id)});
 const body=z.object({sessionId:z.string().regex(/^[a-f0-9]{32}$/).optional()}).strict().parse(await limitedJSON(request));
 return billingJSON(await store.revokeForAccount(actor.id,body.sessionId));
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Invalid session request.'},{status:400,headers:{'Cache-Control':'no-store'}});return billingFailure(error);}}
export function GET(request:Request){return handle(request,false);}
export function DELETE(request:Request){return handle(request,true);}
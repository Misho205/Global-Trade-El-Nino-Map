import {ZodError} from 'zod';
import {billingDB,billingFailure,billingSettings,planForPrice,stripeRequest} from '@/lib/billing-server';
import {normalizeBillingEvent,acceptBillingEvent} from '@/lib/billing-inbox';
import {reconcileSubscription} from '@/lib/subscription-reconciliation';
import {billingJobsEnabled} from '@/lib/billing-jobs';
import {verifyStripeSignature} from '@/lib/stripe-signature';
export async function POST(request:Request){
 try{
  const secret=String(billingSettings().STRIPE_WEBHOOK_SECRET||'');if(!secret)return new Response('Webhook not configured',{status:503});
  if(Number(request.headers.get('Content-Length')||0)>1000000)return new Response('Too large',{status:413});
  const reader=request.body?.getReader();if(!reader)return new Response('Missing body',{status:400});let body='',size=0;const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1000000){await reader.cancel();return new Response('Too large',{status:413});}body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();
  if(!verifyStripeSignature(body,request.headers.get('Stripe-Signature')||'',secret))return new Response('Invalid signature',{status:400});
  let event:any;try{event=JSON.parse(body);}catch{return new Response('Invalid JSON',{status:400});}
  if(typeof event.id!=='string'||!/^evt_[A-Za-z0-9]+$/.test(event.id)||!Number.isFinite(event.created))return new Response('Invalid event',{status:400});
  const db=billingDB(),normalized=normalizeBillingEvent(event);
  const settings=billingSettings();
  if(settings.BILLING_ASYNC_ENABLED==='true'){
   if(!billingJobsEnabled(settings))return new Response('Async billing is not configured',{status:503});
   await acceptBillingEvent(db,normalized);
   return Response.json({received:true,accepted:true});
  }
  return Response.json(await reconcileSubscription(db,normalized,id=>stripeRequest('subscriptions/'+encodeURIComponent(id)),planForPrice));
 }catch(error){if(error instanceof ZodError)return new Response('Invalid event',{status:400});return billingFailure(error);}
}

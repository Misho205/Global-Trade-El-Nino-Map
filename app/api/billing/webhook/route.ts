import {billingDB,billingFailure,billingSettings,planForPrice,stripeRequest} from '@/lib/billing-server';
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
  const db=billingDB();if(await db.prepare('SELECT id FROM billing_events WHERE id=?').bind(event.id).first())return Response.json({received:true,duplicate:true});
  const object=event.data?.object;
  const subscriptionID=event.type?.startsWith('customer.subscription.')?object?.id:event.type==='checkout.session.completed'&&object?.mode==='subscription'?object.subscription:null;
  if(typeof subscriptionID!=='string'||!/^sub_[A-Za-z0-9]+$/.test(subscriptionID))return Response.json({received:true,ignored:true});
  const startedAt=Date.now();
  // Retrieve canonical state: delivery order and checkout redirects are not authority.
  const subscription=await stripeRequest('subscriptions/'+encodeURIComponent(subscriptionID));
  const customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
  const account=await db.prepare('SELECT id FROM billing_accounts WHERE customer_id=?').bind(customer||'').first<{id:string}>();
  if(!account||subscription.metadata?.account_id!==account.id)return Response.json({received:true,ignored:true});
  const item=subscription.items?.data?.[0],plan=planForPrice(item?.price?.id||'');
  const periodEnd=subscription.current_period_end??item?.current_period_end;
  const valid=!!plan&&subscription.items?.data?.length===1&&item.quantity===1&&Number.isFinite(periodEnd);
  await db.batch([
   db.prepare("INSERT INTO billing_subscriptions (account_id,stripe_subscription_id,customer_id,plan,status,period_end,event_created,synced_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,customer_id=excluded.customer_id,plan=excluded.plan,status=excluded.status,period_end=excluded.period_end,event_created=excluded.event_created,synced_at=excluded.synced_at WHERE excluded.synced_at>=billing_subscriptions.synced_at AND (excluded.stripe_subscription_id=billing_subscriptions.stripe_subscription_id OR (excluded.status='active' AND excluded.event_created>=billing_subscriptions.event_created))").bind(account.id,subscription.id,customer,valid?plan:'free',valid?subscription.status:'unrecognized',Number.isFinite(periodEnd)?periodEnd:0,event.created,startedAt),
   db.prepare('INSERT OR IGNORE INTO billing_events (id,processed_at) VALUES (?,?)').bind(event.id,Date.now()),
   db.prepare('UPDATE billing_accounts SET checkout_url=NULL,checkout_until=0 WHERE id=?').bind(account.id),
  ]);
  return Response.json({received:true});
 }catch(error){return billingFailure(error);}
}

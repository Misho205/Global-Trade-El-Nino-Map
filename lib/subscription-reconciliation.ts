import type {BillingEvent} from './billing-inbox.ts';
export async function reconcileSubscription(db:Pick<D1Database,'prepare'|'batch'>,event:BillingEvent,fetchSubscription:(id:string)=>Promise<any>,planForPrice:(price:string)=>string|null){
 if(!event.subscriptionId)return {ignored:true};
 if(await db.prepare('SELECT id FROM billing_events WHERE id=?').bind(event.id).first())return {duplicate:true};
  const startedAt=Date.now();
  // Retrieve canonical state: delivery order and checkout redirects are not authority.
  const subscription=await fetchSubscription(event.subscriptionId!);
  const customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
  const account=await db.prepare('SELECT id FROM billing_accounts WHERE customer_id=?').bind(customer||'').first<{id:string}>();
  if(!account||subscription.metadata?.account_id!==account.id)return {ignored:true};
  const item=subscription.items?.data?.[0],plan=planForPrice(item?.price?.id||'');
  const periodEnd=subscription.current_period_end??item?.current_period_end;
  const valid=!!plan&&subscription.items?.data?.length===1&&item.quantity===1&&Number.isFinite(periodEnd);
  await db.batch([
   db.prepare("INSERT INTO billing_subscriptions (account_id,stripe_subscription_id,customer_id,plan,status,period_end,event_created,synced_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,customer_id=excluded.customer_id,plan=excluded.plan,status=excluded.status,period_end=excluded.period_end,event_created=excluded.event_created,synced_at=excluded.synced_at WHERE excluded.synced_at>=billing_subscriptions.synced_at AND (excluded.stripe_subscription_id=billing_subscriptions.stripe_subscription_id OR (excluded.status='active' AND excluded.event_created>=billing_subscriptions.event_created))").bind(account.id,subscription.id,customer,valid?plan:'free',valid?subscription.status:'unrecognized',Number.isFinite(periodEnd)?periodEnd:0,event.created,startedAt),
   db.prepare('INSERT OR IGNORE INTO billing_events (id,processed_at) VALUES (?,?)').bind(event.id,Date.now()),
   db.prepare('UPDATE billing_accounts SET checkout_url=NULL,checkout_until=0 WHERE id=?').bind(account.id),
  ]);

 return {received:true};
}

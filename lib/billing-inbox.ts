import {z} from 'zod';
export const normalizedBillingEvent=z.object({id:z.string().regex(/^evt_[A-Za-z0-9]+$/).max(200),type:z.string().min(1).max(100),created:z.number().int().nonnegative(),subscriptionId:z.string().regex(/^sub_[A-Za-z0-9]+$/).max(200).nullable()}).strict();
export type BillingEvent=z.infer<typeof normalizedBillingEvent>;
type DB=Pick<D1Database,'prepare'>;
export function normalizeBillingEvent(raw:unknown):BillingEvent{
 const event=raw as {id?:unknown;type?:unknown;created?:unknown;data?:{object?:{id?:unknown;mode?:unknown;subscription?:unknown}}};
 const object=event?.data?.object;
 const subscriptionId=typeof event?.type==='string'&&event.type.startsWith('customer.subscription.')?object?.id:event?.type==='checkout.session.completed'&&object?.mode==='subscription'?object.subscription:null;
 return normalizedBillingEvent.parse({id:event?.id,type:event?.type,created:event?.created,subscriptionId:subscriptionId??null});
}
export async function acceptBillingEvent(db:DB,input:BillingEvent,now=Date.now()){
 const event=normalizedBillingEvent.parse(input);
 await db.prepare('INSERT INTO billing_inbox(id,payload,received_at,dispatch_after) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,JSON.stringify(event),now,now).run();
}
export async function dispatchBillingInbox(db:DB,queue:{send(body:{eventId:string}):Promise<unknown>},now=Date.now()){
 await db.prepare("UPDATE billing_inbox SET state='failed',last_error='attempt_limit' WHERE state='pending' AND attempts>=5 AND lease_until<=?").bind(now).run();
 const rows=await db.prepare("SELECT id FROM billing_inbox WHERE state='pending' AND dispatch_after<=? AND lease_until<=? ORDER BY dispatch_after LIMIT 20").bind(now,now).all<{id:string}>();let sent=0;
 for(const row of rows.results){
  const claimed=await db.prepare("UPDATE billing_inbox SET dispatch_after=? WHERE id=? AND state='pending' AND dispatch_after<=? AND lease_until<=? RETURNING id").bind(now+300000,row.id,now,now).first();
  if(!claimed)continue;
  try{await queue.send({eventId:row.id});sent++;}catch{await db.prepare("UPDATE billing_inbox SET dispatch_after=?,last_error='dispatch_failed' WHERE id=? AND state='pending'").bind(now+60000,row.id).run();}
 }
 return {sent};
}
export async function processBillingInbox(db:DB,eventID:string,reconcile:(event:BillingEvent)=>Promise<unknown>,now:()=>number=Date.now){
 const lease=crypto.randomUUID(),started=now();
 await db.prepare("UPDATE billing_inbox SET state='failed',last_error='attempt_limit' WHERE id=? AND state='pending' AND attempts>=5 AND lease_until<=?").bind(eventID,started).run();
 const row=await db.prepare("UPDATE billing_inbox SET lease_until=?,lease_token=?,attempts=attempts+1 WHERE id=? AND state='pending' AND lease_until<=? AND attempts<5 RETURNING payload").bind(started+60000,lease,eventID,started).first<{payload:string}>();
 if(!row){const existing=await db.prepare('SELECT state FROM billing_inbox WHERE id=?').bind(eventID).first<{state:string}>();return existing?.state==='complete'?'complete':existing?.state==='failed'?'failed':existing?'busy':'missing';}
 try{
  await reconcile(normalizedBillingEvent.parse(JSON.parse(row.payload)));
  const done=await db.prepare("UPDATE billing_inbox SET state='complete',processed_at=?,lease_until=0,lease_token=NULL,last_error=NULL WHERE id=? AND lease_token=? RETURNING id").bind(now(),eventID,lease).first();
  return done?'complete':'busy';
 }catch{
  await db.prepare("UPDATE billing_inbox SET state=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,lease_until=0,lease_token=NULL,dispatch_after=?,last_error='reconciliation_failed' WHERE id=? AND lease_token=?").bind(now()+60000,eventID,lease).run();
  throw Error('Billing reconciliation failed');
 }
}
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureD1} from './helpers/d1.mjs';
import {acceptBillingEvent,dispatchBillingInbox,processBillingInbox,normalizeBillingEvent} from '../lib/billing-inbox.ts';
import {billingQueueConfig} from '../build/billing-queue-config.ts';
import {reconcileSubscription} from '../lib/subscription-reconciliation.ts';
const event=(id='evt_test')=>({id,type:'customer.subscription.updated',created:100,subscriptionId:'sub_test'});
test('queue configuration is opt-in, staging-scoped and requires distinct queues and Cron',()=>{
 assert.deepEqual(billingQueueConfig({}),{});
 const s={BILLING_ASYNC_ENABLED:'true',ATLAS_ENVIRONMENT:'staging',ATLAS_ENABLE_CRON:'true',ATLAS_DEPLOY_TARGET:'cloudflare',ATLAS_BILLING_QUEUE:'atlas-billing-staging',ATLAS_BILLING_DLQ:'atlas-billing-dead-staging'};
 assert.equal(billingQueueConfig(s).queues.consumers[0].max_retries,5);
 for(const change of [{ATLAS_ENVIRONMENT:'production'},{ATLAS_ENABLE_CRON:'false'},{ATLAS_BILLING_DLQ:s.ATLAS_BILLING_QUEUE},{ATLAS_BILLING_QUEUE:'production-queue'}])assert.throws(()=>billingQueueConfig({...s,...change}));
});
test('durable inbox deduplicates before dispatch and retains jobs when queue send fails',async()=>{
 const {db,sqlite}=fixtureD1();try{
 await acceptBillingEvent(db,event(),1000);await acceptBillingEvent(db,event(),1001);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM billing_inbox').get().n,1);
 const failed=await dispatchBillingInbox(db,{async send(){throw Error('offline');}},1000);assert.equal(failed.sent,0);
 assert.equal(sqlite.prepare('SELECT state FROM billing_inbox').get().state,'pending');
 const messages=[];assert.equal((await dispatchBillingInbox(db,{async send(body){messages.push(body);}},61000)).sent,1);
 assert.equal((await dispatchBillingInbox(db,{async send(){throw Error('duplicate');}},61001)).sent,0);assert.deepEqual(messages,[{eventId:'evt_test'}]);
 }finally{sqlite.close();}
});
test('duplicate deliveries and overlapping consumers reconcile only once per lease',async()=>{
 const {db,sqlite}=fixtureD1();try{await acceptBillingEvent(db,event(),1000);let count=0,unblock;const barrier=new Promise(resolve=>unblock=resolve);
 const first=processBillingInbox(db,'evt_test',async()=>{count++;await barrier;},()=>1000);
 // Wait for the first caller to claim its row and enter the fake provider.
 while(count===0)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(await processBillingInbox(db,'evt_test',async()=>{count++;},()=>1001),'busy');
 unblock();assert.equal(await first,'complete');assert.equal(await processBillingInbox(db,'evt_test',async()=>{count++;},()=>1002),'complete');assert.equal(count,1);
 }finally{sqlite.close();}
});
test('provider failures are bounded and crash-at-final-attempt cannot loop forever',async()=>{
 const {db,sqlite}=fixtureD1();try{await acceptBillingEvent(db,event(),1000);
 for(let i=0;i<5;i++)await assert.rejects(()=>processBillingInbox(db,'evt_test',async()=>{throw Error('secret must not be retained');},()=>1000+i));
 const row=sqlite.prepare('SELECT state,attempts,last_error FROM billing_inbox').get();assert.equal(row.state,'failed');assert.equal(row.attempts,5);assert.equal(row.last_error,'reconciliation_failed');
 assert.equal(await processBillingInbox(db,'evt_test',async()=>{},()=>2000),'failed');
 await acceptBillingEvent(db,event('evt_crash'),1000);sqlite.prepare('UPDATE billing_inbox SET attempts=5,lease_until=5000 WHERE id=?').run('evt_crash');
 assert.equal(await processBillingInbox(db,'evt_crash',async()=>{},()=>5001),'failed');
 }finally{sqlite.close();}
});
test('expired worker leases recover and fence late completion from an older worker',async()=>{
 const {db,sqlite}=fixtureD1();try{await acceptBillingEvent(db,event(),1000);let unblock;const barrier=new Promise(resolve=>unblock=resolve);let entered=false;
 const old=processBillingInbox(db,'evt_test',async()=>{entered=true;await barrier;},()=>1000);
 while(!entered)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(await processBillingInbox(db,'evt_test',async()=>{},()=>62000),'complete');
 unblock();assert.equal(await old,'busy');assert.equal(sqlite.prepare('SELECT state FROM billing_inbox').get().state,'complete');
 }finally{sqlite.close();}
});
test('canonical Stripe state controls entitlements; success, duplicate and failed payment are reconciled',async()=>{
 const {db,sqlite}=fixtureD1();try{
 sqlite.prepare('INSERT INTO billing_accounts(id,email,customer_id,created_at) VALUES(?,?,?,?)').run('account-a','dummy@example.test','cus_test',0);
 const canonical={id:'sub_test',customer:'cus_test',metadata:{account_id:'account-a'},status:'active',items:{data:[{price:{id:'price_test'},quantity:1,current_period_end:99999999}]}};
 const price=id=>id==='price_test'?'professional':null;let calls=0;const fetcher=async()=>{calls++;return canonical;};
 await reconcileSubscription(db,event(),fetcher,price);assert.equal(sqlite.prepare('SELECT status FROM billing_subscriptions').get().status,'active');
 await reconcileSubscription(db,event(),fetcher,price);assert.equal(calls,1);
 canonical.status='past_due';await reconcileSubscription(db,event('evt_failure'),fetcher,price);assert.equal(sqlite.prepare('SELECT status FROM billing_subscriptions').get().status,'past_due');
 canonical.status='canceled';await reconcileSubscription(db,event('evt_cancel'),fetcher,price);assert.equal(sqlite.prepare('SELECT status FROM billing_subscriptions').get().status,'canceled');
 canonical.status='active';canonical.items.data[0].price.id='unrecognized';await reconcileSubscription(db,event('evt_badprice'),fetcher,price);assert.equal(sqlite.prepare('SELECT plan FROM billing_subscriptions').get().plan,'free');
 canonical.metadata.account_id='someone-else';await reconcileSubscription(db,event('evt_wrongowner'),fetcher,price);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM billing_events WHERE id=?').get('evt_wrongowner').n,0);
 }finally{sqlite.close();}
});
test('normalization retains only routing facts, not raw payment or personal payloads',()=>{
 const raw={id:'evt_raw',type:'customer.subscription.updated',created:100,data:{object:{id:'sub_test',email:'private@example.test',card:'do not retain'}}};
 assert.deepEqual(normalizeBillingEvent(raw),{id:'evt_raw',type:raw.type,created:100,subscriptionId:'sub_test'});
 assert.throws(()=>normalizeBillingEvent({...raw,created:NaN}));assert.throws(()=>normalizeBillingEvent({...raw,id:'bad'}));
});
import {billingDB,planForPrice,stripeRequest} from './billing-server';
import {dispatchBillingInbox,processBillingInbox} from './billing-inbox';
import {reconcileSubscription} from './subscription-reconciliation';
export function billingJobsEnabled(settings:Record<string,unknown>){return settings.BILLING_ASYNC_ENABLED==='true'&&settings.ATLAS_ENVIRONMENT==='staging'&&!!settings.DB&&!!settings.BILLING_JOBS;}
export async function dispatchBillingJobs(settings:Record<string,unknown>){
 if(settings.BILLING_ASYNC_ENABLED!=='true')return;
 if(!billingJobsEnabled(settings))throw Error('Async billing configuration is incomplete');
 const result=await dispatchBillingInbox(billingDB(),settings.BILLING_JOBS as Queue<{eventId:string}>);
 console.info(JSON.stringify({event:'billing_dispatch',sent:result.sent}));
}
export async function consumeBillingJobs(batch:MessageBatch<unknown>,settings:Record<string,unknown>){
 if(!billingJobsEnabled(settings))throw Error('Async billing consumer is disabled');
 for(const message of batch.messages){
  const body=message.body as {eventId?:unknown};
  if(typeof body?.eventId!=='string'||!/^evt_[A-Za-z0-9]{1,196}$/.test(body.eventId)){console.warn(JSON.stringify({event:'billing_job_invalid'}));message.ack();continue;}
  try{
   const result=await processBillingInbox(billingDB(),body.eventId,event=>reconcileSubscription(billingDB(),event,id=>stripeRequest('subscriptions/'+encodeURIComponent(id)),planForPrice));
   if(result==='complete')message.ack();else message.retry({delaySeconds:60});
   console.info(JSON.stringify({event:'billing_job',result}));
  }catch{console.error(JSON.stringify({event:'billing_job_failed'}));message.retry({delaySeconds:60});}
 }
}
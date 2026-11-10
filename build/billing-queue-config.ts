export function billingQueueConfig(settings:Record<string,string|undefined>){
 if(settings.BILLING_ASYNC_ENABLED!=='true')return {};
 if(settings.ATLAS_ENVIRONMENT!=='staging'||settings.ATLAS_ENABLE_CRON!=='true'||settings.ATLAS_DEPLOY_TARGET!=='cloudflare')throw Error('Async billing requires standalone staging and Cron.');
 const queue=settings.ATLAS_BILLING_QUEUE,dead=settings.ATLAS_BILLING_DLQ;
 if(!queue||!dead||queue===dead||![queue,dead].every(n=>n.length<=63&&/^[a-z0-9][a-z0-9-]{0,62}-staging$/.test(n)))throw Error('Distinct staging billing queue and DLQ names required.');
 return {vars:{ATLAS_ENVIRONMENT:'staging',BILLING_ASYNC_ENABLED:'true'},queues:{producers:[{binding:'BILLING_JOBS',queue}],consumers:[{queue,max_batch_size:5,max_batch_timeout:5,max_retries:5,dead_letter_queue:dead}]}};
}
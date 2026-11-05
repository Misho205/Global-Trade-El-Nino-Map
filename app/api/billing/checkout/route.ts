import {BillingError,isPaidPlan,plans} from '@/lib/billing-policy';
import {billingIdentity,billingJSON,billingFailure,billingReady,accountRow,billingDB,limitedJSON,stripePrice,stripeRequest,appOrigin,subscriptionFor,billingSettings} from '@/lib/billing-server';
export async function POST(request:Request){
 let lockedAccount:string|null=null;
 try{
  const identity=await billingIdentity(request,true);
  if(!billingReady())throw new BillingError(503,'Paid subscriptions are not activated. No payment is being collected.');
  const body=await limitedJSON(request);if(!isPaidPlan(body.plan))throw new BillingError(400,'Choose Professional or Fleet.');
  const plan=plans.find(p=>p.id===body.plan)!,account=await accountRow(identity),db=billingDB();
  const existing=await subscriptionFor(identity.id);
  if(existing&&['active','trialing','past_due','unpaid','incomplete'].includes(existing.status))throw new BillingError(409,'Manage your existing subscription through the billing portal.');
  if(account.checkout_url&&account.checkout_until>Date.now()){
   if(account.checkout_plan!==body.plan)throw new BillingError(409,'An existing checkout is still open. Finish it or wait for it to expire before selecting another plan.');
   return billingJSON({url:account.checkout_url});
  }
  const lock=await db.prepare('UPDATE billing_accounts SET checkout_locked_until=? WHERE id=? AND checkout_locked_until<=?').bind(Date.now()+60000,identity.id,Date.now()).run();
  if(lock.meta.changes!==1)throw new BillingError(409,'Checkout is already being prepared. Retry shortly.');lockedAccount=identity.id;
  const price=await stripeRequest('prices/'+encodeURIComponent(stripePrice(body.plan)));
  if(!price.active||price.currency!=='eur'||price.unit_amount!==plan.monthlyEUR*100||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)throw new BillingError(503,'Configured payment price does not match the published monthly plan.');
  let customer=account.customer_id;
  if(!customer){const created=await stripeRequest('customers',new URLSearchParams({email:identity.email,'metadata[account_id]':identity.id}),'account-'+identity.id);customer=created.id;await db.prepare('UPDATE billing_accounts SET customer_id=? WHERE id=?').bind(customer,identity.id).run();}
  const origin=appOrigin();
  const form=new URLSearchParams({mode:'subscription',customer,'client_reference_id':identity.id,'line_items[0][price]':stripePrice(body.plan),'line_items[0][quantity]':'1','subscription_data[metadata][account_id]':identity.id,success_url:origin+'/account?checkout=success',cancel_url:origin+'/account?checkout=cancelled',expires_at:String(Math.floor(Date.now()/1000)+1800),'billing_address_collection':'required','tax_id_collection[enabled]':'true'});
  if(billingSettings().STRIPE_AUTOMATIC_TAX==='true'){form.set('automatic_tax[enabled]','true');form.set('customer_update[address]','auto');form.set('customer_update[name]','auto');}
  const session=await stripeRequest('checkout/sessions',form,`checkout-${identity.id}-${body.plan}-${Math.floor(Date.now()/1800000)}`);
  if(typeof session.url!=='string'||!session.url.startsWith('https://checkout.stripe.com/'))throw new BillingError(502,'Payment provider returned an invalid checkout URL.');
  await db.prepare('UPDATE billing_accounts SET checkout_url=?,checkout_plan=?,checkout_until=? WHERE id=?').bind(session.url,body.plan,session.expires_at*1000,identity.id).run();
  return billingJSON({url:session.url});
 }catch(error){return billingFailure(error);}
 finally{if(lockedAccount)try{await billingDB().prepare('UPDATE billing_accounts SET checkout_locked_until=0 WHERE id=?').bind(lockedAccount).run();}catch{}}
}

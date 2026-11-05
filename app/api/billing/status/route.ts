import {billingIdentity,billingJSON,billingFailure,billingReady,subscriptionFor} from '@/lib/billing-server';
import {paidEntitlement} from '@/lib/billing-policy';
export async function GET(request:Request){try{const identity=await billingIdentity(request);const subscription=await subscriptionFor(identity.id);return billingJSON({email:identity.email,checkoutEnabled:billingReady(),plan:paidEntitlement(subscription)?subscription.plan:'free',status:subscription?.status||'none',periodEnd:subscription?.period_end||null});}catch(error){return billingFailure(error);}}

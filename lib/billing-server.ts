import {env} from 'cloudflare:workers';
import {accountIdentity} from './access-identity';
import {BillingError,isPaidPlan,paidEntitlement,plans,requireSameOrigin,type PaidPlan} from './billing-policy';
export const billingSettings=()=>env as unknown as Record<string,unknown>;
export function billingDB(){if(!env.DB)throw new BillingError(503,'Account storage is not configured.');return env.DB;}
export function appOrigin(){
 try{const url=new URL(String(billingSettings().PUBLIC_APP_URL||''));if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();return url.origin;}catch{throw new BillingError(503,'PUBLIC_APP_URL must be the canonical HTTPS site origin.');}
}
export function billingReady(){const s=billingSettings();return s.BILLING_ENABLED==='true'&&s.PRO_FEATURES_VALIDATED==='true'&&!!s.STRIPE_SECRET_KEY&&!!s.STRIPE_WEBHOOK_SECRET&&!!s.STRIPE_PRICE_PROFESSIONAL&&!!s.STRIPE_PRICE_FLEET&&!!s.ACCESS_TEAM_DOMAIN&&!!s.ACCESS_AUD&&!!s.PUBLIC_APP_URL;}
export async function billingIdentity(request:Request,write=false){if(write)requireSameOrigin(request,appOrigin());return accountIdentity(request,billingSettings());}
export async function stripeRequest(path:string,form?:URLSearchParams,idempotencyKey?:string){
 const secret=String(billingSettings().STRIPE_SECRET_KEY||'');if(!secret)throw new BillingError(503,'Payments are not configured.');
 const response=await fetch('https://api.stripe.com/v1/'+path,{method:form?'POST':'GET',headers:{Authorization:'Bearer '+secret,'Stripe-Version':'2026-10-28.endive',...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},...(form?{body:form}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new BillingError(502,'Payment provider request failed. Please retry later.');return response.json() as Promise<any>;
}
export function stripePrice(plan:PaidPlan){return String(billingSettings()[plan==='professional'?'STRIPE_PRICE_PROFESSIONAL':'STRIPE_PRICE_FLEET']||'');}
export function planForPrice(price:string):PaidPlan|null{return (['professional','fleet'] as PaidPlan[]).find(p=>!!stripePrice(p)&&stripePrice(p)===price)||null;}
export async function accountRow(identity:{id:string;email:string}){
 const db=billingDB();await db.prepare('INSERT INTO billing_accounts (id,email,created_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(identity.id,identity.email,Date.now()).run();
 return (await db.prepare('SELECT * FROM billing_accounts WHERE id=?').bind(identity.id).first<any>())!;
}
export async function subscriptionFor(id:string){return billingDB().prepare('SELECT * FROM billing_subscriptions WHERE account_id=?').bind(id).first<any>();}
export async function requirePaid(request:Request,write=false){
 const identity=await billingIdentity(request,write);if(!billingReady())throw new BillingError(503,'Professional services are not activated. No payment is being collected.');
 const subscription=await subscriptionFor(identity.id);if(!paidEntitlement(subscription))throw new BillingError(402,'An active paid subscription is required.');
 const plan=plans.find(p=>p.id===subscription.plan)!;return {identity,plan};
}
export async function limitedJSON(request:Request,limit=16000){const reader=request.body?.getReader();if(!reader)throw new BillingError(400,'A JSON body is required.');let size=0,parts:Uint8Array[]=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new BillingError(413,'Request too large.');}parts.push(value);}const all=new Uint8Array(size);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(all));}catch(error){if(error instanceof BillingError)throw error;throw new BillingError(400,'Invalid JSON.');}}
export function billingFailure(error:unknown){return Response.json({error:error instanceof BillingError?error.message:'Account service temporarily unavailable.'},{status:error instanceof BillingError?error.status:503,headers:{'Cache-Control':'no-store'}});}
export function billingJSON(data:unknown){return Response.json(data,{headers:{'Cache-Control':'no-store'}});}

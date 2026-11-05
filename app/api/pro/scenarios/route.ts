import {BillingError,compareScenarios} from '@/lib/billing-policy';
import {billingDB,billingFailure,billingJSON,requirePaid,limitedJSON} from '@/lib/billing-server';
export async function GET(request:Request){try{const {identity,plan}=await requirePaid(request);const rows=await billingDB().prepare('SELECT id,payload,created_at FROM professional_scenarios WHERE account_id=? ORDER BY created_at DESC LIMIT 50').bind(identity.id).all<any>();return billingJSON({plan:plan.id,limit:plan.scenariosPerMonth,scenarios:rows.results.map(row=>({id:row.id,createdAt:row.created_at,...JSON.parse(row.payload)}))});}catch(error){return billingFailure(error);}}
export async function POST(request:Request){try{
 const {identity,plan}=await requirePaid(request,true),body=await limitedJSON(request),comparison=compareScenarios(body);
 if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))throw new BillingError(400,'A request ID is required.');
 const id=identity.id+':'+body.requestId,db=billingDB();
 const existing=await db.prepare('SELECT payload FROM professional_scenarios WHERE id=? AND account_id=?').bind(id,identity.id).first<{payload:string}>();if(existing)return billingJSON({id,...JSON.parse(existing.payload),replayed:true});
 const now=Date.now(),period=new Date(now).toISOString().slice(0,7),payload=JSON.stringify(comparison);
 // Single statement: simultaneous requests cannot bypass the account/month quota.
 const inserted=await db.prepare('INSERT INTO professional_scenarios (id,account_id,period,title,payload,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM professional_scenarios WHERE account_id=? AND period=?)<? ON CONFLICT(id) DO NOTHING RETURNING id').bind(id,identity.id,period,comparison.title,payload,now,identity.id,period,plan.scenariosPerMonth).first();
 if(!inserted)throw new BillingError(429,'Monthly scenario allowance reached, or this request is already being saved.');
 return billingJSON({id,...comparison});
 }catch(error){return billingFailure(error);}}

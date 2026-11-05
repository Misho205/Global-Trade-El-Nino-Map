import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {plans,paidEntitlement,compareScenarios,requireSameOrigin} from '../lib/billing-policy.ts';
import {verifyStripeSignature} from '../lib/stripe-signature.ts';
import {verifyAccessJWT,accessIssuer} from '../lib/access-identity.ts';

test('free observation stays free, paid access expires and past-due is denied',()=>{
 assert.equal(plans[0].monthlyEUR,0);
 assert.equal(paidEntitlement(null),false);
 for(const status of ['past_due','unpaid','canceled','trialing','incomplete'])assert.equal(paidEntitlement({plan:'fleet',status,period_end:200},100000),false);
 assert.equal(paidEntitlement({plan:'professional',status:'active',period_end:200},100000),true);
 assert.equal(paidEntitlement({plan:'professional',status:'active',period_end:100},100000),false);
 assert.equal(paidEntitlement({plan:'invented',status:'active',period_end:200},100000),false);
});
test('billing writes require the exact trusted origin',()=>{
 assert.throws(()=>requireSameOrigin(new Request('https://atlas.test/api',{headers:{Origin:'https://attacker.test'}}),'https://atlas.test'));
 assert.throws(()=>requireSameOrigin(new Request('https://atlas.test/api'),'https://atlas.test'));
 requireSameOrigin(new Request('https://atlas.test/api',{headers:{Origin:'https://atlas.test'}}),'https://atlas.test');
});
test('scenario arithmetic is explicit and unsafe/nonfinite assumptions are rejected',()=>{
 const option={name:'A',mode:'sea',distanceKm:100,speedKmh:25,costPerKmEUR:2,operatingCostPerHourEUR:10,delayHours:1,feesEUR:30};
 const result=compareScenarios({title:'Example',options:[option,{...option,name:'B'}]});assert.equal(result.options[0].durationHours,5);assert.equal(result.options[0].costEUR,280);
 for(const value of [NaN,Infinity,-1,100001])assert.throws(()=>compareScenarios({title:'Test',options:[{...option,distanceKm:value},option]}));
 assert.throws(()=>compareScenarios({title:'Test',options:[{...option,speedKmh:0},option]}));
 assert.throws(()=>compareScenarios({title:'Test',options:[option]}));
});
test('Stripe webhook signatures reject tampering, wrong secrets and replay windows',()=>{
 const body='{"id":"evt_dummy"}',time=100000,secret='whsec_dummy';
 const signature=createHmac('sha256',secret).update(time+'.'+body).digest('hex');
 assert.equal(verifyStripeSignature(body,`t=${time},v1=${signature}`,secret,time*1000),true);
 assert.equal(verifyStripeSignature(body+' ',`t=${time},v1=${signature}`,secret,time*1000),false);
 assert.equal(verifyStripeSignature(body,`t=${time},v1=${signature}`,'wrong',time*1000),false);
 assert.equal(verifyStripeSignature(body,`t=${time},v1=${signature}`,secret,(time+301)*1000),false);
 assert.equal(verifyStripeSignature(body,`t=${time},v1=invalid`,secret,time*1000),false);
});
test('JWT access requires a valid signature, issuer, audience and expiry',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const publicKey={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test'};
 const issuer='https://example.cloudflareaccess.com',audience='app-audience',now=1000000;
 const claims={iss:issuer,aud:[audience],sub:'dummy-user',email:'dummy@example.test',exp:now/1000+3600};
 const make=async values=>{const unsigned=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(values)).toString('base64url');const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(unsigned));return unsigned+'.'+Buffer.from(signature).toString('base64url');};
 const token=await make(claims),identity=await verifyAccessJWT(token,issuer,audience,[publicKey],now);assert.equal(identity.email,claims.email);assert.equal(identity.id.length,64);
 const other=await verifyAccessJWT(await make({...claims,sub:'second-user'}),issuer,audience,[publicKey],now);assert.notEqual(other.id,identity.id);
 for(const change of [{iss:'https://attacker.test'},{aud:['other']},{exp:now/1000},{email:''}])await assert.rejects(()=>make({...claims,...change}).then(jwt=>verifyAccessJWT(jwt,issuer,audience,[publicKey],now)));
 const pieces=token.split('.');pieces[1]=Buffer.from(JSON.stringify({...claims,sub:'another-user'})).toString('base64url');await assert.rejects(()=>verifyAccessJWT(pieces.join('.'),issuer,audience,[publicKey],now));
 assert.throws(()=>accessIssuer({ACCESS_TEAM_DOMAIN:'attacker.test'}));
});
test('SQLite save quota is account-scoped and idempotent; migration preserves source data',()=>{
 const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 db.prepare('INSERT INTO data_snapshots (key,payload) VALUES (?,?)').run('climate','{"valid":true}');
 const source=readFileSync(new URL('../app/api/pro/scenarios/route.ts',import.meta.url),'utf8');const sql=source.match(/prepare\('(INSERT INTO professional_scenarios[^']+)'\)/)?.[1];assert.ok(sql);
 const insert=db.prepare(sql),save=(id,owner)=>insert.get(id,owner,'2026-11','Example','{}',1,owner,'2026-11',1);
 assert.ok(save('a','owner-a'));assert.equal(save('b','owner-a'),undefined);assert.ok(save('c','owner-b'));assert.equal(save('a','owner-a'),undefined);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM professional_scenarios WHERE account_id=?').get('owner-a').n,1);
 assert.equal(db.prepare('SELECT payload FROM data_snapshots WHERE key=?').get('climate').payload,'{"valid":true}');db.close();
});
test('older/canceled subscriptions cannot replace a newer active subscription',()=>{
 const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const source=readFileSync(new URL('../app/api/billing/webhook/route.ts',import.meta.url),'utf8'),sql=source.match(/prepare\("(INSERT INTO billing_subscriptions[^"]+)"\)/)?.[1];assert.ok(sql);
 const update=db.prepare(sql);update.run('a','sub_old','cus_dummy','professional','active',2000,10,100);
 update.run('a','sub_new','cus_dummy','fleet','active',3000,20,200);
 update.run('a','sub_old','cus_dummy','professional','canceled',2000,21,300);
 assert.equal(db.prepare('SELECT stripe_subscription_id FROM billing_subscriptions WHERE account_id=?').get('a').stripe_subscription_id,'sub_new');
 update.run('a','sub_new','cus_dummy','fleet','active',1000,19,150);
 assert.equal(db.prepare('SELECT period_end FROM billing_subscriptions WHERE account_id=?').get('a').period_end,3000);db.close();
});

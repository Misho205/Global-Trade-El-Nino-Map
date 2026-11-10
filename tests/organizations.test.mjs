import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {allowed,createInvitation,hashInvitation} from '../lib/organization-policy.ts';
import {createOrganizationFor,listOrganizations,organizationDetail,inviteToOrganization,acceptOrganizationInvitation,changeOrganizationMember,removeOrganizationMember,listOrganizationInvitations,revokeOrganizationInvitation,listOrganizationAudit} from '../lib/organization-service.ts';
const actor=(n,email=`dummy-${n}@example.test`)=>({id:n.toString(16).padStart(64,'0'),email});
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const execute=(sql,args)=>{const statement=sqlite.prepare(sql);return statement.columns().length?{results:statement.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(statement.run(...args).changes)}};};
 const db={prepare(sql){let args=[];return {sql,get args(){return args;},bind(...values){args=values;return this;},async first(){return execute(sql,args).results[0]??null;},async all(){return execute(sql,args);},async run(){return execute(sql,args);}};},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>execute(s.sql,s.args));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db};
}
test('role policy denies unknown/platform roles and unauthorized administration',()=>{
 for(const role of ['platform_admin','super_admin','__proto__',null,''])assert.equal(allowed(role,'manage_members'),false);
 assert.equal(allowed('owner','manage_members'),true);assert.equal(allowed('admin','manage_members'),false);
 assert.equal(allowed('viewer','write'),false);assert.equal(allowed('billing_admin','billing'),true);
 assert.throws(()=>createInvitation.parse({email:'a@example.test',role:'owner'}));
});
test('actual organization service isolates tenants, enforces role boundaries and retains owner',async()=>{
 const {db,sqlite}=setup();try{
 const a=actor(1),b=actor(2),member=actor(3);
 const one=await createOrganizationFor(db,a,{name:'Tenant A',requestId:crypto.randomUUID()});
 const two=await createOrganizationFor(db,b,{name:'Tenant B',requestId:crypto.randomUUID()});
 assert.deepEqual((await listOrganizations(db,a)).map(o=>o.id),[one.id]);
 await assert.rejects(()=>organizationDetail(db,b,one.id),e=>e.status===404);
 await assert.rejects(()=>inviteToOrganization(db,b,one.id,{email:member.email,role:'admin'}),e=>e.status===409);
 const invitation=await inviteToOrganization(db,a,one.id,{email:member.email,role:'admin'});
 assert.notEqual(sqlite.prepare('SELECT token_hash FROM organization_invitations').get().token_hash,invitation.token);
 assert.equal(sqlite.prepare('SELECT token_hash FROM organization_invitations').get().token_hash,await hashInvitation(invitation.token));
 await assert.rejects(()=>acceptOrganizationInvitation(db,b,invitation.token),e=>e.status===409);
 assert.equal((await acceptOrganizationInvitation(db,member,invitation.token)).organizationId,one.id);
 await assert.rejects(()=>acceptOrganizationInvitation(db,member,invitation.token),e=>e.status===409);
 await assert.rejects(()=>inviteToOrganization(db,member,one.id,{email:'other@example.test',role:'admin'}));
 await assert.rejects(()=>changeOrganizationMember(db,member,one.id,{userId:a.id,role:'viewer'}));
 await assert.rejects(()=>removeOrganizationMember(db,a,one.id,a.id));
 await assert.rejects(()=>changeOrganizationMember(db,a,one.id,{userId:a.id,role:'viewer'}));
 await assert.rejects(()=>changeOrganizationMember(db,b,one.id,{userId:member.id,role:'viewer'}));
 await changeOrganizationMember(db,a,one.id,{userId:member.id,role:'viewer'});
 assert.equal((await organizationDetail(db,member,one.id)).role,'viewer');
 await removeOrganizationMember(db,a,one.id,member.id);
 await assert.rejects(()=>organizationDetail(db,member,one.id));
 assert.equal((await organizationDetail(db,b,two.id)).role,'owner');
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM organization_audit_logs WHERE action='member.removed'").get().n,1);
 }finally{sqlite.close();}
});
test('pending invitations reserve seats, expiry releases them and renewal invalidates old token',async()=>{
 const {db,sqlite}=setup();try{
 const owner=actor(1),org=await createOrganizationFor(db,owner,{name:'Limited seats',requestId:crypto.randomUUID()});
 sqlite.prepare('UPDATE organizations SET seat_limit=2 WHERE id=?').run(org.id);
 const first=await inviteToOrganization(db,owner,org.id,{email:actor(2).email,role:'member'});
 await assert.rejects(()=>inviteToOrganization(db,owner,org.id,{email:actor(3).email,role:'member'}));
 const renewed=await inviteToOrganization(db,owner,org.id,{email:actor(2).email,role:'viewer'});
 await assert.rejects(()=>acceptOrganizationInvitation(db,actor(2),first.token));
 sqlite.prepare('UPDATE organization_invitations SET expires_at=0').run();
 await assert.rejects(()=>acceptOrganizationInvitation(db,actor(2),renewed.token));
 const current=await inviteToOrganization(db,owner,org.id,{email:actor(3).email,role:'member'});
 await acceptOrganizationInvitation(db,actor(3),current.token);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM organization_members WHERE organization_id=?').get(org.id).n,2);
 await assert.rejects(()=>inviteToOrganization(db,owner,org.id,{email:actor(4).email,role:'member'}));
 }finally{sqlite.close();}
});
test('organization creation is idempotent, bounded and preserves prior atlas tables',async()=>{
 const {db,sqlite}=setup();try{
 const owner=actor(1),requestId=crypto.randomUUID();
 const a=await createOrganizationFor(db,owner,{name:'Example',requestId});
 assert.equal((await createOrganizationFor(db,owner,{name:'Example',requestId})).replayed,true);
 await assert.rejects(()=>createOrganizationFor(db,owner,{name:'Changed name',requestId}),e=>e.status===409);
 await assert.rejects(()=>createOrganizationFor(db,actor(2),{name:'Other',requestId}));
 for(let i=0;i<9;i++)await createOrganizationFor(db,owner,{name:'Other '+i,requestId:crypto.randomUUID()});
 await assert.rejects(()=>createOrganizationFor(db,owner,{name:'Over limit',requestId:crypto.randomUUID()}));
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM organization_members WHERE organization_id=? AND role='owner'").get(a.id).n,1);
 sqlite.prepare('INSERT INTO data_snapshots(key,payload) VALUES(?,?)').run('climate','{"valid":true}');
 assert.equal(sqlite.prepare('SELECT payload FROM data_snapshots WHERE key=?').get('climate').payload,'{"valid":true}');
 assert.throws(()=>sqlite.prepare("INSERT INTO organization_members VALUES(?,?,'platform_admin',0)").run(a.id,owner.id));
 }finally{sqlite.close();}
});
test('invitation revocation and audit reads stay tenant- and role-scoped',async()=>{
 const {db,sqlite}=setup();try{
 const owner=actor(1),outsider=actor(2),viewer=actor(3);
 const org=await createOrganizationFor(db,owner,{name:'Audit test',requestId:crypto.randomUUID()});
 const a=await inviteToOrganization(db,owner,org.id,{email:viewer.email,role:'viewer'});
 await acceptOrganizationInvitation(db,viewer,a.token);
 const pending=await inviteToOrganization(db,owner,org.id,{email:actor(4).email,role:'member'});
 assert.equal((await listOrganizationInvitations(db,owner,org.id)).length,1);
 for(const user of [viewer,outsider]){
  await assert.rejects(()=>listOrganizationInvitations(db,user,org.id));
  await assert.rejects(()=>listOrganizationAudit(db,user,org.id));
  await assert.rejects(()=>revokeOrganizationInvitation(db,user,org.id,pending.id));
 }
 await revokeOrganizationInvitation(db,owner,org.id,pending.id);
 await assert.rejects(()=>acceptOrganizationInvitation(db,actor(4),pending.token));
 assert.equal((await listOrganizationAudit(db,owner,org.id)).filter(e=>e.action==='invitation.revoked').length,1);
 assert.equal((await listOrganizationInvitations(db,owner,org.id)).length,0);
 }finally{sqlite.close();}
});

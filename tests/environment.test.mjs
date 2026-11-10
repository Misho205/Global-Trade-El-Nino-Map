import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {deploymentEnvironment} from '../build/deployment-environment.ts';
import {databaseReady} from '../lib/readiness.ts';
test('explicit deployment guards isolate environment names and reject placeholders',()=>{
 assert.equal(deploymentEnvironment({}),null);
 const s={ATLAS_ENVIRONMENT:'staging',ATLAS_DEPLOY_TARGET:'cloudflare',ATLAS_WORKER_NAME:'atlas-staging',CLOUDFLARE_D1_DATABASE_NAME:'atlas-staging',CLOUDFLARE_D1_DATABASE_ID:'11111111-1111-4111-8111-111111111111'};
 assert.equal(deploymentEnvironment(s).name,'staging');
 for(const change of [{ATLAS_ENVIRONMENT:'other'},{ATLAS_ENVIRONMENT:'production'},{CLOUDFLARE_D1_DATABASE_ID:'REPLACE'},{ATLAS_DEPLOY_TARGET:''},{ATLAS_WORKER_NAME:'atlas'}])assert.throws(()=>deploymentEnvironment({...s,...change}));
 assert.equal(deploymentEnvironment({...s,ATLAS_ENVIRONMENT:'production',ATLAS_WORKER_NAME:'atlas-production',CLOUDFLARE_D1_DATABASE_NAME:'atlas-production'}).name,'production');
});
test('readiness fails for missing or partially migrated databases and passes current schema',async()=>{
 assert.equal(await databaseReady(undefined),false);
 const db=new DatabaseSync(':memory:');const adapter={prepare(sql){return {async first(){return db.prepare(sql).get();}};}};
 assert.equal(await databaseReady(adapter),false);
 const files=readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort();
 db.exec(readFileSync(new URL('../drizzle/'+files[0],import.meta.url),'utf8'));
 assert.equal(await databaseReady(adapter),false);
 for(const file of files.slice(1))db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 assert.equal(await databaseReady(adapter),true);db.close();
});

test('enabled organization readiness requires the additive tenant migration',async()=>{
 const db=new DatabaseSync(':memory:');const adapter={prepare(sql){return {async first(){return db.prepare(sql).get();}};}};
 const files=readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort();
 for(const file of files.filter(x=>!x.startsWith('0003_')))db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 assert.equal(await databaseReady(adapter),true);
 assert.equal(await databaseReady(adapter,true),false);
 for(const file of files.filter(x=>x.startsWith('0003_')))db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 assert.equal(await databaseReady(adapter,true),true);db.close();
});

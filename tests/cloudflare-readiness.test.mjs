import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {cloudflareTarget} from '../build/cloudflare-target.ts';
import {advanceLiveDate} from '../lib/utc-day.ts';

test('standalone Cloudflare build refuses missing or local database IDs',()=>{
 for(const id of [undefined,'invalid','00000000-0000-4000-8000-000000000000']) {
  assert.throws(()=>cloudflareTarget({ATLAS_ENABLE_CRON:'true',CLOUDFLARE_D1_DATABASE_ID:id}),/real CLOUDFLARE_D1_DATABASE_ID/);
 }
 assert.equal(cloudflareTarget({}).standalone,false);
 assert.equal(cloudflareTarget({ATLAS_DEPLOY_TARGET:'cloudflare',CLOUDFLARE_D1_DATABASE_ID:'11111111-1111-4111-8111-111111111111'}).standalone,true);
});
test('UTC midnight and year rollover advance a live date but preserve historical selection',()=>{
 assert.equal(advanceLiveDate('2026-10-20','2026-10-20','2026-10-21'),'2026-10-21');
 assert.equal(advanceLiveDate('2026-12-31','2026-12-31','2027-01-01'),'2027-01-01');
 assert.equal(advanceLiveDate('1997-12-01','2026-10-20','2026-10-21'),'1997-12-01');
});
test('actual SQLite lease query creates, excludes overlaps, respects retry delay and permits expiry',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../drizzle/0000_mysterious_elektra.sql',import.meta.url),'utf8'));
 const source=readFileSync(new URL('../lib/persistent-data.ts',import.meta.url),'utf8');
 const sql=source.match(/prepare\('(INSERT INTO data_snapshots \(key, lease_until[^']+)'\)/)?.[1];
 assert.ok(sql);const claim=db.prepare(sql);
 assert.ok(claim.get('climate',300,100,100,100));
 assert.equal(claim.get('climate',301,101,101,101),undefined);
 db.prepare('UPDATE data_snapshots SET lease_until=0, next_attempt=500 WHERE key=?').run('climate');
 assert.equal(claim.get('climate',600,400,400,400),undefined);
 assert.ok(claim.get('climate',900,500,500,500));db.close();
});

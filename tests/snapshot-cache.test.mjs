import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedSnapshot} from '../lib/snapshot-cache.ts';

function fixture(){
 let row=null, time=1_000_000, calls=0;
 const store={
  async read(){return row&&{...row};}, async touch(){},
  async claim(key,now){if(row&&(row.lease_until>now||row.next_attempt>now))return false;row={key,payload:null,last_success:null,last_attempt:now,next_attempt:0,lease_until:now+300000,failures:0,error:null,...row};row.lease_until=now+300000;return true;},
  async success(key,payload,now,ttl){row={...row,key,payload,last_success:now,last_attempt:now,next_attempt:now+ttl,lease_until:0,failures:0,error:null};},
  async failure(key,error,now,retry){row={...row,last_attempt:now,next_attempt:now+retry,lease_until:0,failures:row.failures+1,error};},
 };
 const run=(load)=>cachedSnapshot(store,'climate',1000,async()=>{calls++;return load();},d=>Array.isArray(d.values)&&d.values.length>0,{now:()=>time});
 return {run,setTime:n=>time=n,get calls(){return calls;},get row(){return row;}};
}
test('persists good data and serves it without a second upstream request',async()=>{
 const f=fixture();assert.equal((await f.run(()=>Response.json({values:[1]}))).status,200);
 const cached=await (await f.run(()=>{throw Error('must not fetch');})).json();
 assert.deepEqual(cached.values,[1]);assert.equal(cached.refresh.persisted,true);assert.equal(f.calls,1);
});
test('upstream failure keeps the original timestamp and payload, with backoff',async()=>{
 const f=fixture();await f.run(()=>Response.json({values:[1]}));f.setTime(1_002_000);
 const failed=await(await f.run(()=>{throw Error('upstream down');})).json();
 assert.deepEqual(failed.values,[1]);assert.equal(failed.refresh.state,'stale');assert.equal(failed.refresh.lastSuccessAt,new Date(1_000_000).toISOString());
 await f.run(()=>{throw Error('must back off');});assert.equal(f.calls,2);
});
test('HTTP 200 with incomplete payload cannot replace valid data',async()=>{
 const f=fixture();await f.run(()=>Response.json({values:[3]}));f.setTime(1_002_000);
 const failed=await(await f.run(()=>Response.json({values:[],errors:['partial result']}))).json();assert.deepEqual(failed.values,[3]);assert.equal(failed.refresh.state,'stale');
});
test('first failed load is unavailable, never a false success',async()=>{
 const f=fixture();const response=await f.run(()=>{throw Error('no connection');});assert.equal(response.status,503);assert.equal((await response.json()).refresh.lastSuccessAt,null);
});
test('overlapping updates share a lease',async()=>{
 const f=fixture();let finish;const first=f.run(()=>new Promise(resolve=>{finish=resolve;}));
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 const second=await f.run(()=>{throw Error('must not duplicate');});assert.equal(second.status,503);assert.equal(f.calls,1);
 finish(Response.json({values:[4]}));assert.equal((await first).status,200);
});
test('missing storage is explicitly reported even if upstream succeeds',async()=>{
 const response=await cachedSnapshot(null,'test',1000,async()=>Response.json({values:[1]}),()=>true);
 const data=await response.json();assert.equal(data.refresh.persisted,false);assert.match(data.refresh.error,/not configured/);
});
test('a later successful retry clears the error and advances the success timestamp',async()=>{
 const f=fixture();await f.run(()=>Response.json({values:[1]}));f.setTime(1_002_000);
 await f.run(()=>{throw Error('temporary failure');});f.setTime(1_063_000);
 const recovered=await(await f.run(()=>Response.json({values:[2]}))).json();
 assert.deepEqual(recovered.values,[2]);assert.equal(recovered.refresh.state,'fresh');assert.equal(recovered.refresh.error,null);assert.equal(f.row.failures,0);
});
test('storage read failures do not prevent an explicitly unpersisted source response',async()=>{
 const store={async read(){throw Error('database offline');}};
 const response=await cachedSnapshot(store,'test',1000,async()=>Response.json({values:[1]}),()=>true);
 const data=await response.json();assert.deepEqual(data.values,[1]);assert.equal(data.refresh.persisted,false);assert.match(data.refresh.error,/storage unavailable/);
});

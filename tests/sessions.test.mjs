import test from 'node:test';
import assert from 'node:assert/strict';
import {D1AuthSessionStore,subjectAccountID} from '../lib/auth-session-store.ts';
import {auth0Account} from '../lib/auth0-policy.ts';
import {fixtureD1} from './helpers/d1.mjs';
const issuer='https://example.eu.auth0.com/';
const id='a'.repeat(32),otherID='b'.repeat(32);
const state=(now,sub='user-a',sid='provider-a')=>({user:{sub,sid,email:'dummy@example.test',email_verified:true},internal:{sid,createdAt:Math.floor(now/1000)},idToken:'dummy-token',refreshToken:undefined,tokenSets:[]});
test('D1 sessions match authenticated account IDs and never expose tokens in lists',async()=>{
 const {db,sqlite}=fixtureD1();try{const now=10000000,store=new D1AuthSessionStore(db,issuer,()=>now),session=state(now);
 await store.set(id,session);assert.deepEqual(await store.get(id),JSON.parse(JSON.stringify(session)));
 const account=await subjectAccountID(issuer,'user-a');assert.equal(account,(await auth0Account(session.user,'example.eu.auth0.com')).id);
 const rows=await store.listForAccount(account);assert.equal(rows.length,1);assert.equal(rows[0].payload,undefined);assert.equal(rows[0].subject,undefined);
 assert.equal((await store.listForAccount(await subjectAccountID(issuer,'other'))).length,0);
 }finally{sqlite.close();}
});
test('revocation tombstones prevent late writes and cross-account revocation',async()=>{
 const {db,sqlite}=fixtureD1();try{let now=10000000;const store=new D1AuthSessionStore(db,issuer,()=>now),session=state(now);
 await store.set(id,session);const account=await subjectAccountID(issuer,'user-a');
 assert.equal((await store.revokeForAccount('not-the-owner',id)).revoked,0);assert.ok(await store.get(id));
 assert.equal((await store.revokeForAccount(account,id)).revoked,1);assert.equal(await store.get(id),undefined);
 await assert.rejects(()=>store.set(id,session));assert.equal(sqlite.prepare('SELECT payload FROM auth_sessions WHERE id=?').get(id).payload,'');
 await store.delete(otherID);await assert.rejects(()=>store.set(otherID,session));
 now+=9*3600000;await store.prune();assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n,2);
 now+=86400001;await store.prune();assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n,0);
 }finally{sqlite.close();}
});
test('expiry and issuer/subject mismatches fail closed; storage failures propagate',async()=>{
 const {db,sqlite}=fixtureD1();try{let now=10000000;const store=new D1AuthSessionStore(db,issuer,()=>now),session=state(now);
 await store.set(id,session);
 await assert.rejects(()=>store.set(id,state(now,'different')));
 assert.equal(await new D1AuthSessionStore(db,'https://other.auth0.com/',()=>now).get(id),undefined);
 now+=1800001;assert.equal(await store.get(id),undefined);await assert.rejects(()=>store.set(id,state(now)));
 const failed=new D1AuthSessionStore({prepare(){throw Error('database offline');}},issuer);await assert.rejects(()=>failed.get(id));
 }finally{sqlite.close();}
});
test('verified provider logout revokes only the matching issuer and subject/session',async()=>{
 const {db,sqlite}=fixtureD1();try{const now=10000000,store=new D1AuthSessionStore(db,issuer,()=>now);
 await store.set(id,state(now));await store.set(otherID,state(now,'user-b','provider-b'));
 await assert.rejects(()=>store.deleteByLogoutToken({iss:'https://other.auth0.com/',sub:'user-a'}));
 await assert.rejects(()=>store.deleteByLogoutToken({}));
 await store.deleteByLogoutToken({iss:issuer,sid:'provider-a',sub:'user-a'});
 assert.equal(await store.get(id),undefined);assert.ok(await store.get(otherID));
 await store.deleteByLogoutToken({sub:'user-b'});assert.equal(await store.get(otherID),undefined);
 }finally{sqlite.close();}
});
test('released Auth0 SDK encrypted session reference works with D1 and cannot persist a revoked session',async()=>{
 const {createRequire}=await import('node:module');const {pathToFileURL}=await import('node:url');
 const require=createRequire(import.meta.url),sdkRequire=createRequire(require.resolve('@auth0/auth0-hono'));
 const {StatefulStateStore}=await import(pathToFileURL(sdkRequire.resolve('@auth0/auth0-server-js')).href);
 const {db,sqlite}=fixtureD1();try{
 const now=Date.now(),store=new D1AuthSessionStore(db,issuer),cookies=new Map();
 const cookieHandler={getCookie(name){return cookies.get(name);},setCookie(name,value){cookies.set(name,value);},deleteCookie(name){cookies.delete(name);},getCookies(){return Object.fromEntries(cookies);}};
 const sdk=new StatefulStateStore({secret:'x'.repeat(64),store,absoluteDuration:28800,inactivityDuration:1800,cookie:{secure:true,sameSite:'lax'}},cookieHandler);
 await sdk.set('__Host-atlas-session',state(now),true);
 const encrypted=cookies.get('__Host-atlas-session');assert.ok(encrypted);assert.equal(encrypted.includes('dummy-token'),false);
 assert.equal((await sdk.get('__Host-atlas-session')).user.sub,'user-a');
 await store.revokeForAccount(await subjectAccountID(issuer,'user-a'));
 await assert.rejects(()=>sdk.set('__Host-atlas-session',state(now),false));
 assert.equal(await sdk.get('__Host-atlas-session'),undefined);assert.equal(cookies.has('__Host-atlas-session'),false);
 }finally{sqlite.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {auth0Configuration,auth0Account,customerAuthPath} from '../lib/auth0-policy.ts';
const s={AUTH_PROVIDER:'auth0',ATLAS_ENVIRONMENT:'staging',AUTH0_DOMAIN:'example.eu.auth0.com',AUTH0_CLIENT_ID:'dummy',AUTH0_CLIENT_SECRET:'dummy',AUTH0_SESSION_ENCRYPTION_KEY:'x'.repeat(64),PUBLIC_APP_URL:'https://staging.example.test'};
test('Auth0 is opt-in, staging-only, bounded to a canonical secure configuration',()=>{
 assert.equal(auth0Configuration({}),null);assert.equal(auth0Configuration(s).session.cookie.secure,true);
 for(const change of [{ATLAS_ENVIRONMENT:'production'},{AUTH0_DOMAIN:'attacker.test'},{PUBLIC_APP_URL:'http://example.test'},{PUBLIC_APP_URL:'https://example.test/path'},{AUTH0_SESSION_ENCRYPTION_KEY:'short'}])assert.throws(()=>auth0Configuration({...s,...change}));
});
test('Auth0 verified identities never merge by email or cross issuers',async()=>{
 const user={sub:'dummy-a',email:'dummy@example.test',email_verified:true};
 const a=await auth0Account(user,s.AUTH0_DOMAIN);
 assert.notEqual(a.id,(await auth0Account({...user,sub:'dummy-b'},s.AUTH0_DOMAIN)).id);
 assert.notEqual(a.id,(await auth0Account(user,'other.auth0.com')).id);
 await assert.rejects(()=>auth0Account({...user,email_verified:false},s.AUTH0_DOMAIN));
 await assert.rejects(()=>auth0Account(undefined,s.AUTH0_DOMAIN));
});
test('public atlas and provider webhook do not require a customer session',()=>{
 for(const path of ['/','/api/feed','/api/billing/plans','/api/billing/webhook','/api/v1/health/live'])assert.equal(customerAuthPath(path),false);
 for(const path of ['/account','/auth/callback','/api/billing/status','/api/billing/checkout','/api/pro/scenarios','/account/security','/api/v1/account/sessions','/organizations','/api/v1/organizations','/api/v1/organizations/invitations/accept'])assert.equal(customerAuthPath(path),true);
});

import type {auth} from '@auth0/auth0-hono';
type Options=NonNullable<Parameters<typeof auth>[0]>;
type Store=NonNullable<Exclude<Options['session'],undefined|false>['store']>;
type State=Parameters<Store['set']>[1];
type DB=Pick<D1Database,'prepare'>;
export async function subjectAccountID(issuer:string,subject:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(issuer+'\0'+subject))),b=>b.toString(16).padStart(2,'0')).join('');}
export class D1AuthSessionStore implements Store {
 private db:DB;private issuer:string;private now:()=>number;
 constructor(db:DB,issuer:string,now:()=>number=Date.now){this.db=db;this.issuer=issuer;this.now=now;}
 async set(id:string,state:State){
  const now=this.now(),subject=state.user?.sub,created=state.internal?.createdAt;
  if(!/^[a-f0-9]{32}$/.test(id)||typeof subject!=='string'||!subject||subject.length>200||!Number.isFinite(created)||created*1000>now+30000)throw Error('Invalid session state');
  const absolute=created*1000+28800000;
  const expiry=Math.min(now+1800000,absolute,typeof state.sessionExpiresAt==='number'?state.sessionExpiresAt*1000:absolute);
  if(expiry<=now)throw Error('Expired session state');
  const payload=JSON.stringify(state);if(new TextEncoder().encode(payload).length>64000)throw Error('Session too large');
  const account=await subjectAccountID(this.issuer,subject);
  const result=await this.db.prepare(`INSERT INTO auth_sessions(id,issuer,account_id,subject,provider_sid,payload,expires_at,absolute_expires_at,created_at,last_seen_at)
   VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=MIN(excluded.expires_at,auth_sessions.absolute_expires_at),last_seen_at=excluded.last_seen_at
   WHERE auth_sessions.revoked_at IS NULL AND auth_sessions.expires_at>? AND auth_sessions.issuer=excluded.issuer AND auth_sessions.subject=excluded.subject RETURNING id`)
   .bind(id,this.issuer,account,subject,state.internal.sid||null,payload,expiry,absolute,created*1000,now,now).first();
  if(!result)throw Error('Session was revoked or expired');
 }
 async get(id:string):Promise<State|undefined>{
  const row=await this.db.prepare('UPDATE auth_sessions SET last_seen_at=? WHERE id=? AND issuer=? AND revoked_at IS NULL AND expires_at>? AND absolute_expires_at>? RETURNING payload').bind(this.now(),id,this.issuer,this.now(),this.now()).first<{payload:string}>();
  return row?JSON.parse(row.payload) as State:undefined;
 }
 async delete(id:string){
  const now=this.now();
  // Keep tombstones at least as long as any previously issued cookie could remain valid.
  await this.db.prepare(`INSERT INTO auth_sessions(id,issuer,account_id,subject,payload,expires_at,absolute_expires_at,created_at,last_seen_at,revoked_at) VALUES(?,?,'','','',?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET revoked_at=excluded.revoked_at,payload='' WHERE auth_sessions.issuer=excluded.issuer`).bind(id,this.issuer,now,now+28800000,now,now,now).run();
 }
 async deleteByLogoutToken(claims:Parameters<Store['deleteByLogoutToken']>[0]){
  if(claims.iss&&claims.iss!==this.issuer)throw Error('Logout issuer mismatch');
  if(!claims.sid&&!claims.sub)throw Error('Logout subject missing');
  // Called only after the SDK verifies the logout token signature, issuer and audience.
  await this.db.prepare(`UPDATE auth_sessions SET revoked_at=?,payload='' WHERE issuer=? AND revoked_at IS NULL AND (? IS NULL OR provider_sid=?) AND (? IS NULL OR subject=?)`)
   .bind(this.now(),this.issuer,claims.sid||null,claims.sid||null,claims.sub||null,claims.sub||null).run();
 }
 async listForAccount(accountID:string){return (await this.db.prepare('SELECT id,created_at,last_seen_at,expires_at FROM auth_sessions WHERE account_id=? AND issuer=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 100').bind(accountID,this.issuer,this.now()).all()).results;}
 async revokeForAccount(accountID:string,id?:string){const result=await this.db.prepare("UPDATE auth_sessions SET revoked_at=?,payload='' WHERE account_id=? AND issuer=? AND revoked_at IS NULL AND (? IS NULL OR id=?) RETURNING id").bind(this.now(),accountID,this.issuer,id||null,id||null).all();return {revoked:result.results.length};}
 async prune(){return this.db.prepare('DELETE FROM auth_sessions WHERE absolute_expires_at<?').bind(this.now()-86400000).run();}
}
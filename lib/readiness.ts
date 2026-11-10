type Database = {prepare(sql:string):{first():Promise<unknown>}};
export async function databaseReady(db:Database|undefined,organizations=false,sessions=false,billingJobs=false){
 if(!db)return false;
 try {
  // Verify tables/columns required by the current atlas and account runtime, not just connectivity.
  await db.prepare('SELECT key,payload,last_success,next_attempt,lease_until FROM data_snapshots LIMIT 0').first();
  await db.prepare('SELECT id,customer_id,checkout_locked_until,checkout_url,checkout_plan,checkout_until FROM billing_accounts LIMIT 0').first();
  await db.prepare('SELECT account_id,plan,status,period_end,synced_at FROM billing_subscriptions LIMIT 0').first();
  await db.prepare('SELECT id,processed_at FROM billing_events LIMIT 0').first();
  await db.prepare('SELECT id,account_id,period,payload,created_at FROM professional_scenarios LIMIT 0').first();
  if(organizations){
   await db.prepare('SELECT id,email FROM users LIMIT 0').first();
   await db.prepare('SELECT id,name,seat_limit FROM organizations LIMIT 0').first();
   await db.prepare('SELECT organization_id,user_id,role FROM organization_members LIMIT 0').first();
   await db.prepare('SELECT organization_id,token_hash,expires_at FROM organization_invitations LIMIT 0').first();
   await db.prepare('SELECT organization_id,actor_id,action FROM organization_audit_logs LIMIT 0').first();
  }
  if(sessions)await db.prepare('SELECT id,issuer,account_id,payload,expires_at,revoked_at FROM auth_sessions LIMIT 0').first();
  if(billingJobs)await db.prepare('SELECT id,state,attempts,lease_token,lease_until,dispatch_after FROM billing_inbox LIMIT 0').first();
  return true;
 }catch{return false;}
}

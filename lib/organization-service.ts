import {BillingError} from './billing-policy.ts';
import {createOrganization,createInvitation,changeMember,hashInvitation,newInvitationToken} from './organization-policy.ts';
type Actor={id:string;email:string};
type DB=Pick<D1Database,'prepare'|'batch'>;
const manager="EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=? AND a.user_id=? AND (a.role='owner' OR (a.role='admin' AND ? IN ('member','viewer'))))";
export async function registerOrganizationUser(db:DB,actor:Actor){await db.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(actor.id,actor.email.toLowerCase(),Date.now()).run();}
export async function listOrganizations(db:DB,actor:Actor){return (await db.prepare('SELECT o.id,o.name,o.seat_limit,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE m.user_id=? ORDER BY o.created_at DESC LIMIT 50').bind(actor.id).all()).results;}
export async function createOrganizationFor(db:DB,actor:Actor,input:unknown){
 const body=createOrganization.parse(input),now=Date.now();await registerOrganizationUser(db,actor);
 // Limit owned organizations in the write itself, including simultaneous requests.
 const result=await db.batch([
  db.prepare('INSERT INTO organizations(id,name,created_by,seat_limit,created_at) SELECT ?,?,?,5,? WHERE (SELECT COUNT(*) FROM organizations WHERE created_by=?)<10 ON CONFLICT(id) DO NOTHING RETURNING id').bind(body.requestId,body.name,actor.id,now,actor.id),
  db.prepare("INSERT INTO organization_members(organization_id,user_id,role,joined_at) SELECT id,?,'owner',? FROM organizations WHERE id=? AND created_by=? ON CONFLICT DO NOTHING").bind(actor.id,now,body.requestId,actor.id),
  db.prepare("INSERT INTO organization_audit_logs(id,organization_id,actor_id,action,target_id,created_at) SELECT ?,id,?,'organization.created',id,? FROM organizations WHERE id=? AND created_by=? ON CONFLICT DO NOTHING").bind('create:'+body.requestId,actor.id,now,body.requestId,actor.id),
 ]);
 const row=await db.prepare('SELECT o.id,o.name,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE o.id=? AND m.user_id=? AND o.created_by=?').bind(body.requestId,actor.id,actor.id).first();
 if(!row)throw new BillingError(409,'Organization could not be created. Check the limit or request ID.');
 if((row as {name:string}).name!==body.name)throw new BillingError(409,'Request ID was already used for another organization name.');
 return {...row,replayed:result[0].results.length===0};
}
export async function organizationDetail(db:DB,actor:Actor,id:string){
 const row=await db.prepare('SELECT o.id,o.name,o.seat_limit,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE o.id=? AND m.user_id=?').bind(id,actor.id).first();
 if(!row)throw new BillingError(404,'Organization not found.');
 const members=await db.prepare('SELECT m.user_id,m.role,m.joined_at FROM organization_members m WHERE m.organization_id=? AND EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=m.organization_id AND a.user_id=?) ORDER BY m.joined_at LIMIT 100').bind(id,actor.id).all();
 return {...row,members:members.results}; // No member email directory exposed to viewers.
}
export async function inviteToOrganization(db:DB,actor:Actor,id:string,input:unknown){
 const body=createInvitation.parse(input),token=newInvitationToken(),hash=await hashInvitation(token),now=Date.now(),invitationID=crypto.randomUUID();
 // Pending unexpired invitations reserve seats; existing members do not receive duplicate reservations.
 const result=await db.batch([
  db.prepare(`INSERT INTO organization_invitations(id,organization_id,email,role,token_hash,expires_at,created_at)
   SELECT ?,o.id,?,?,?,?,? FROM organizations o WHERE o.id=? AND ${manager}
   AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=o.id AND u.email=?)
   AND (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id=o.id)+(SELECT COUNT(*) FROM organization_invitations i WHERE i.organization_id=o.id AND i.expires_at>? AND i.email<>?)<o.seat_limit
   ON CONFLICT(organization_id,email) DO UPDATE SET id=excluded.id,role=excluded.role,token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=excluded.created_at RETURNING id`).bind(invitationID,body.email,body.role,hash,now+7*86400000,now,id,id,actor.id,body.role,body.email,now,body.email),
  db.prepare("INSERT INTO organization_audit_logs(id,organization_id,actor_id,action,target_id,created_at) SELECT ?,organization_id,?,'invitation.created',id,? FROM organization_invitations WHERE id=? AND token_hash=?").bind(crypto.randomUUID(),actor.id,now,invitationID,hash),
 ]);
 if(!result[0].results.length)throw new BillingError(409,'Invitation not permitted, recipient already joined, or no seats available.');
 return {id:invitationID,token,expiresAt:now+7*86400000}; // One-time reveal, never store the bearer token.
}
export async function acceptOrganizationInvitation(db:DB,actor:Actor,token:string){
 const hash=await hashInvitation(token),now=Date.now();await registerOrganizationUser(db,actor);
 const result=await db.batch([
  db.prepare(`INSERT INTO organization_members(organization_id,user_id,role,joined_at)
   SELECT i.organization_id,?,i.role,? FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id
   WHERE i.token_hash=? AND i.email=? AND i.expires_at>?
   AND (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id=o.id)<o.seat_limit
   ON CONFLICT DO NOTHING RETURNING organization_id`).bind(actor.id,now,hash,actor.email.toLowerCase(),now),
  db.prepare("INSERT INTO organization_audit_logs(id,organization_id,actor_id,action,target_id,created_at) SELECT ?,i.organization_id,?,'invitation.accepted',i.id,? FROM organization_invitations i JOIN organization_members m ON m.organization_id=i.organization_id WHERE i.token_hash=? AND i.email=? AND m.user_id=? AND i.expires_at>?").bind(crypto.randomUUID(),actor.id,now,hash,actor.email.toLowerCase(),actor.id,now),
  db.prepare('DELETE FROM organization_invitations WHERE token_hash=? AND email=? AND EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=organization_invitations.organization_id AND m.user_id=?)').bind(hash,actor.email.toLowerCase(),actor.id),
 ]);
 if(!result[0].results.length)throw new BillingError(409,'Invitation unavailable, already used, expired, or no seats available.');
 return {organizationId:(result[0].results[0] as {organization_id:string}).organization_id};
}
export async function changeOrganizationMember(db:DB,actor:Actor,id:string,input:unknown){
 const body=changeMember.parse(input),now=Date.now();
 const guard="organization_id=? AND user_id=? AND role<>'owner' AND EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=? AND a.user_id=? AND a.role='owner')";
 const result=await db.batch([
  db.prepare(`INSERT INTO organization_audit_logs(id,organization_id,actor_id,action,target_id,created_at) SELECT ?,organization_id,?,'member.role_changed',user_id,? FROM organization_members WHERE ${guard}`).bind(crypto.randomUUID(),actor.id,now,id,body.userId,id,actor.id),
  db.prepare(`UPDATE organization_members SET role=? WHERE ${guard} RETURNING user_id`).bind(body.role,id,body.userId,id,actor.id),
 ]);
 if(!result[1].results.length)throw new BillingError(404,'Member not found or change not permitted.');
 return {updated:true};
}
export async function removeOrganizationMember(db:DB,actor:Actor,id:string,userId:string){
 const guard="organization_id=? AND user_id=? AND role<>'owner' AND EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=? AND a.user_id=? AND a.role='owner')";
 const result=await db.batch([
  db.prepare(`INSERT INTO organization_audit_logs(id,organization_id,actor_id,action,target_id,created_at) SELECT ?,organization_id,?,'member.removed',user_id,? FROM organization_members WHERE ${guard}`).bind(crypto.randomUUID(),actor.id,Date.now(),id,userId,id,actor.id),
  db.prepare(`DELETE FROM organization_members WHERE ${guard} RETURNING user_id`).bind(id,userId,id,actor.id),
 ]);
 if(!result[1].results.length)throw new BillingError(404,'Member not found or removal not permitted.');return {removed:true};
}
export async function listOrganizationInvitations(db:DB,actor:Actor,id:string){
 const permitted=await db.prepare("SELECT role FROM organization_members WHERE organization_id=? AND user_id=? AND role IN ('owner','admin')").bind(id,actor.id).first();
 if(!permitted)throw new BillingError(404,'Organization not found.');
 return (await db.prepare("SELECT id,email,role,expires_at FROM organization_invitations i WHERE organization_id=? AND EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=i.organization_id AND a.user_id=? AND a.role IN ('owner','admin')) ORDER BY created_at DESC LIMIT 100").bind(id,actor.id).all()).results;
}
export async function revokeOrganizationInvitation(db:DB,actor:Actor,id:string,invitationID:string){
 const guard="organization_id=? AND id=? AND EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=? AND a.user_id=? AND (a.role='owner' OR (a.role='admin' AND organization_invitations.role IN ('member','viewer'))))";
 const result=await db.batch([
  db.prepare(`INSERT INTO organization_audit_logs(id,organization_id,actor_id,action,target_id,created_at) SELECT ?,organization_id,?,'invitation.revoked',id,? FROM organization_invitations WHERE ${guard}`).bind(crypto.randomUUID(),actor.id,Date.now(),id,invitationID,id,actor.id),
  db.prepare(`DELETE FROM organization_invitations WHERE ${guard} RETURNING id`).bind(id,invitationID,id,actor.id),
 ]);
 if(!result[1].results.length)throw new BillingError(404,'Invitation not found or revocation not permitted.');return {revoked:true};
}
export async function listOrganizationAudit(db:DB,actor:Actor,id:string){
 const permitted=await db.prepare("SELECT role FROM organization_members WHERE organization_id=? AND user_id=? AND role IN ('owner','admin')").bind(id,actor.id).first();
 if(!permitted)throw new BillingError(404,'Organization not found.');
 return (await db.prepare("SELECT id,actor_id,action,target_id,created_at FROM organization_audit_logs l WHERE organization_id=? AND EXISTS(SELECT 1 FROM organization_members a WHERE a.organization_id=l.organization_id AND a.user_id=? AND a.role IN ('owner','admin')) ORDER BY created_at DESC,id DESC LIMIT 100").bind(id,actor.id).all()).results;
}

import {z} from 'zod';
export const organizationID=z.string().uuid();
export const roleSchema=z.enum(['admin','billing_admin','member','viewer']);
export type OrganizationRole='owner'|z.infer<typeof roleSchema>;
export type OrganizationAction='read'|'invite'|'manage_members'|'billing'|'write'|'audit';
const permissions:Record<OrganizationRole,readonly OrganizationAction[]>={owner:['read','invite','manage_members','billing','write','audit'],admin:['read','invite','write','audit'],billing_admin:['read','billing'],member:['read','write'],viewer:['read']};
export function allowed(role:unknown,action:OrganizationAction){return typeof role==='string'&&Object.hasOwn(permissions,role)&&permissions[role as OrganizationRole].includes(action);}
export const createOrganization=z.object({requestId:z.string().uuid(),name:z.string().trim().min(2).max(100)}).strict();
export const createInvitation=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),role:roleSchema}).strict();
export const changeMember=z.object({userId:z.string().regex(/^[a-f0-9]{64}$/),role:roleSchema}).strict();
export const acceptInvitation=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export async function hashInvitation(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');}
export function newInvitationToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
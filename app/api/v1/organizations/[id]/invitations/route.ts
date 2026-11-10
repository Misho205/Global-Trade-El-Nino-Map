import {z} from 'zod';
import {organizationRequest} from '@/lib/organization-server';
import {inviteToOrganization,listOrganizationInvitations,revokeOrganizationInvitation} from '@/lib/organization-service';
import {organizationID} from '@/lib/organization-policy';
import {limitedJSON} from '@/lib/billing-server';
type Context={params:Promise<{id:string}>};
export function GET(request:Request,{params}:Context){return organizationRequest(request,false,async(db,actor)=>({invitations:await listOrganizationInvitations(db,actor,organizationID.parse((await params).id))}));}
export function POST(request:Request,{params}:Context){return organizationRequest(request,true,async(db,actor)=>inviteToOrganization(db,actor,organizationID.parse((await params).id),await limitedJSON(request)));}
export function DELETE(request:Request,{params}:Context){return organizationRequest(request,true,async(db,actor)=>{const body=z.object({invitationId:z.string().uuid()}).strict().parse(await limitedJSON(request));return revokeOrganizationInvitation(db,actor,organizationID.parse((await params).id),body.invitationId);});}
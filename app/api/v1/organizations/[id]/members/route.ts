import {z} from 'zod';
import {organizationRequest} from '@/lib/organization-server';
import {changeOrganizationMember,removeOrganizationMember} from '@/lib/organization-service';
import {organizationID} from '@/lib/organization-policy';
import {limitedJSON} from '@/lib/billing-server';
type Context={params:Promise<{id:string}>};
export function PATCH(request:Request,{params}:Context){return organizationRequest(request,true,async(db,actor)=>changeOrganizationMember(db,actor,organizationID.parse((await params).id),await limitedJSON(request)));}
export function DELETE(request:Request,{params}:Context){return organizationRequest(request,true,async(db,actor)=>{const body=z.object({userId:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(await limitedJSON(request));return removeOrganizationMember(db,actor,organizationID.parse((await params).id),body.userId);});}
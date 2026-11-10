import {organizationRequest} from '@/lib/organization-server';
import {listOrganizationAudit} from '@/lib/organization-service';
import {organizationID} from '@/lib/organization-policy';
export function GET(request:Request,{params}:{params:Promise<{id:string}>}){return organizationRequest(request,false,async(db,actor)=>({events:await listOrganizationAudit(db,actor,organizationID.parse((await params).id))}));}
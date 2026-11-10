import {organizationRequest} from '@/lib/organization-server';
import {acceptOrganizationInvitation} from '@/lib/organization-service';
import {acceptInvitation} from '@/lib/organization-policy';
import {limitedJSON} from '@/lib/billing-server';
export function POST(request:Request){return organizationRequest(request,true,async(db,actor)=>acceptOrganizationInvitation(db,actor,acceptInvitation.parse(await limitedJSON(request)).token));}
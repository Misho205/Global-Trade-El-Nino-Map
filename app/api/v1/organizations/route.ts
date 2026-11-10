import {organizationRequest} from '@/lib/organization-server';
import {listOrganizations,createOrganizationFor} from '@/lib/organization-service';
import {limitedJSON} from '@/lib/billing-server';
export function GET(request:Request){return organizationRequest(request,false,async(db,actor)=>({organizations:await listOrganizations(db,actor)}));}
export function POST(request:Request){return organizationRequest(request,true,async(db,actor)=>createOrganizationFor(db,actor,await limitedJSON(request)));}
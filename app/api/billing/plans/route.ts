import {plans} from '@/lib/billing-policy';
import {billingReady,billingJSON} from '@/lib/billing-server';
export async function GET(){return billingJSON({plans,checkoutEnabled:billingReady(),currency:'EUR',enterprise:'By quotation',note:'Pilot proposal. No live route optimization, navigational clearance or team seats included.'});}

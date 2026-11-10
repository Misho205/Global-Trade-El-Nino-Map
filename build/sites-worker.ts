import {runResearchUpdates} from '../lib/research-sources';
import {RESEARCH_CRON} from './research-schedule';
import {dispatchBillingJobs,consumeBillingJobs} from '../lib/billing-jobs';
import {D1AuthSessionStore} from '../lib/auth-session-store';
import { withCustomerAuth } from '../lib/customer-auth';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { runBackgroundUpdates } from '../lib/background-updates';

export default {
  async queue(batch:MessageBatch<unknown>,env:Cloudflare.Env){await consumeBillingJobs(batch,env as unknown as Record<string,unknown>);},
  async scheduled(_event: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    const settings=_env as unknown as Record<string,unknown>;
    // Separate scheduled invocations keep research queries out of the collector's D1 budget.
    if(_event.cron===RESEARCH_CRON){if(settings.ATLAS_RESEARCH_UPDATES!=='true')throw Error('Research schedule is disabled');await runResearchUpdates();return;}
    // Independent jobs all run; a billing failure must not skip public-data collection.
    const results=await Promise.allSettled([
      (async()=>{if(settings.AUTH_PROVIDER==='auth0'&&_env.DB&&typeof settings.AUTH0_DOMAIN==='string')await new D1AuthSessionStore(_env.DB,'https://'+settings.AUTH0_DOMAIN+'/').prune();})(),
      dispatchBillingJobs(settings),
      runBackgroundUpdates(360_000),
    ]);
    if(results.some(r=>r.status==='rejected')){console.error(JSON.stringify({event:'scheduled_job_failed',jobs:results.map(r=>r.status)}));throw Error('One or more scheduled jobs failed');}

  },
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return withCustomerAuth(request, env as unknown as Record<string, unknown>, async () => runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx)));
  },
};

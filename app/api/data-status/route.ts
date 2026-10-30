import { env } from 'cloudflare:workers';

export async function GET() {
  if (!env.DB) return Response.json({storage:false, sources:[], error:'Persistent storage is not configured.'},{headers:{'Cache-Control':'no-store'}});
  try {
    const rows = await env.DB.prepare("SELECT key, last_success, last_attempt, next_attempt, error FROM data_snapshots WHERE key IN ('climate','agreements','__updater') OR key LIKE 'water:%' ORDER BY key LIMIT 260").all();
    const updater = await env.DB.prepare("SELECT payload FROM data_snapshots WHERE key = '__updater'").first<{payload:string|null}>();
    return Response.json({storage:true, sources:rows.results, background:updater?.payload ? JSON.parse(updater.payload) : null, checkedAt:new Date().toISOString()}, {headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({storage:false, sources:[], error:'Persistent storage unavailable or migrations pending.'},{headers:{'Cache-Control':'no-store'}}); }
}

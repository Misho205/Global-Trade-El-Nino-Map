import { env } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { runBackgroundUpdates } from '@/lib/background-updates';

// Writes are closed by default, including when deployed as a public Worker.
// A private Sites deployment may explicitly opt into its service-access boundary.
export async function POST(request: Request) {
  const settings = env as unknown as Record<string, unknown>;
  const expected = typeof settings.UPDATE_TOKEN === 'string' ? settings.UPDATE_TOKEN : '';
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const tokenOK = expected.length >= 32 && supplied.length <= 256 &&
    Buffer.byteLength(expected) === Buffer.byteLength(supplied) && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  if (!tokenOK && settings.UPDATE_AUTH_MODE !== 'sites-owner-private') return Response.json({error:'Updater authorization required.'},{status:403});
  try { return Response.json(await runBackgroundUpdates(),{headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'Background update unavailable; check storage and migrations.'},{status:503}); }
}

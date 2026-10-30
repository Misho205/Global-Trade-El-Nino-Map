type BuildSettings = Record<string, string | undefined>;
export function cloudflareTarget(settings: BuildSettings) {
  const standalone = settings.ATLAS_DEPLOY_TARGET === 'cloudflare' || settings.ATLAS_ENABLE_CRON === 'true';
  const databaseId = settings.CLOUDFLARE_D1_DATABASE_ID;
  if (standalone && (!databaseId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(databaseId) || databaseId === '00000000-0000-4000-8000-000000000000')) {
    throw new Error('Standalone Cloudflare build requires a real CLOUDFLARE_D1_DATABASE_ID. Create the database and set its ID before building.');
  }
  return {standalone, databaseId: standalone ? databaseId : undefined};
}

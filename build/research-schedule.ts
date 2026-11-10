export const RESEARCH_CRON='*/5 * * * *';
export function researchSchedule(settings:Record<string,string|undefined>){
 if(settings.ATLAS_RESEARCH_UPDATES!=='true')return null;
 if(settings.ATLAS_DEPLOY_TARGET!=='cloudflare'||settings.ATLAS_ENABLE_CRON!=='true')throw Error('Background research updates require standalone Cloudflare with Cron enabled.');
 return {cron:RESEARCH_CRON,vars:{ATLAS_RESEARCH_UPDATES:'true'}};
}
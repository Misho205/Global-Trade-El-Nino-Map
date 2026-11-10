type Settings = Record<string, string | undefined>;
const placeholder = '00000000-0000-4000-8000-000000000000';
export function deploymentEnvironment(settings: Settings) {
 const name=settings.ATLAS_ENVIRONMENT;
 if(name===undefined)return null; // Preserve existing Sites/standalone configuration.
 if(!['local','staging','production'].includes(name))throw Error('ATLAS_ENVIRONMENT must be local, staging or production.');
 const workerName=settings.ATLAS_WORKER_NAME, databaseName=settings.CLOUDFLARE_D1_DATABASE_NAME;
 if(!workerName||!databaseName)throw Error('Explicit environments require Worker and D1 names.');
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(workerName)||!/^[a-zA-Z0-9_-]{1,64}$/.test(databaseName))throw Error('Invalid Worker or D1 name.');
 if(name!=='local'){
  if(settings.ATLAS_DEPLOY_TARGET!=='cloudflare')throw Error('Remote environments require ATLAS_DEPLOY_TARGET=cloudflare.');
  const id=settings.CLOUDFLARE_D1_DATABASE_ID;
  if(!id||id===placeholder||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw Error('Remote environments require a real D1 ID.');
  if(!workerName.endsWith('-'+name)||!databaseName.endsWith('-'+name))throw Error('Worker and D1 names must end with the environment suffix.');
 }
 return {name,workerName,databaseName};
}

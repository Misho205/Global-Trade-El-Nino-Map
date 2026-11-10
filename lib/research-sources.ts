import {env} from 'cloudflare:workers';
import {persistentData} from './persistent-data';
import {researchSources,parseBuoys,parseEarthquakes,parseMonthlyIndex,type ResearchSource} from './research-data';
import {isCalendarDate} from './input-validation';
export async function sha256(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
async function upstreamText(url:string){
 const response=await fetch(url,{headers:{'User-Agent':'Global-Trade-El-Nino-Map/0.1 research (+https://github.com/Misho205/Global-Trade-El-Nino-Map)'},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Official source returned HTTP '+response.status);const reader=response.body?.getReader();if(!reader)throw Error('Empty source response');const decoder=new TextDecoder();let result='',size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>3000000){await reader.cancel();throw Error('Source response exceeded the bounded research limit');}result+=decoder.decode(part.value,{stream:true});}return result+decoder.decode();
}
export function validResearchDate(date:string){return isCalendarDate(date)&&date>='1950-01-01'&&date<=new Date().toISOString().slice(0,10);}
export async function fetchResearch(source:ResearchSource,date?:string){
 let url:string=researchSources[source].url;const current=!date||date===new Date().toISOString().slice(0,10);let start:number|undefined,end:number|undefined;
 if(source==='earthquakes'&&!current){if(!validResearchDate(date!))throw Error('Invalid research date');start=Date.parse(date!+'T00:00:00Z');end=start+86400000;url='https://earthquake.usgs.gov/fdsnws/event/1/query?'+new URLSearchParams({format:'geojson',starttime:new Date(start).toISOString(),endtime:new Date(end).toISOString(),minmagnitude:'2.5',eventtype:'earthquake',orderby:'time',limit:'1000'});}
 const text=await upstreamText(url),parsed=source==='earthquakes'?parseEarthquakes(JSON.parse(text||'{"type":"FeatureCollection","features":[]}'),start,end):source==='buoys'?parseBuoys(text):{records:parseMonthlyIndex(text),complete:true,rejected:0};
 const records=parsed.records;
 return Response.json({schemaVersion:'atlas-research/1',sourceId:source,...researchSources[source],sourceUrl:url,retrievedAt:new Date().toISOString(),sourceSha256:await sha256(text),normalizedSha256:await sha256(JSON.stringify(records)),query:source==='earthquakes'?{date:current?'rolling_24_hours':date,minMagnitude:2.5,limit:1000}:null,kind:source==='dmi'||source==='soi'?'monthly_index':'observations',...parsed,recordCount:records.length,errors:[]});
}
export function researchSnapshot(source:ResearchSource,date?:string,requested=true){
 const historical=source==='earthquakes'&&!!date&&date!==new Date().toISOString().slice(0,10);
 return persistentData('research:'+source+(source==='earthquakes'?':'+(historical?date:'live'):''),source==='dmi'||source==='soi'||historical?86400000:300000,()=>fetchResearch(source,date),d=>d.schemaVersion==='atlas-research/1'&&Array.isArray(d.records)&&!!d.sourceSha256&&!d.errors?.length,requested);
}
export async function runResearchUpdates(){
 const results=await Promise.allSettled((Object.keys(researchSources) as ResearchSource[]).map(async source=>{const response=await researchSnapshot(source,undefined,false);const data=await response.json() as {refresh?:{state:string}};return {source,state:data.refresh?.state||'unavailable'};}));
 if(env.DB)await env.DB.prepare("DELETE FROM data_snapshots WHERE key LIKE 'research:earthquakes:%' AND key<>'research:earthquakes:live' AND last_requested<? AND lease_until<=?").bind(Date.now()-30*86400000,Date.now()).run();
 console.info(JSON.stringify({event:'research_refresh',results:results.map(r=>r.status==='fulfilled'?r.value:{state:'unavailable'})}));
 if(results.some(r=>r.status==='rejected'||r.value.state!=='fresh'))throw Error('Research sources stale or unavailable');
}
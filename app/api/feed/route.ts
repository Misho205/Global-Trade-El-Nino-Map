import {decodeNumericEntity} from '@/lib/input-validation';
import {persistentData} from '@/lib/persistent-data';
const urls={cpc:'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml',oni:'https://psl.noaa.gov/data/correlation/oni.data'};
const strip=(s:string)=>s.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&ntilde;/g,'ñ').replace(/&Ntilde;/g,'Ñ').replace(/&#(\d+);/g,decodeNumericEntity).replace(/&deg;/g,'°').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export async function fetchClimate(){
 const errors:string[]=[];const result={fetchedAt:new Date().toISOString(),status:'Unavailable',issue:'',synopsis:'',oni:[] as {year:number;values:number[]}[],errors};
 await Promise.allSettled([fetch(urls.cpc,{signal:AbortSignal.timeout(12000)}).then(async r=>{if(!r.ok)throw Error(`CPC ${r.status}`);const html=await r.text(),text=strip(html);result.issue=text.match(/\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d{2}\b/)?.[0]||'';result.status=text.match(/ENSO Alert System Status:\s*([^]*?)(?=Synopsis:)/i)?.[1]?.trim()||'Read official discussion';result.synopsis=text.match(/Synopsis:\s*([^]*?)(?=El Niño strengthened|During |El Niño conditions|ENSO-neutral|La Niña conditions)/i)?.[1]?.trim()||text.match(/Synopsis:\s*([^]*?[.!])(?:\s|$)/i)?.[1]||'';if(result.synopsis.length>700)result.synopsis=result.synopsis.slice(0,700);if(!result.issue||!result.synopsis)errors.push('CPC format changed; consult the source for the full outlook.');}).catch(e=>errors.push(`NOAA outlook unavailable: ${e.message}`)),fetch(urls.oni,{signal:AbortSignal.timeout(12000)}).then(async r=>{if(!r.ok)throw Error(`ONI ${r.status}`);const text=await r.text();result.oni=text.split(/\r?\n/).map(l=>l.trim().split(/\s+/).map(Number)).filter(row=>row.length===13&&row[0]>=1950&&row[0]<=2100&&row.every(Number.isFinite)).map(row=>({year:row[0],values:row.slice(1)}));if(!result.oni.length)errors.push('Historical ONI dataset unavailable or its format changed.');}).catch(e=>errors.push(`NOAA historical index unavailable: ${e.message}`))]);
 return Response.json(result,{headers:{'Cache-Control':'public, max-age=300'}});
}
export function climateSnapshot(requested = true) {
 return persistentData('climate', 900_000, fetchClimate, d => !!d.issue && !!d.synopsis && d.oni?.length > 0 && !d.errors?.length, requested);
}
export async function GET(){ return climateSnapshot(); }

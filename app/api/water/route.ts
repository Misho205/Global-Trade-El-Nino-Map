import {stations} from '@/lib/atlas-data';
import {persistentData} from '@/lib/persistent-data';
import {isCalendarDate} from '@/lib/input-validation';
export async function fetchWater(request:Request){const q=new URL(request.url).searchParams,station=q.get('station')||'9414290',date=q.get('date')||new Date().toISOString().slice(0,10);if(!stations.some(s=>s.id===station)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<'1950-01-01'||date>new Date().toISOString().slice(0,10))return Response.json({error:'Invalid station or date'},{status:400});
 const errors:string[]=[];const result={station,date,datum:'MSL',units:'meters',timezone:'UTC',observations:[],previous:[],predictions:[],fetchedAt:new Date().toISOString(),errors};const next=new Date(date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);let previous=(Number(date.slice(5,7))<6?'2024-':'2023-')+date.slice(5);
 const get=async(d:string,product:string,label:string)=>{try{const day=d.replaceAll('-','');const u=new URL('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');for(const[k,v]of Object.entries({product,station,begin_date:day,end_date:day,datum:'MSL',time_zone:'gmt',units:'metric',format:'json',application:'TerraTradeAtlas',...(product==='predictions'?{interval:'h'}:{})}))u.searchParams.set(k,v);const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`NOAA ${r.status}`);const j:any=await r.json();if(j.error)throw Error(j.error.message);const data=j.data||j.predictions||[];return data.filter((x:any)=>x.v!==''&&Number.isFinite(Number(x.v))).map((x:any)=>({t:x.t,v:x.v,q:x.q||'prediction'}));}catch(e:any){errors.push(`${label}: ${e.message}`);return[];}};
 const dayAge=(Date.now()-Date.parse(date+'T00:00:00Z'))/86400000;const [observations,past,predictions]=await Promise.all([get(date,dayAge<31?'water_level':'hourly_height','Selected-day observations'),get(previous,'hourly_height','2023–24 El Niño comparison'),get(next.toISOString().slice(0,10),'predictions','Next-day astronomical tide')]);return Response.json({...result,observations,previous:past,predictions,previousDate:previous,predictionDate:next.toISOString().slice(0,10),observationProduct:dayAge<31?'water_level (may be preliminary)':'hourly_height',note:'Tide predictions exclude El Niño and storm-driven residuals.'},{headers:{'Cache-Control':'public, max-age=300'}});
}
export function waterSnapshot(station: string, date: string, requested = true) {
 const current = date === new Date().toISOString().slice(0,10);
 return persistentData(`water:${station}:${date}`, current ? 360_000 : 86_400_000,
  () => fetchWater(new Request(`https://atlas.internal/api/water?${new URLSearchParams({station,date})}`)),
  d => d.observations?.length > 0 && d.predictions?.length > 0 && !d.errors?.length, requested);
}
export async function GET(request: Request) {
 const p = new URL(request.url).searchParams;
 const station = p.get('station') || '9414290', date = p.get('date') || new Date().toISOString().slice(0,10);
 if(!stations.some(s=>s.id===station)||!isCalendarDate(date)||date<'1950-01-01'||date>new Date().toISOString().slice(0,10)) return Response.json({error:'Invalid station or date'},{status:400});
 return waterSnapshot(station, date);
}

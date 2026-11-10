/** Offline planning estimates. Never a navigation clearance or route optimizer. */
export type VesselProfile={name:string;cargo:'containers'|'bulk'|'petroleum'|'precious_metals';speedKn:number;fuelTonnesDay:number;fuelPriceUsdTonne:number;draftM:number;minUkm:number;maxWindMs:number;maxWaveM:number};
export type Candidate={id:string;name:string;path:number[][]};
export type SegmentForecast={segment:number;issuedAt:string;validFrom:string;validTo:string;sourceUrl:string;windMs:number;waveM:number;alongTrackCurrentKn:number};
export type PlanningInput={departureUtc:string;vessel:VesselProfile;candidates:Candidate[];forecasts?:Record<string,SegmentForecast[]>};
const rad=(v:number)=>v*Math.PI/180;
function km(a:number[],b:number[]){const h=Math.sin(rad(b[1]-a[1])/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(rad(b[0]-a[0])/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));}
function finite(v:unknown,min:number,max:number):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;}
function time(v:unknown){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?Z$/.test(v))return NaN;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,16)===v.slice(0,16)?n:NaN;}
function text(v:unknown,max=120){return typeof v==='string'&&v.trim().length>0&&v.length<=max;}
export const unresolvedOperationalChecks=[
 'Navigable-water geometry and up-to-date ENC/chart validation are not connected.',
 'Depth, tide datum, squat, dynamic draft and under-keel clearance are not evaluated.',
 'Official navigational/weather warnings, ice and tropical cyclone exclusion areas are not integrated.',
 'Port/canal availability, pilotage, traffic separation and legal/security restrictions require verification.',
 'Vessel stability, cargo-specific restrictions and a validated speed/fuel performance model require operator review.',
 'Forecast authenticity, uncertainty and spatial coverage require provider validation; submitted samples are unverified.',
 'Master/company approval and a berth-to-berth passage plan are required before operational use.'
];
export function assessVoyage(input:PlanningInput,now=Date.now()){
 if(!input||!input.vessel||!Array.isArray(input.candidates)||input.candidates.length<1||input.candidates.length>4)throw Error('Supply one to four candidate routes.');
 const v=input.vessel,departure=time(input.departureUtc);
 if(!Number.isFinite(departure)||departure<now-900000||departure>now+30*86400000)throw Error('Departure must be UTC, no more than 15 minutes past or 30 days ahead.');
 if(!text(v.name)||!['containers','bulk','petroleum','precious_metals'].includes(v.cargo)||!finite(v.speedKn,1,40)||!finite(v.fuelTonnesDay,0.1,500)||!finite(v.fuelPriceUsdTonne,0,10000)||!finite(v.draftM,0.5,35)||!finite(v.minUkm,0.1,10)||!finite(v.maxWindMs,1,80)||!finite(v.maxWaveM,0.1,25))throw Error('Invalid vessel profile or limits.');
 const ids=new Set<string>();
 for(const c of input.candidates){if(!text(c.id,60)||ids.has(c.id)||!text(c.name)||!Array.isArray(c.path)||c.path.length<2||c.path.length>100)throw Error('Invalid route ID, name or waypoint count.');ids.add(c.id);for(const p of c.path)if(!Array.isArray(p)||p.length!==2||!finite(p[0],-180,180)||!finite(p[1],-85,85))throw Error('Waypoints must be [longitude, latitude], latitude within +/-85 degrees.');for(let i=1;i<c.path.length;i++){const d=km(c.path[i-1],c.path[i]);if(d<0.01||d>10000)throw Error('Route has coincident or excessively separated waypoints.');}}
 const first=input.candidates[0].path;
 for(const c of input.candidates)if(km(first[0],c.path[0])>1||km(first[first.length-1],c.path[c.path.length-1])>1)throw Error('Compared routes must share endpoints within 1 km.');
 if(input.forecasts&&Object.keys(input.forecasts).some(id=>!ids.has(id)))throw Error('Forecast contains an unknown route ID.');
 const candidates=input.candidates.map(c=>{
  const supplied=input.forecasts?.[c.id]||[];if(!Array.isArray(supplied)||supplied.length>c.path.length-1)throw Error('Invalid forecast sample count.');
  const seen=new Set<number>();for(const f of supplied){if(!f||!Number.isInteger(f.segment)||f.segment<0||f.segment>=c.path.length-1||seen.has(f.segment)||!finite(f.windMs,0,150)||!finite(f.waveM,0,40)||!finite(f.alongTrackCurrentKn,-10,10))throw Error('Invalid or duplicate forecast segment.');seen.add(f.segment);let u:URL;try{u=new URL(f.sourceUrl);}catch{throw Error('Forecast source URL required.');}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Use a public HTTPS source URL without credentials or query tokens.');if(![time(f.issuedAt),time(f.validFrom),time(f.validTo)].every(Number.isFinite)||time(f.validFrom)>=time(f.validTo))throw Error('Invalid UTC forecast metadata.');}
  let cursor=departure;const segments=c.path.slice(1).map((p,i)=>{const distanceNm=km(c.path[i],p)/1.852,start=cursor,hours=distanceNm/v.speedKn;cursor+=hours*3600000;const f=supplied.find(f=>f.segment===i),problems:string[]=[];
   if(!f)problems.push('MISSING_FORECAST');else{if(time(f.issuedAt)>now+300000)problems.push('FUTURE_ISSUE_TIME');if(now-time(f.issuedAt)>12*3600000)problems.push('STALE_FORECAST');if(time(f.issuedAt)>time(f.validTo))problems.push('INCONSISTENT_FORECAST_TIMES');if(time(f.validFrom)>start||time(f.validTo)<cursor)problems.push('OUTSIDE_FORECAST_HORIZON');if(f.windMs>v.maxWindMs)problems.push('WIND_LIMIT_EXCEEDED');if(f.waveM>v.maxWaveM)problems.push('WAVE_LIMIT_EXCEEDED');if(v.speedKn+f.alongTrackCurrentKn<=0)problems.push('NONPOSITIVE_GROUND_SPEED');}
   return {segment:i,distanceNm,startUtc:new Date(start).toISOString(),endUtc:new Date(cursor).toISOString(),forecast:f||null,problems};
  });
  const distanceNm=segments.reduce((sum,s)=>sum+s.distanceNm,0),hours=distanceNm/v.speedKn,fuelTonnes=hours/24*v.fuelTonnesDay;
  return {...c,distanceNm,stillWaterHours:hours,stillWaterArrivalUtc:new Date(cursor).toISOString(),baselineFuelTonnes:fuelTonnes,baselineFuelCostUsd:fuelTonnes*v.fuelPriceUsdTonne,segments,screeningFindings:segments.flatMap(s=>s.problems.map(code=>({segment:s.segment,code}))),forecastSegments:supplied.length,totalSegments:segments.length};
 });
 return {schemaVersion:'atlas-voyage-assessment/1',assessedAt:new Date(now).toISOString(),input,status:'NOT_CLEARED_FOR_NAVIGATION',recommendedRouteId:null,unresolvedOperationalChecks,candidates,assumptions:['Great-circle segments are schematic and may cross land or restricted waters.','Time and fuel use constant still-water speed and daily burn; currents, weather resistance, maneuvering, stops and uncertainty are not included.','Forecast samples are operator-supplied and unverified. Per-segment values do not prove full spatial/temporal coverage.','Buoy observations and ENSO indices are context, not a route forecast.','No route is approved, optimized or transmitted to a ship.']};
}

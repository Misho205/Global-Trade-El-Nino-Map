export const researchSources={
 earthquakes:{title:'USGS earthquake catalog',url:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',documentation:'https://earthquake.usgs.gov/fdsnws/event/1/',units:'magnitude; depth km; WGS84 degrees',cadence:'Feed updated every minute; Atlas checks every five minutes',limitations:'Reported events, not earthquake predictions. Catalog completeness and magnitude types vary. A tsunami flag is not a tsunami warning.'},
 buoys:{title:'NOAA NDBC marine observations',url:'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt',documentation:'https://www.ndbc.noaa.gov/',units:'wind m/s; significant wave height m; WGS84 degrees',cadence:'Station reporting intervals vary; Atlas checks every five minutes',limitations:'Sparse station observations, not a gridded forecast. No vessel suitability, chart, bathymetry, security or navigation assessment.'},
 dmi:{title:'NOAA PSL Dipole Mode Index (HadISST)',url:'https://psl.noaa.gov/data/timeseries/month/data/dmi.had.long.data',documentation:'https://psl.noaa.gov/data/timeseries/month/DMI/',units:'degrees C anomaly difference',cadence:'Monthly publication; Atlas checks daily',limitations:'Preliminary monthly SST-gradient index. Publication can lag retrieval. Does not predict regional rainfall on its own.'},
 soi:{title:'NOAA PSL / CPC Southern Oscillation Index',url:'https://psl.noaa.gov/data/correlation/soi.data',documentation:'https://www.cpc.ncep.noaa.gov/data/indices/',units:'index units as published by CPC',cadence:'Monthly publication; Atlas checks daily',limitations:'Use the source definition and normalization; do not mix with differently scaled SOI series. Does not predict earthquakes.'},
} as const;
export type ResearchSource=keyof typeof researchSources;
export type Quake={id:string;lon:number;lat:number;depthKm:number;magnitude:number|null;magType:string;time:string;updated:string;title:string;url:string;status:string;tsunamiFlag:number};
export type Buoy={id:string;lon:number;lat:number;time:string;windMs:number|null;gustMs:number|null;waveM:number|null;waterC:number|null;url:string};
export type IndexPoint={date:string;value:number|null};
export type ResearchOverlay={earthquakes:Quake[];buoys:Buoy[]};
const validCoordinate=(lon:unknown,lat:unknown)=>typeof lon==='number'&&Number.isFinite(lon)&&lon>=-180&&lon<=180&&typeof lat==='number'&&Number.isFinite(lat)&&lat>=-90&&lat<=90;
export function parseEarthquakes(raw:unknown,start?:number,end?:number){
 const data=raw as {type?:string;features?:unknown[];metadata?:{generated?:number}};
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid USGS collection');
 const records:Quake[]=[];let rejected=0;const ids=new Set<string>();
 for(const f of data.features){const q=f as {id?:string;geometry?:{type?:string;coordinates?:number[]};properties?:Record<string,unknown>},p=q.properties,c=q.geometry?.coordinates;
  if(!q.id||typeof q.id!=='string'||ids.has(q.id)||q.geometry?.type!=='Point'||!c||!validCoordinate(c[0],c[1])||!Number.isFinite(c[2])||typeof p?.time!=='number'||!Number.isFinite(p.time)||Math.abs(p.time)>8640000000000000){rejected++;continue;}
  if((start!==undefined&&p.time<start)||(end!==undefined&&p.time>=end))continue;
  ids.add(q.id);let url='';try{const u=new URL(String(p.url));if(u.protocol==='https:'&&u.hostname==='earthquake.usgs.gov')url=u.href;}catch{}
  records.push({id:q.id,lon:c[0],lat:c[1],depthKm:c[2],magnitude:typeof p.mag==='number'&&Number.isFinite(p.mag)?p.mag:null,magType:String(p.magType||'unspecified'),time:new Date(p.time).toISOString(),updated:typeof p.updated==='number'&&Number.isFinite(p.updated)&&Math.abs(p.updated)<=8640000000000000?new Date(p.updated).toISOString():new Date(p.time).toISOString(),title:String(p.title||p.place||q.id).slice(0,300),url,status:String(p.status||'unreviewed'),tsunamiFlag:p.tsunami===1?1:0});
 }
 if(data.features.length&&!records.length&&rejected)throw Error('No valid USGS records');
 return {records,rejected,complete:data.features.length<1000&&rejected===0,sourceGeneratedAt:Number.isFinite(data.metadata?.generated)&&Math.abs(data.metadata!.generated!)<=8640000000000000?new Date(data.metadata!.generated!).toISOString():null};
}
export function parseMonthlyIndex(text:string):IndexPoint[]{
 const lines=text.trim().split(/\r?\n/),header=lines[0]?.trim().split(/\s+/).map(Number);
 if(header?.length!==2||!header.every(Number.isInteger)||header[0]<1800||header[1]>2200||header[0]>header[1])throw Error('Invalid monthly index header');
 const records:IndexPoint[]=[],years=new Set<number>();
 for(const line of lines.slice(1)){const cells=line.trim().split(/\s+/);if(!/^\d{4}$/.test(cells[0]||''))continue;const n=cells.map(Number),year=n[0];if(n.length!==13||year<header[0]||year>header[1]||years.has(year)||!n.every(Number.isFinite))throw Error('Invalid monthly index row');years.add(year);for(let month=1;month<=12;month++)records.push({date:`${year}-${String(month).padStart(2,'0')}-01`,value:n[month]<=-90?null:n[month]});}
 if(!records.length||!records.some(r=>r.value!==null))throw Error('Monthly index unavailable');return records;
}
export function parseBuoys(text:string){
 const lines=text.trim().split(/\r?\n/),header=lines[0]?.trim().replace(/^#/,'').split(/\s+/);const required=['STN','LAT','LON','YYYY','MM','DD','hh','mm','WSPD','WVHT'];
 if(!required.every(k=>header.includes(k)))throw Error('NDBC header changed');const records:Buoy[]=[],ids=new Set<string>();let rejected=0;
 for(const line of lines.slice(1)){if(line.startsWith('#')||!line.trim())continue;const cells=line.trim().split(/\s+/),get=(k:string)=>cells[header.indexOf(k)],number=(k:string)=>{const s=get(k);return s&&s!=='MM'&&Number.isFinite(Number(s))?Number(s):null;};
  const id=get('STN'),lon=number('LON'),lat=number('LAT'),date=`${get('YYYY')}-${get('MM')?.padStart(2,'0')}-${get('DD')?.padStart(2,'0')}T${get('hh')?.padStart(2,'0')}:${get('mm')?.padStart(2,'0')}:00Z`,timestamp=Date.parse(date);
  if(!id||!/^[a-z0-9]{3,8}$/i.test(id)||ids.has(id)||!validCoordinate(lon,lat)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,16)!==date.slice(0,16)){rejected++;continue;}
  const bounded=(key:string,max:number)=>{const v=number(key);return v!==null&&v>=0&&v<=max?v:null;};ids.add(id);records.push({id,lon:lon!,lat:lat!,time:new Date(timestamp).toISOString(),windMs:bounded('WSPD',150),gustMs:bounded('GST',200),waveM:bounded('WVHT',40),waterC:number('WTMP'),url:'https://www.ndbc.noaa.gov/station_page.php?station='+id.toLowerCase()});
 }
 if(!records.length)throw Error('No valid NDBC observations');return {records,rejected,complete:rejected===0};
}
const rad=(n:number)=>n*Math.PI/180;
export function greatCircleKm(a:number[],b:number[]){const lat=rad(b[1]-a[1]),lon=rad(b[0]-a[0]),h=Math.sin(lat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(lon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
const bearing=(a:number[],b:number[])=>Math.atan2(Math.sin(rad(b[0]-a[0]))*Math.cos(rad(b[1])),Math.cos(rad(a[1]))*Math.sin(rad(b[1]))-Math.sin(rad(a[1]))*Math.cos(rad(b[1]))*Math.cos(rad(b[0]-a[0])));
export function distanceToCorridorKm(point:number[],path:number[][]){let nearest=Infinity;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=greatCircleKm(a,b)/6371,d=greatCircleKm(a,point)/6371,angle=bearing(a,point)-bearing(a,b),along=Math.atan2(Math.sin(d)*Math.cos(angle),Math.cos(d)),cross=Math.abs(Math.asin(Math.max(-1,Math.min(1,Math.sin(d)*Math.sin(angle)))))*6371;nearest=Math.min(nearest,along>=0&&along<=length?cross:Math.min(greatCircleKm(a,point),greatCircleKm(b,point)));}return nearest;}
export function corridorObservations(path:number[][],buoys:Buoy[],now=Date.now(),radiusKm=150){
 const nearby=buoys.map(b=>({...b,distanceKm:distanceToCorridorKm([b.lon,b.lat],path),ageHours:(now-Date.parse(b.time))/3600000})).filter(b=>b.distanceKm<=radiusKm&&b.ageHours>=-0.25&&b.ageHours<=3&&(b.waveM!==null||b.windMs!==null));
 return {nearby,screeningExceedances:nearby.filter(b=>(b.waveM!==null&&b.waveM>=4)||(b.windMs!==null&&b.windMs>=15)),status:nearby.length?'partial_observations':'no_recent_nearby_observations',coverage:'Sparse point sampling; unobserved route segments remain unknown. No route safety clearance.'};
}
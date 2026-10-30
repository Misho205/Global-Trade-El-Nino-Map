"use client";
import {useEffect,useState} from 'react';

type Status={storage:boolean;error?:string;background?:{completedAt:string;expectedIntervalMs?:number;results:{source:string;state:string;error?:string}[]};sources:{key:string;last_success:number|null;error:string|null}[]};
export default function DataHealth(){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false;const load=async()=>{try{const r=await fetch('/api/data-status',{cache:'no-store'});if(!r.ok)throw Error('Update status unavailable.');const data=await r.json() as Status;if(!cancelled){setStatus(data);setError('');}}catch{if(!cancelled)setError('Update status unavailable.');}};load();const timer=setInterval(load,60_000);return()=>{cancelled=true;clearInterval(timer);};},[]);
 const last=status?.background?.completedAt;
 const late=!last||Date.now()-Date.parse(last)>1.5*(status?.background?.expectedIntervalMs||3_600_000);
 return <article className="editorial-card" style={{margin:'20px 0'}} aria-label="Automatic data updates"><span className="eyebrow">DATA FRESHNESS</span><h2>Updates while you are away</h2>
 <p>{!status?'Checking saved data…':!status.storage?'Background storage is not active.':!last?'Storage is ready. The first background run has not completed.':late?'Background updates are delayed. Last valid readings remain available.':'Background collector has completed a recent run.'}</p>
 {last&&<p>Last collector run: {new Date(last).toLocaleString()}</p>}
 {(status?.error||error)&&<p className="notice">{status?.error||error}</p>}
 {status?.sources?.filter(s=>s.key==='climate'||s.key==='agreements').map(s=><p key={s.key}>{s.key==='climate'?'NOAA climate':'WTO agreements'} · {s.last_success?`last successful retrieval ${new Date(s.last_success).toLocaleString()}`:'no saved result'}{s.error?` · ${s.error}`:''}</p>)}
 {!!status?.background?.results?.filter(r=>r.state!=='fresh').length&&<p className="notice">Some sources are delayed or unavailable. Check the individual readings before use.</p>}
 <small>Retrieval time differs from publication time. Trade values are annual. Routes, alliance context and AlphaEarth previews remain curated snapshots.</small></article>;
}

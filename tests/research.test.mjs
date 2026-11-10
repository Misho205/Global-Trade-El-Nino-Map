import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseMonthlyIndex,parseBuoys,parseEarthquakes,greatCircleKm,distanceToCorridorKm,corridorObservations} from '../lib/research-data.ts';
import {researchSchedule,RESEARCH_CRON} from '../build/research-schedule.ts';
const buoy=(time,extra={})=>({id:'41001',lon:0,lat:0,time,windMs:10,gustMs:null,waveM:2,waterC:null,url:'https://www.ndbc.noaa.gov/',...extra});
test('monthly index parser preserves missing months, real zeros, and rejects schema drift',()=>{
 const text='2025 2026\n2025 0 1 -1 0.5 -0.5 2 1 0 -9999 -99.99 -100 0\n2026 '+Array(12).fill('-9999').join(' ');
 const rows=parseMonthlyIndex(text);assert.equal(rows.length,24);assert.equal(rows[0].value,0);assert.equal(rows[8].value,null);assert.equal(rows[9].value,null);assert.equal(rows[23].value,null);
 assert.throws(()=>parseMonthlyIndex('<html>Error</html>'));assert.throws(()=>parseMonthlyIndex('2025 2026\n2025 0 1'));
 assert.throws(()=>parseMonthlyIndex('2025 2026\n2025 '+Array(12).fill('-9999').join(' ')));
});
test('NDBC uses header names, does not turn MM into zero and rejects invalid dates/coordinates',()=>{
 const header='#STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES PTDY ATMP WTMP DEWP VIS TIDE';
 const good='41001 35 -70 2026 11 09 12 00 90 0 MM 4.2 8 7 90 1010 MM 20 21 MM MM MM';
 const result=parseBuoys(header+'\n# units\n'+good+'\n41002 200 -70 2026 11 09 12 00 90 10 MM MM');
 assert.equal(result.records.length,1);assert.equal(result.records[0].windMs,0);assert.equal(result.records[0].gustMs,null);assert.equal(result.records[0].waveM,4.2);assert.equal(result.rejected,1);
 assert.throws(()=>parseBuoys(header+'\n'+good.replace('11 09','02 30')));
 assert.throws(()=>parseBuoys('changed header\n'+good));
});
test('USGS observation parser preserves reviewed status and filters historical UTC boundaries',()=>{
 const time=Date.parse('2026-11-09T12:00:00Z');const f={id:'us_dummy',geometry:{type:'Point',coordinates:[-70,35,10]},properties:{time,updated:time,mag:2.5,magType:'ml',title:'Dummy event',status:'reviewed',tsunami:1,url:'https://earthquake.usgs.gov/earthquakes/eventpage/us_dummy'}};
 const result=parseEarthquakes({type:'FeatureCollection',features:[f],metadata:{generated:time}},time-1,time+1);
 assert.equal(result.records[0].magnitude,2.5);assert.equal(result.records[0].magType,'ml');assert.equal(result.records[0].status,'reviewed');assert.equal(result.records[0].tsunamiFlag,1);
 assert.equal(parseEarthquakes({type:'FeatureCollection',features:[f]},time+1,time+2).records.length,0);
 assert.equal(parseEarthquakes({type:'FeatureCollection',features:[]}).records.length,0);
 const unsafe=structuredClone(f);unsafe.properties.url='javascript:alert(1)';assert.equal(parseEarthquakes({type:'FeatureCollection',features:[unsafe]}).records[0].url,'');
 assert.throws(()=>parseEarthquakes({type:'FeatureCollection',features:[{...f,geometry:{type:'Point',coordinates:[999,35,10]}}]}));
});
test('geodesic corridor distance handles antimeridian, segment endpoints and nearby sampling',()=>{
 assert.ok(Math.abs(greatCircleKm([179,0],[-179,0])-222.39)<1);
 assert.ok(distanceToCorridorKm([180,1],[[179,0],[-179,0]])<112);
 assert.ok(distanceToCorridorKm([10,0],[[0,0],[1,0]])>990);
 const now=Date.parse('2026-11-10T12:00:00Z'),fresh=new Date(now-3600000).toISOString();
 const result=corridorObservations([[-1,0],[1,0]],[buoy(fresh),buoy(fresh,{id:'2',waveM:4}),buoy(new Date(now-4*3600000).toISOString(),{id:'stale',waveM:10}),buoy(fresh,{id:'missing',waveM:null,windMs:null}),buoy(fresh,{id:'far',lat:50})],now);
 assert.equal(result.nearby.length,2);assert.equal(result.screeningExceedances.length,1);assert.equal(result.status,'partial_observations');
 assert.equal(corridorObservations([[-1,0],[1,0]],[],now).status,'no_recent_nearby_observations');
});
test('research Cron is opt-in and separate from the existing feed collector',()=>{
 assert.equal(researchSchedule({}),null);assert.throws(()=>researchSchedule({ATLAS_RESEARCH_UPDATES:'true'}));
 assert.equal(researchSchedule({ATLAS_RESEARCH_UPDATES:'true',ATLAS_DEPLOY_TARGET:'cloudflare',ATLAS_ENABLE_CRON:'true'}).cron,RESEARCH_CRON);
 const source=readFileSync(new URL('../build/sites-worker.ts',import.meta.url),'utf8');assert.match(source,/if\(_event.cron===RESEARCH_CRON\)/);
});
test('globe inline scripts remain valid after observation layer integration',()=>{
 const html=readFileSync(new URL('../public/globe.html',import.meta.url),'utf8');for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);assert.ok(html.includes('researchOverlay'));
});
import {researchSources,type ResearchSource} from '@/lib/research-data';
import {researchSnapshot,validResearchDate} from '@/lib/research-sources';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,source=q.get('source')||'earthquakes',date=q.get('date');
 if(!Object.hasOwn(researchSources,source)||(date&&(!validResearchDate(date)||source!=='earthquakes'))||[...q.keys()].some(k=>!['source','date'].includes(k)))return Response.json({error:'Invalid research source or date.'},{status:400});
 try{return await researchSnapshot(source as ResearchSource,date||undefined);}catch{return Response.json({error:'Research source is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
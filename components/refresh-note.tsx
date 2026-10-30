import type { RefreshInfo } from '@/lib/snapshot-cache';

export default function RefreshNote({refresh}:{refresh?:RefreshInfo}) {
  if (!refresh) return null;
  return <small role="status" style={{display:'block',color:refresh.state==='fresh'?'#6edbcc':'#eeb973',marginTop:8}}>
    {refresh.state==='fresh'?'Latest saved data':refresh.state==='stale'?'Showing last valid data · update delayed':'Data unavailable'}
    {refresh.lastSuccessAt ? ` · ${new Date(refresh.lastSuccessAt).toLocaleString()}` : ''}
    {!refresh.persisted ? ' · background storage unavailable' : ''}
    {refresh.error ? ` · ${refresh.error}` : ''}
  </small>;
}

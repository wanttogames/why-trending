import { context, mockMode } from './context'
import { cached } from './cache'
import { fetchTrend, fetchContent } from './provider'
import { metrics } from '../../shared/math'
import type { Keyword, WorkerEnv } from '../../shared/types'
import { PERIODS } from '../../shared/config'
export async function collect(env:WorkerEnv,scheduledTime=Date.now()){
 if(mockMode(env))return {mode:'mock',saved:0}
 const ctx=context(env),minutes=Math.floor(scheduledTime/300000),hours=env.COLLECTOR_CYCLE_HOURS==='6'?6:3
 const shards=hours*6,kind=minutes%2===0?'search':'shopping',slot=Math.floor(minutes/2)%shards,epoch=Math.floor(minutes/(shards*2))
 try {
  return await cached(ctx,`job:${hours}:${epoch}:${kind}:${slot}`,10800,async()=>{
   const {data,error}=await ctx.db.rpc('tp_candidates',{p_slot:slot,p_shards:shards,p_kind:kind})
   if(error)throw error
   const keys=(data??[]) as Keyword[]
   const groups=new Map<string,Keyword[]>()
   for(const k of keys){const group=kind==='shopping'?k.shopping_category!:'search';groups.set(group,[...(groups.get(group)??[]),k])}
   const snapshots:unknown[]=[],rankings:unknown[]=[];let failures=0
   for(const [category,list] of groups){
    for(let i=0;i<list.length;i+=5){
     if(ctx.counter.snapshot().total>31){failures++;continue}
     const batch=list.slice(i,i+5)
     try {
      const trend=await fetchTrend(ctx,batch,180,kind==='shopping'?category:undefined)
      for(const series of trend.series){
       if(series.points.filter(p=>p.value!==null).length<7){failures++;continue}
       const keyword=batch.find(k=>k.keyword===series.keyword)!
       snapshots.push({keyword_id:keyword.id,source:kind,series:trend.series.length===1?trend:{...trend,series:[series]},recorded_at:trend.collectedAt})
       const lastObserved=series.points.map(p=>p.value!==null).lastIndexOf(true)
       for(const period of ['1d','7d','30d','90d'] as const){const m=metrics(series.points.slice(0,lastObserved+1),PERIODS[period]);rankings.push({keyword_id:keyword.id,source:kind,period,metrics:m,trend_score:m.trendScore,recorded_at:trend.collectedAt})}
      }
     }catch(error){failures++;console.error('[collector] batch failed',{category,message:error instanceof Error?error.message:'database error'})}
    }
   }
   let saved=0
   if(snapshots.length){const {data,error}=await ctx.db.rpc('tp_save',{p_snapshots:snapshots,p_rankings:rankings});if(error)throw error;saved=Number(data)}
   // One scheduled content target per hour; regular page requests share this cache.
   if(minutes%12===0&&ctx.counter.snapshot().total<29){
    const {data:top}=await ctx.db.from('trend_rankings').select('trend_keywords(keyword)').eq('source','search').eq('period','7d').order('trend_score',{ascending:false}).limit(1)
    const keyword=(top?.[0]?.trend_keywords as unknown as {keyword?:string})?.keyword
    if(keyword)try{await cached(ctx,`content:${keyword.toLowerCase()}`,3600,()=>fetchContent(ctx,keyword))}catch{}
   }
   if(minutes%288===0&&ctx.counter.snapshot().total<40)await ctx.db.rpc('tp_cleanup')
   console.info('[collector]',{kind,slot,shards,candidates:keys.length,saved,failures})
   // A failed shard is retryable on a duplicate execution; existing data stays intact.
   if(!saved&&failures)throw new Error('수집 실패: 기존 데이터 유지')
   return {kind,slot,candidates:keys.length,saved,failures}
  })
 }finally{console.info('[collector] subrequests',ctx.counter.snapshot())}
}

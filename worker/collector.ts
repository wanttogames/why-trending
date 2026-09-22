import { collect } from '../server/trendpick/collector'
import type { WorkerEnv } from '../shared/types'
export default {
 async scheduled(event:ScheduledController,env:WorkerEnv,ctx:ExecutionContext){ctx.waitUntil(collect(env,event.scheduledTime))},
 async fetch(request:Request,env:WorkerEnv){
  const path=new URL(request.url).pathname
  if(path==='/health')return Response.json({ok:true,mode:env.DATA_MODE??'mock'})
  if(path==='/collect'&&request.method==='POST'){
   if(!env.COLLECTOR_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.COLLECTOR_TOKEN}`)return new Response('Unauthorized',{status:401})
   try{return Response.json(await collect(env))}catch{return Response.json({error:'수집 실패. 로그를 확인하세요.'},{status:503})}
  }
  return new Response('Not found',{status:404})
 }
}

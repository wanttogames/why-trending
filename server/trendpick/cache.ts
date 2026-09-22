import type { Context } from './context'
import type { Envelope } from '../../shared/types'
export async function cached<T>(ctx:Context,key:string,ttl:number,load:()=>Promise<T>):Promise<Envelope<T>> {
 const owner=crypto.randomUUID()
 const {data:claim,error}=await ctx.db.rpc('tp_claim_cache',{p_key:key,p_owner:owner})
 if(error)throw error
 const old=claim.payload as T|null
 const wrap=(data:T,stale:boolean,updatedAt:string):Envelope<T>=>({data,meta:{mode:'real',stale,updatedAt,...(stale?{message:'최근 업데이트 데이터를 표시하고 있습니다.'}:{})}})
 if(claim.state==='hit')return wrap(old!,false,claim.updated_at)
 if(claim.state==='busy'){
  if(old!==null)return wrap(old,true,claim.updated_at)
  throw new Error('같은 데이터를 수집 중입니다. 잠시 후 다시 시도해 주세요.')
 }
 try {
  const fresh=await load()
  const {error}=await ctx.db.rpc('tp_finish_cache',{p_key:key,p_owner:owner,p_payload:fresh,p_ttl:ttl})
  if(error)throw error
  return wrap(fresh,false,new Date().toISOString())
 }catch(error){
  await ctx.db.rpc('tp_release_cache',{p_key:key,p_owner:owner})
  console.warn('[cache] refresh failed',{key,message:error instanceof Error?error.message:'database/provider error'})
  if(old!==null)return wrap(old,true,claim.updated_at)
  throw error
 }
}

import type { WorkerEnv } from '../../shared/types'
import { createServerSupabase } from '../supabase'
import { SubrequestCounter } from '../metrics/subrequest-counter'
import { NaverClient } from '../naver/client'
export function context(env:WorkerEnv){
 const counter=new SubrequestCounter(),db=createServerSupabase(env,counter)
 const client=new NaverClient(env,counter,async(service)=>{
  const {data,error}=await db.rpc('tp_permit',{p_service:service})
  if(error)throw error
  if(!data)throw new Error('API 호출 예산 또는 초당 요청 한도에 도달했습니다.')
 })
 return {db,client,counter,env}
}
export type Context=ReturnType<typeof context>
export function mockMode(env:WorkerEnv){if(!env.DATA_MODE||env.DATA_MODE==='mock')return true;if(env.DATA_MODE==='real')return false;throw new Error('DATA_MODE must be mock or real')}

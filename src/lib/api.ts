import { ref } from 'vue'
export const runtime=ref({mode:'mock',ads:false})
export async function api<T>(path:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(path,{signal,headers:{Accept:'application/json'}})
 const data=await response.json() as T&{error?:string}
 if(!response.ok)throw new Error(data.error||'불러오지 못했습니다.')
 return data
}
export function track(event:string,extra:Record<string,string>={}){
 void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,...extra}),keepalive:true}).catch(()=>{})
}
export const dateLabel=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))

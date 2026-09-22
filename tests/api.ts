import assert from 'node:assert/strict'
import worker from '../worker/index'
const storage=new Map<string,Response>()
Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{match:async(r:Request)=>storage.get(r.url)?.clone(),put:async(r:Request,v:Response)=>{storage.set(r.url,v.clone())}}}})
const env={DATA_MODE:'mock',ASSETS:{fetch:async()=>new Response('asset',{headers:{'Content-Type':'text/plain'}})}}
const request=(path:string)=>worker.fetch(new Request('https://example.test'+path),env as Parameters<typeof worker.fetch>[1])
const first=await request('/api/vs?a=chatgpt&b=gemini&period=7d')
assert.equal(first.status,200)
const data=await first.json() as {data:{shareA:number;shareB:number};meta:{mode:string}}
assert.equal(data.meta.mode,'mock');assert.equal(data.data.shareA+data.data.shareB,100)
const cacheCount=storage.size
assert.equal((await request('/api/vs?a=gemini&b=chatgpt&period=7d')).status,200)
assert.equal(storage.size,cacheCount)
assert.equal((await request('/api/vs?a=a&b=a')).status,400)
assert.equal((await request('/api/trends?period=garbage')).status,400)
assert.equal((await request('/api/not-found')).status,404)
assert((await (await request('/api/shopping')).json() as {data:unknown[]}).data.length>0)
assert.equal(await (await request('/favicon.svg')).text(),'asset')
console.log('PASS Worker routing: JSON API, canonical edge cache, validation, shopping, static assets')

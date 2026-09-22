import assert from 'node:assert/strict'
import { metrics,comparison } from '../shared/math'
import { canonicalPair,token,untoken } from '../shared/identity'
import { trendCacheKey } from '../server/trendpick/service'
import { range,fetchTrend } from '../server/trendpick/provider'
import { mockTrend } from '../server/trendpick/mock'
import type { Context } from '../server/trendpick/context'
import type { Keyword } from '../shared/types'

assert.deepEqual(canonicalPair(' ChatGPT ','Gemini'),canonicalPair('gemini','chatgpt'))
assert.equal(untoken(token('K팝')), 'k팝')
assert.notEqual(token('K팝'),token('K리그'))
assert.throws(()=>canonicalPair('Ａ','a'))
assert.throws(()=>token('<script>'))
assert.throws(()=>untoken('k-ff'))
assert.equal(trendCacheKey(['a','b'],'7d'),trendCacheKey(['b','a'],'7d'))
const points=Array.from({length:14},(_,i)=>({date:String(i),value:i<7?10:20}))
assert.equal(metrics(points,7).changeRate,100)
assert.equal(metrics(points.map(p=>({...p,value:p.value*2})),7).trendScore,metrics(points,7).trendScore)
assert.equal(metrics(points.map(p=>({...p,value:0})),7).changeRate,null)
assert.equal(metrics(points.map((p,i)=>({...p,value:i<7?0:20})),7).status,'new')
assert.equal(metrics(points.map(p=>({...p,value:null})),7).status,'insufficient')
const key:Keyword={keyword:'a',slug:token('a'),category:'IT',aliases:['a']}
const data=mockTrend([key,{...key,keyword:'b'}],60)
data.series[0].points.forEach(p=>p.value=76);data.series[1].points.forEach(p=>p.value=47)
assert.equal(comparison(data,'a','b','7d').shareA,62)
data.series.forEach(s=>s.points.forEach(p=>p.value=0))
assert.equal(comparison(data,'a','b','7d').shareA,null)
data.series[1].points.forEach(p=>p.value=null)
assert.equal(comparison(data,'a','b','7d').shareA,null)
assert.equal(range(60).endDate.length,10)
let seen:Record<string,unknown>={}
const ctx={client:{request:async(path:string,options:{body:Record<string,unknown>})=>{seen={path,...options.body};return {results:[{title:'a',data:[]}]}}}} as unknown as Context
const missing=await fetchTrend(ctx,[key],60)
assert(missing.series[0].points.every(p=>p.value===null))
assert.equal((seen.keywordGroups as unknown[]).length,1)
await fetchTrend(ctx,[key],60,'beauty',{device:'mo',gender:'f',ages:['20']})
assert.equal(seen.path,'/shopping/v1/category/keywords')
assert.equal(seen.category,'50000002')
assert.equal((seen.keyword as Array<{param:string[]}>)[0].param.length,1)
await assert.rejects(()=>fetchTrend(ctx,[key],60,'invented-category'))
await assert.rejects(()=>fetchTrend(ctx,Array(6).fill(key),60))
console.log('PASS core: normalization, canonical cache, missing/zero, ratio, batch and shopping schema')

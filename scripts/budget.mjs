import { readFile } from 'node:fs/promises'
const rows=JSON.parse(await readFile(new URL('../supabase/seeds/keywords.json',import.meta.url),'utf8')).filter(r=>r.enabled)
for(const hours of [3,6]){
 const shards=hours*6;let search=0,shopping=0,maxBatch=0
 for(let slot=0;slot<shards;slot++){
  const keys=rows.filter((_,i)=>i%shards===slot),groups=new Map()
  search+=Math.ceil(keys.length/5)
  for(const k of keys)if(k.shopping_category)groups.set(k.shopping_category,(groups.get(k.shopping_category)||0)+1)
  const n=[...groups.values()].reduce((a,b)=>a+Math.ceil(b/5),0);shopping+=n;maxBatch=Math.max(maxBatch,n,Math.ceil(keys.length/5))
 }
 const result={keywords:rows.length,cycleHours:hours,searchMonthly:search*24/hours*31,shoppingMonthly:shopping*24/hours*31,maxNaverCallsPerInvocation:maxBatch}
 console.log(JSON.stringify(result,null,2))
 if(result.searchMonthly>35000||result.shoppingMonthly>35000)console.warn('WARNING: exceeds 70% budget; lengthen cycle or reduce enabled keywords')
}

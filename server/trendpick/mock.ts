import type { Envelope, TrendData, Keyword, Ranking } from '../../shared/types'
import { range } from './provider'
import { metrics } from '../../shared/math'
import { PERIODS, type Period } from '../../shared/config'
import { token } from '../../shared/identity'
const topics=[['chatgpt','IT'],['gemini','IT'],['아이폰17','IT'],['갤럭시 s26','IT'],['러닝화','스포츠'],['로봇청소기','가전'],['닌텐도 스위치2','게임'],['선크림','뷰티'],['제습기','가전'],['유모차','쇼핑'],['그릭요거트','쇼핑'],['캠핑의자','스포츠'],['넷플릭스','엔터테인먼트'],['제주도여행','여행'],['아이오닉5','자동차'],['트렌치코트','패션']]
export const demoKeys:Keyword[]=topics.map(([keyword,category],i)=>({id:i+1,keyword,category,slug:token(keyword),aliases:[keyword],shopping_category:category==='뷰티'?'beauty':category==='가전'?'appliances':category==='패션'?'fashion':category==='스포츠'?'sports':category==='쇼핑'?'baby':undefined}))
export function mockTrend(keys:Keyword[],days:number,shop?:string):TrendData{
 const dates=range(days),start=Date.parse(dates.startDate+'T00:00:00Z')
 return {...dates,source:shop?'shopping':'search',category:shop,collectedAt:new Date().toISOString(),series:keys.map(k=>{const seed=[...k.keyword].reduce((a,c)=>a+c.charCodeAt(0),0);return {keyword:k.keyword,points:Array.from({length:days},(_,i)=>({date:new Date(start+i*86400000).toISOString().slice(0,10),value:Math.round(Math.max(0,Math.min(100,20+seed%25+Math.sin(i/5+seed)*8+i/days*30)))}))}})}
}
export const demo=<T>(data:T):Envelope<T>=>({data,meta:{mode:'mock',stale:false,updatedAt:new Date().toISOString(),message:'체험용 가상 데이터입니다. 실제 NAVER 통계가 아닙니다.'}})
export function mockRankings(period:Period,shop:boolean):Ranking[]{return demoKeys.filter(k=>!shop||k.shopping_category).map(k=>({keyword:k,metrics:metrics(mockTrend([k],180,shop?k.shopping_category!:undefined).series[0].points,PERIODS[period]),updatedAt:new Date().toISOString(),source:shop?'shopping' as const:'search' as const})).sort((a,b)=>b.metrics.trendScore-a.metrics.trendScore)}

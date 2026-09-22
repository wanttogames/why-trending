import { PERIODS, type Period } from './config'
import type { Metrics, Point, TrendData, Comparison } from './types'
export const mean = (v:number[]) => v.length ? v.reduce((a,b)=>a+b,0)/v.length : null
export function metrics(points:Point[], days:number):Metrics {
 const current=points.slice(-days), previous=points.slice(-2*days,-days)
 const values=(p:Point[])=>p.flatMap(v=>v.value===null?[]:[v.value])
 const c=values(current),p=values(previous), a=mean(c),b=mean(p)
 const coverage=Math.min(c.length/Math.max(1,days),p.length/Math.max(1,days))
 const enough=coverage>=0.8 && a!==null && b!==null
 const change=enough ? a!-b! : null
 const rate=enough && b!>0 ? (a!-b!)/b!*100 : null
 const short=mean(c.slice(-Math.min(3,days))),long=mean(p)
 const persistence=c.length?c.filter(v=>v>(b??Infinity)).length/c.length:0
 // Scale-independent change signals; never rank raw ratios from different batches.
 const score=enough ? Math.max(0,Math.min(100,(rate===null ? (a!>0?35:0) : Math.min(60,Math.max(0,rate)*0.3)) + Math.min(25,Math.max(0,((short??0)/Math.max(b!,0.01)-1)*25)) + persistence*15)) : 0
 const peak=current.filter(v=>v.value!==null).sort((a,b)=>b.value!-a.value!)[0]
 return {asOf:current.filter(p=>p.value!==null).at(-1)?.date??null,currentScore:a,previousScore:b,change,changeRate:rate,shortTermAvg:short,longTermAvg:long,trendScore:Math.round(score*10)/10,coverage,peakDate:peak?.date??null,peakValue:peak?.value??null,status:!enough?'insufficient':b===0&&a!>0?'new':'ok'}
}
export function comparison(trend:TrendData,a:string,b:string,period:Period):Comparison {
 const days=PERIODS[period],sa=trend.series.find(s=>s.keyword===a),sb=trend.series.find(s=>s.keyword===b)
 const ma=metrics(sa?.points??[],days),mb=metrics(sb?.points??[],days)
 // Use only exactly matching, observed dates for the two-way share.
 const right=new Map(sb?.points.map(p=>[p.date,p.value]))
 const pairs=(sa?.points.slice(-days)??[]).filter(p=>p.value!==null&&right.get(p.date)!==undefined&&right.get(p.date)!==null)
 const av=mean(pairs.map(p=>p.value!)),bv=mean(pairs.map(p=>right.get(p.date)!))
 const sum=(av??0)+(bv??0), valid=pairs.length>=Math.ceil(days*0.8)&&sum>0
 const shareA=valid?Math.round(av!/sum*100):null
 return {a,b,shareA,shareB:shareA===null?null:100-shareA,metricsA:ma,metricsB:mb,trend,period}
}
export const formatRate=(m:Metrics)=>m.status==='insufficient'?'데이터 부족':m.status==='new'?'신규 관심':m.changeRate===null?'—':`${m.changeRate>0?'+':''}${m.changeRate.toFixed(1)}%`

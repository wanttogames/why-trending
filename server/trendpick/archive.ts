import { context,mockMode } from './context'
import type { WorkerEnv } from '../../shared/types'
import type { ArchiveIssue,ArchiveList,ArchiveDetail,ArchiveNews } from '../../shared/archive'
import { InputError } from '../../shared/errors'
interface Row {id:number;slug:string;title:string;summary:string;first_seen_at:string;last_seen_at:string;peak_score:number;peak_rank:number;category:string;related_keywords:string[];representative_news:ArchiveNews[];updated_at:string;score_model:'legacy'|'trend7d';legacy_peak:{score?:number;rank?:number}}
const project=(r:Row):ArchiveIssue=>({id:r.id,slug:r.slug,title:r.title,summary:r.summary,firstSeenAt:r.first_seen_at,lastSeenAt:r.last_seen_at,peakScore:Number(r.peak_score),peakRank:r.peak_rank,category:r.category,relatedKeywords:r.related_keywords,news:r.representative_news,updatedAt:r.updated_at,status:'ARCHIVED',currentRank:null,scoreModel:r.score_model,legacyPeak:r.legacy_peak??{}})
export function archivePageNumber(value:string|null){const n=Number(value??1);if(!Number.isSafeInteger(n)||n<1||n>100000)throw new InputError('잘못된 페이지 번호입니다.');return n}
export async function issueList(env:WorkerEnv,page=1):Promise<ArchiveList>{
 if(mockMode(env))return {data:[],page,hasMore:false}
 const {data,error}=await context(env).db.from('issue_archive').select('*').order('last_seen_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*20,page*20)
 if(error)throw error
 const rows=(data??[]) as Row[];return {data:rows.slice(0,20).map(project),page,hasMore:rows.length>20}
}
export async function issueDetail(env:WorkerEnv,slug:string):Promise<ArchiveDetail|null>{
 if(!/^[a-zA-Z0-9_-]{1,500}$/.test(slug)||mockMode(env))return null
 const ctx=context(env),{data,error}=await ctx.db.from('issue_archive').select('*').eq('slug',slug).maybeSingle()
 if(error)throw error;if(!data)return null
 const issue=project(data as Row)
 const {data:active,error:activeError}=await ctx.db.rpc('tp_archive_active')
 // Archive stays available if live status lookup fails.
 if(!activeError){const hit=(active as Array<{keyword:string;score:number;rank:number;rate:string|null}>|null)?.find(r=>r.keyword.toLowerCase()===issue.title.toLowerCase());if(hit){issue.currentRank=hit.rank;issue.status=Number(hit.rate)>=50?'RAPID':Number(hit.rate)>0?'RISING':'STABLE'}}
 const {data:related}=await ctx.db.from('issue_archive').select('slug,title').eq('category',issue.category).neq('id',issue.id).order('last_seen_at',{ascending:false}).limit(5)
 return {data:issue,related:related??[]}
}
export async function sitemapRows(env:WorkerEnv,page:number){
 if(mockMode(env))return []
 const {data,error}=await context(env).db.from('issue_archive').select('slug,updated_at').order('id').range((page-1)*500,page*500-1)
 if(error)throw error;return (data??[]) as Array<{slug:string;updated_at:string;score_model:'legacy'|'trend7d';legacy_peak:{score?:number;rank?:number}}>
}
export async function sitemapCount(env:WorkerEnv){if(mockMode(env))return 0;const {count,error}=await context(env).db.from('issue_archive').select('id',{count:'exact',head:true});if(error)throw error;return count??0}

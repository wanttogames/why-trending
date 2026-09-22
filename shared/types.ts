import type { Period } from './config'
export interface WorkerEnv {
 NAVER_CLIENT_ID?:string; NAVER_CLIENT_SECRET?:string; SUPABASE_URL?:string; SUPABASE_SERVICE_ROLE_KEY?:string;
 DATA_MODE?:string; SITE_URL?:string; COLLECTOR_CYCLE_HOURS?:string; COLLECTOR_TOKEN?:string; ADS_ENABLED?:string;
}
export interface Keyword { id?:number; keyword:string; slug:string; category:string; aliases:string[]; shopping_category?:string|null }
export interface Point { date:string; value:number|null }
export interface Metrics { asOf:string|null; currentScore:number|null; previousScore:number|null; change:number|null; changeRate:number|null; shortTermAvg:number|null; longTermAvg:number|null; trendScore:number; coverage:number; peakDate:string|null; peakValue:number|null; status:'ok'|'new'|'insufficient' }
export interface Series { keyword:string; points:Point[] }
export interface TrendData { series:Series[]; startDate:string; endDate:string; source:'search'|'shopping'; category?:string; shoppingCategory?:string|null; collectedAt:string }
export interface Envelope<T> { data:T; meta:{ mode:'mock'|'real'; stale:boolean; updatedAt:string; message?:string } }
export interface Ranking { keyword:Keyword; metrics:Metrics; updatedAt:string; source:'search'|'shopping' }
export interface Comparison { a:string; b:string; shareA:number|null; shareB:number|null; metricsA:Metrics; metricsB:Metrics; trend:TrendData; period:Period }
export interface ContentItem { title:string; description:string; url:string; source:string; publishedAt?:string }
export interface ContentResult { news:ContentItem[]; blog:ContentItem[]; cafe:ContentItem[]; unavailable:string[] }

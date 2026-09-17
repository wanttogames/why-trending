import { mockIssues, mockUpdatedAt } from '../../shared/mock-data'
import type { ApiEnvelope, Issue, WorkerEnv } from '../../shared/types'
import { resolveDataMode } from '../../server/data-mode'
import { createServerSupabase } from '../../server/supabase'

export interface PagesContext {
  request: Request
  env: WorkerEnv
  params: Record<string, string | string[]>
  next(): Promise<Response>
}

export const json = <T>(data: T, init: ResponseInit = {}): Response => Response.json(data, {
  ...init,
  headers: { 'Cache-Control': 'no-store', ...init.headers },
})

export const errorResponse = (error: unknown, mode?: string | null): Response => {
  console.error('[api]', error)
  return json({
    error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    ...(mode !== undefined ? { mode } : {}),
  }, { status: 500 })
}

export const isMock = (env: WorkerEnv): boolean => resolveDataMode(env) === 'mock'

const mapIssue = (row: Record<string, unknown>): Issue => {
  const snapshots = Array.isArray(row.keyword_snapshots) ? row.keyword_snapshots as Array<Record<string, unknown>> : []
  const latest = [...snapshots].sort((a, b) => Date.parse(String(b.collected_at)) - Date.parse(String(a.collected_at)))[0]
  return {
    id: String(row.id), keyword: String(row.keyword), slug: String(row.slug), category: row.category as Issue['category'], status: row.status as Issue['status'],
    rank: Number(latest?.rank ?? 0), rankChange: Number(latest?.rank_change ?? 0), issueScore: Number(latest?.issue_score ?? 0),
    firstDetectedAt: String(row.first_detected_at), lastDetectedAt: String(row.last_detected_at), reason: String(row.reason ?? '관련 검색과 뉴스 언급이 증가하고 있어요.'),
    relatedKeywords: Array.isArray(row.related_keywords) ? row.related_keywords.map(String) : [],
  }
}

export const getIssues = async (env: WorkerEnv, category: string | null, limit: number): Promise<ApiEnvelope<Issue[]>> => {
  if (isMock(env)) {
    const filtered = category && category !== '전체' ? mockIssues.filter((issue) => issue.category === category) : mockIssues
    return { data: filtered.slice(0, limit).map(({ history: _history, news: _news, ...issue }) => issue), meta: { updatedAt: mockUpdatedAt, mode: 'mock' } }
  }
  const supabase = createServerSupabase(env)
  let query = supabase
    .from('keywords')
    .select('id,keyword,slug,category,status,first_detected_at,last_detected_at,reason,related_keywords,keyword_snapshots(issue_score,rank,rank_change,collected_at)')
    .order('last_detected_at', { ascending: false })
    .order('collected_at', { referencedTable: 'keyword_snapshots', ascending: false })
    .limit(1, { referencedTable: 'keyword_snapshots' })
    .limit(limit)
  if (category && category !== '전체') query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  const issues = (data ?? []).map((row) => mapIssue(row as Record<string, unknown>)).sort((a, b) => a.rank - b.rank)
  return { data: issues, meta: { updatedAt: issues[0]?.lastDetectedAt ?? new Date().toISOString(), mode: 'real' } }
}

export const getIssue = async (env: WorkerEnv, slug: string): Promise<ApiEnvelope<Issue> | null> => {
  if (isMock(env)) {
    const issue = mockIssues.find((item) => item.slug === slug)
    return issue ? { data: issue, meta: { updatedAt: mockUpdatedAt, mode: 'mock' } } : null
  }
  const supabase = createServerSupabase(env)
  const historySince = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('keywords')
    .select('*,keyword_snapshots(*),news_articles(*)')
    .eq('slug', slug)
    .gte('keyword_snapshots.collected_at', historySince)
    .order('collected_at', { referencedTable: 'keyword_snapshots', ascending: true })
    .limit(145, { referencedTable: 'keyword_snapshots' })
    .order('published_at', { referencedTable: 'news_articles', ascending: false })
    .limit(20, { referencedTable: 'news_articles' })
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const issue = mapIssue(data as Record<string, unknown>)
  const row = data as Record<string, unknown>
  issue.history = ((row.keyword_snapshots as Array<Record<string, unknown>>) ?? []).map((snapshot) => ({ collectedAt:String(snapshot.collected_at), trendScore:Number(snapshot.trend_score), newsCount:Number(snapshot.news_count), issueScore:Number(snapshot.issue_score), rank:Number(snapshot.rank), rankChange:Number(snapshot.rank_change) }))
  issue.news = ((row.news_articles as Array<Record<string, unknown>>) ?? []).map((article) => ({ id:String(article.id), title:String(article.title), description:String(article.description ?? ''), url:String(article.url), publisher:String(article.publisher ?? ''), publishedAt:String(article.published_at) }))
  return { data: issue, meta: { updatedAt: issue.lastDetectedAt, mode: 'real' } }
}

export const slugParam = (params: PagesContext['params']): string => {
  const value = params.slug
  return decodeURIComponent(Array.isArray(value) ? value[0] : value)
}

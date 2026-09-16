import type { CandidateKeyword, NewsSignal, TrendSignal, WorkerEnv } from '../../shared/types'
import { NaverClient } from '../naver/client'
import { MockCandidateProvider } from '../providers/mock-candidate'
import { NaverNewsProvider } from '../providers/naver-news'
import { NaverSearchTrendProvider } from '../providers/naver-trend'
import type { CandidateProvider, NewsProvider, TrendProvider } from '../providers/interfaces'
import { createServerSupabase } from '../supabase'
import { deduplicateCandidates, slugify } from './normalize'
import { calculateIssueScore, determineStatus } from './scoring'

interface Providers { candidate: CandidateProvider; trend: TrendProvider; news: NewsProvider }

const realProviders = (env: WorkerEnv): Providers => {
  const client = new NaverClient(env)
  return {
    candidate: new MockCandidateProvider(),
    trend: new NaverSearchTrendProvider(client),
    news: new NaverNewsProvider(client),
  }
}

const getNewsSafely = async (provider: NewsProvider, keyword: string): Promise<NewsSignal> => {
  try {
    return await provider.getNews(keyword)
  } catch (error) {
    console.error('[collector] news failed', { keyword, error: error instanceof Error ? error.message : String(error) })
    return { keyword, articles: [], recentCount: 0, previousCount: 0, publisherCount: 0, latestPublishedAt: null }
  }
}

export const runCollection = async (env: WorkerEnv): Promise<{ collected: number; mode: string }> => {
  if ((env.DATA_MODE ?? 'mock') === 'mock') {
    console.info('[collector] mock mode: database write skipped')
    return { collected: 0, mode: 'mock' }
  }

  const providers = realProviders(env)
  const candidates: CandidateKeyword[] = deduplicateCandidates(await providers.candidate.getCandidates())
  const trends: TrendSignal[] = await providers.trend.getTrendSignals(candidates)
  const newsSignals: NewsSignal[] = []
  for (const candidate of candidates) newsSignals.push(await getNewsSafely(providers.news, candidate.keyword))

  const supabase = createServerSupabase(env)
  const { data: existing } = await supabase.from('keywords').select('id,keyword,first_detected_at,status')
  const existingMap = new Map((existing ?? []).map((row) => [String(row.keyword), row]))
  const scored = candidates.map((candidate) => {
    const trend = trends.find((item) => item.keyword === candidate.keyword) ?? { keyword: candidate.keyword, current: 0, previous: 0, growthRate: 0 }
    const news = newsSignals.find((item) => item.keyword === candidate.keyword)!
    const old = existingMap.get(candidate.keyword)
    const activeHours = old ? (Date.now() - Date.parse(String(old.first_detected_at))) / 3_600_000 : 0
    return { candidate, trend, news, old, score: calculateIssueScore({ trend, news, activeHours }) }
  }).sort((a, b) => b.score - a.score)

  const collectedAt = new Date().toISOString()
  for (const [index, item] of scored.entries()) {
    const { data: previous } = await supabase.from('keyword_snapshots').select('issue_score,rank').eq('keyword_id', item.old?.id ?? -1).order('collected_at', { ascending: false }).limit(1).maybeSingle()
    const rank = index + 1
    const rankChange = previous ? Number(previous.rank) - rank : 0
    const scoreDelta = previous ? item.score - Number(previous.issue_score) : item.score
    const status = determineStatus(!item.old, scoreDelta, rankChange)
    const { data: keywordRow, error: keywordError } = await supabase.from('keywords').upsert({
      keyword: item.candidate.keyword,
      slug: slugify(item.candidate.keyword),
      category: item.candidate.category,
      last_detected_at: collectedAt,
      status,
      reason: `${item.candidate.keyword} 관련 검색 관심도와 최근 뉴스 언급이 함께 증가하고 있어요.`,
      updated_at: collectedAt,
    }, { onConflict: 'keyword' }).select('id').single()
    if (keywordError || !keywordRow) throw keywordError ?? new Error('keyword upsert failed')

    await supabase.from('keyword_snapshots').insert({ keyword_id: keywordRow.id, collected_at: collectedAt, trend_score: item.trend.current, news_count: item.news.recentCount, issue_score: item.score, rank, rank_change: rankChange })
    if (item.news.articles.length) {
      await supabase.from('news_articles').upsert(item.news.articles.map((article) => ({ keyword_id: keywordRow.id, title: article.title, description: article.description, url: article.url, publisher: article.publisher, published_at: article.publishedAt, collected_at: collectedAt })), { onConflict: 'url', ignoreDuplicates: true })
    }
  }
  return { collected: scored.length, mode: 'real' }
}

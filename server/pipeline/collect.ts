import { COLLECTION } from '../../shared/score-config'
import type { CandidateKeyword, NewsSignal, WorkerEnv } from '../../shared/types'
import { resolveDataMode } from '../data-mode'
import { NaverClient } from '../naver/client'
import { MockCandidateProvider } from '../providers/mock-candidate'
import { NaverNewsProvider } from '../providers/naver-news'
import { NaverSearchTrendProvider } from '../providers/naver-trend'
import type { CandidateProvider, NewsProvider, TrendProvider } from '../providers/interfaces'
import { createServerSupabase } from '../supabase'
import { deduplicateCandidates, normalizeCandidates, slugify } from './normalize'
import { calculateIssueScore, determineStatus } from './scoring'

interface Providers { candidate: CandidateProvider; trend: TrendProvider; news: NewsProvider }

interface CollectionCounts {
  rawCandidates: number
  normalizedCandidates: number
  uniqueCandidates: number
  trendCheckedCandidates: number
  newsCheckedCandidates: number
  qualifiedCandidates: number
  savedCandidates: number
}

interface CollectionResult {
  collected: number
  mode: 'mock' | 'real'
  counts: CollectionCounts
}

const emptyCounts = (): CollectionCounts => ({
  rawCandidates: 0,
  normalizedCandidates: 0,
  uniqueCandidates: 0,
  trendCheckedCandidates: 0,
  newsCheckedCandidates: 0,
  qualifiedCandidates: 0,
  savedCandidates: 0,
})

const logCount = (stage: keyof CollectionCounts, count: number): void => {
  console.info(`[collector] ${stage} =`, count)
}

const realProviders = (env: WorkerEnv): Providers => {
  const client = new NaverClient(env)
  return {
    candidate: new MockCandidateProvider(),
    trend: new NaverSearchTrendProvider(client),
    news: new NaverNewsProvider(client),
  }
}

const getNewsSafely = async (provider: NewsProvider, keyword: string): Promise<NewsSignal | null> => {
  try {
    return await provider.getNews(keyword)
  } catch (error) {
    console.error('[collector] news failed', { keyword, error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

const emptyNewsSignal = (keyword: string): NewsSignal => ({
  keyword,
  articles: [],
  recentCount: 0,
  previousCount: 0,
  publisherCount: 0,
  latestPublishedAt: null,
})

export const runCollection = async (env: WorkerEnv): Promise<CollectionResult> => {
  if (resolveDataMode(env) === 'mock') {
    console.info('[collector] mock mode: database write skipped')
    return { collected: 0, mode: 'mock', counts: emptyCounts() }
  }

  const counts = emptyCounts()
  const providers = realProviders(env)

  const rawCandidates = await providers.candidate.getCandidates()
  counts.rawCandidates = rawCandidates.length
  logCount('rawCandidates', counts.rawCandidates)

  const normalizedCandidates = normalizeCandidates(rawCandidates)
  counts.normalizedCandidates = normalizedCandidates.length
  logCount('normalizedCandidates', counts.normalizedCandidates)

  const uniqueCandidates = deduplicateCandidates(normalizedCandidates)
  counts.uniqueCandidates = uniqueCandidates.length
  logCount('uniqueCandidates', counts.uniqueCandidates)

  const trends = await providers.trend.getTrendSignals(uniqueCandidates)
  const trendMap = new Map(trends.map((signal) => [signal.keyword, signal]))
  counts.trendCheckedCandidates = uniqueCandidates.filter((candidate) => trendMap.has(candidate.keyword)).length
  logCount('trendCheckedCandidates', counts.trendCheckedCandidates)

  const newsSignals: NewsSignal[] = []
  for (const candidate of uniqueCandidates) {
    const signal = await getNewsSafely(providers.news, candidate.keyword)
    if (signal) newsSignals.push(signal)
  }
  const newsMap = new Map(newsSignals.map((signal) => [signal.keyword, signal]))
  counts.newsCheckedCandidates = uniqueCandidates.filter((candidate) => newsMap.has(candidate.keyword)).length
  logCount('newsCheckedCandidates', counts.newsCheckedCandidates)

  const supabase = createServerSupabase(env)
  const { data: existing, error: existingError } = await supabase
    .from('keywords')
    .select('id,keyword,first_detected_at,status')
  if (existingError) throw existingError
  const existingMap = new Map((existing ?? []).map((row) => [String(row.keyword), row]))

  console.info('[collector] qualification thresholds =', {
    minIssueScore: COLLECTION.minIssueScore,
    minTrendScore: COLLECTION.minTrendScore,
    minNewsCount: COLLECTION.minNewsCount,
    topN: COLLECTION.topN,
  })

  const qualifiedCandidates = uniqueCandidates
    .map((candidate) => {
      const trend = trendMap.get(candidate.keyword) ?? { keyword: candidate.keyword, current: 0, previous: 0, growthRate: 0 }
      const news = newsMap.get(candidate.keyword) ?? emptyNewsSignal(candidate.keyword)
      const old = existingMap.get(candidate.keyword)
      const activeHours = old ? (Date.now() - Date.parse(String(old.first_detected_at))) / 3_600_000 : 0
      return { candidate, trend, news, old, score: calculateIssueScore({ trend, news, activeHours }) }
    })
    .filter((item) =>
      (trendMap.has(item.candidate.keyword) || newsMap.has(item.candidate.keyword))
      && item.score >= COLLECTION.minIssueScore
      && item.trend.current >= COLLECTION.minTrendScore
      && item.news.recentCount >= COLLECTION.minNewsCount,
    )
    .sort((a, b) => b.score - a.score)

  counts.qualifiedCandidates = qualifiedCandidates.length
  logCount('qualifiedCandidates', counts.qualifiedCandidates)

  const topCandidates = qualifiedCandidates.slice(0, COLLECTION.topN)
  const collectedAt = new Date().toISOString()

  for (const [index, item] of topCandidates.entries()) {
    try {
      const { data: previous, error: previousError } = await supabase
        .from('keyword_snapshots')
        .select('issue_score,rank')
        .eq('keyword_id', item.old?.id ?? -1)
        .order('collected_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (previousError) throw previousError

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

      const { error: snapshotError } = await supabase.from('keyword_snapshots').insert({
        keyword_id: keywordRow.id,
        collected_at: collectedAt,
        trend_score: item.trend.current,
        news_count: item.news.recentCount,
        issue_score: item.score,
        rank,
        rank_change: rankChange,
      })
      if (snapshotError) throw snapshotError

      if (item.news.articles.length) {
        const { error: newsError } = await supabase.from('news_articles').upsert(
          item.news.articles.map((article) => ({
            keyword_id: keywordRow.id,
            title: article.title,
            description: article.description,
            url: article.url,
            publisher: article.publisher,
            published_at: article.publishedAt,
            collected_at: collectedAt,
          })),
          { onConflict: 'url', ignoreDuplicates: true },
        )
        if (newsError) console.error('[collector] news save failed', { keyword: item.candidate.keyword, error: newsError.message })
      }

      counts.savedCandidates += 1
    } catch (error) {
      console.error('[collector] candidate save failed', {
        keyword: item.candidate.keyword,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logCount('savedCandidates', counts.savedCandidates)
  console.info('[collector] stage counts =', counts)
  return { collected: counts.savedCandidates, mode: 'real', counts }
}

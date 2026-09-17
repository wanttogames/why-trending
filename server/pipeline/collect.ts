import { COLLECTION, NEWS_DISCOVERY } from '../../shared/score-config'
import type { CandidateKeyword, NewsCandidateMetrics, NewsSignal, TrendSignal, WorkerEnv } from '../../shared/types'
import { resolveDataMode } from '../data-mode'
import { SubrequestCounter } from '../metrics/subrequest-counter'
import { NaverClient } from '../naver/client'
import { MockCandidateProvider } from '../providers/mock-candidate'
import { NaverNewsCandidateProvider } from '../providers/naver-news-candidate'
import { NaverSearchTrendProvider } from '../providers/naver-trend'
import type { CandidateProvider, TrendProvider } from '../providers/interfaces'
import { createServerSupabase } from '../supabase'
import { deduplicateCandidates, keywordHash, normalizeCandidates, slugify } from './normalize'
import { calculateIssueScore, determineStatus } from './scoring'

interface Providers { candidate: CandidateProvider; trend: TrendProvider }

interface CollectionCounts {
  newsSearchRequests: number
  rawArticles: number
  uniqueArticles: number
  extractedCandidates: number
  dedupedCandidates: number
  datalabCandidates: number
  qualifiedCandidates: number
  savedCandidates: number
  publicTopN: number
}

interface CollectionResult {
  collected: number
  mode: 'mock' | 'real'
  counts: CollectionCounts
}

interface SupabaseErrorFields {
  message: string | null
  code: string | null
  details: string | null
  hint: string | null
}

interface PreviousSnapshot {
  issue_score: number | string
  rank: number
  collected_at: string
}

interface ExistingKeywordRow {
  id: number
  keyword: string
  slug: string
  first_detected_at: string
  status: string
  keyword_snapshots?: PreviousSnapshot[]
}

const emptyCounts = (): CollectionCounts => ({
  newsSearchRequests: 0,
  rawArticles: 0,
  uniqueArticles: 0,
  extractedCandidates: 0,
  dedupedCandidates: 0,
  datalabCandidates: 0,
  qualifiedCandidates: 0,
  savedCandidates: 0,
  publicTopN: COLLECTION.topN,
})

const logCount = (stage: keyof CollectionCounts, count: number): void => {
  console.info(`[collector] ${stage} =`, count)
}

const errorValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const getSupabaseErrorFields = (error: unknown): SupabaseErrorFields => {
  if (error instanceof Error) {
    return { message: error.message, code: null, details: error.stack ?? null, hint: null }
  }
  if (typeof error !== 'object' || error === null) {
    return { message: errorValue(error), code: null, details: null, hint: null }
  }
  const record = error as Record<string, unknown>
  return {
    message: errorValue(record.message),
    code: errorValue(record.code),
    details: errorValue(record.details),
    hint: errorValue(record.hint),
  }
}

const logSaveError = (stage: string, error: unknown, payload: unknown): void => {
  console.error(`[collector] ${stage} failed`, {
    ...getSupabaseErrorFields(error),
    payload,
  })
}

interface KeywordUpsertPayload {
  keyword: string
  slug: string
  category: CandidateKeyword['category']
  last_detected_at: string
  status: ReturnType<typeof determineStatus>
  reason: string
  related_keywords: string[]
  updated_at: string
}

const encodedKeywordSlug = (keyword: string): string => {
  const bytes = new TextEncoder().encode(normalizeKeywordForSlug(keyword))
  const encoded = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `issue-${encoded}`
}

const normalizeKeywordForSlug = (keyword: string): string =>
  keyword.normalize('NFKC').trim().toLocaleLowerCase('ko-KR')

const ensureUniqueSlugs = (
  payload: KeywordUpsertPayload[],
  existingRows: ExistingKeywordRow[],
): KeywordUpsertPayload[] => {
  const payloadGroups = new Map<string, string[]>()
  for (const item of payload) {
    const keywords = payloadGroups.get(item.slug) ?? []
    keywords.push(item.keyword)
    payloadGroups.set(item.slug, keywords)
  }
  const duplicates = [...payloadGroups.entries()]
    .filter(([, keywords]) => keywords.length > 1)
    .map(([slug, keywords]) => ({ slug, keywords }))
  if (duplicates.length > 0) {
    console.error('[collector] duplicate slugs before upsert =', duplicates)
  }

  const slugOwners = new Map(existingRows.map((row) => [row.slug, row.keyword]))
  const resolved = payload.map((item) => {
    let slug = item.slug
    const owner = slugOwners.get(slug)
    if ((owner && owner !== item.keyword) || (payloadGroups.get(slug)?.length ?? 0) > 1) {
      const originalSlug = slug
      slug = `${slug}-${keywordHash(`slug:${item.keyword}`)}`
      if (slugOwners.has(slug) && slugOwners.get(slug) !== item.keyword) {
        slug = encodedKeywordSlug(item.keyword)
      }
      console.warn('[collector] slug collision resolved', {
        keyword: item.keyword,
        originalSlug,
        resolvedSlug: slug,
        existingOwner: owner ?? null,
      })
    }
    slugOwners.set(slug, item.keyword)
    return { ...item, slug }
  })

  const remainingDuplicates = new Map<string, string[]>()
  for (const item of resolved) {
    const keywords = remainingDuplicates.get(item.slug) ?? []
    keywords.push(item.keyword)
    remainingDuplicates.set(item.slug, keywords)
  }
  const unresolved = [...remainingDuplicates.entries()].filter(([, keywords]) => keywords.length > 1)
  if (unresolved.length > 0) {
    throw new Error(`slug uniqueness check failed: ${JSON.stringify(unresolved)}`)
  }
  console.info('[collector] slug uniqueness check passed =', resolved.length)
  return resolved
}

const cleanupExpiredData = async (
  supabase: ReturnType<typeof createServerSupabase>,
  now: Date,
): Promise<void> => {
  const snapshotCutoff = new Date(
    now.getTime() - COLLECTION.snapshotRetentionDays * 24 * 60 * 60_000,
  ).toISOString()
  const newsCutoff = new Date(
    now.getTime() - COLLECTION.newsRetentionDays * 24 * 60 * 60_000,
  ).toISOString()

  const { error: snapshotCleanupError } = await supabase
    .from('keyword_snapshots')
    .delete()
    .lt('collected_at', snapshotCutoff)
  if (snapshotCleanupError) {
    logSaveError('snapshot retention cleanup', snapshotCleanupError, { snapshotCutoff })
  } else {
    console.info('[collector] snapshot retention cleanup completed', { snapshotCutoff })
  }

  const { error: newsCleanupError } = await supabase
    .from('news_articles')
    .delete()
    .lt('collected_at', newsCutoff)
  if (newsCleanupError) {
    logSaveError('news retention cleanup', newsCleanupError, { newsCutoff })
  } else {
    console.info('[collector] news retention cleanup completed', { newsCutoff })
  }
}

const realProviders = (env: WorkerEnv, counter: SubrequestCounter): Providers => {
  const client = new NaverClient(env, counter)
  return {
    candidate: new NaverNewsCandidateProvider(client, new MockCandidateProvider()),
    trend: new NaverSearchTrendProvider(client),
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

const emptyNewsMetrics = (): NewsCandidateMetrics => ({
  newsFrequencyScore: 0,
  recentnessScore: 0,
  sourceDiversityScore: 0,
  articleCount: 0,
})

const emptyTrendSignal = (keyword: string): TrendSignal => ({
  keyword,
  current: 0,
  previous: 0,
  growthRate: 0,
  recentAverage: 0,
  previousAverage: 0,
  growthScore: 0,
  levelScore: 0,
})

const runCollectionWithCounter = async (
  env: WorkerEnv,
  counter: SubrequestCounter,
): Promise<CollectionResult> => {
  if (resolveDataMode(env) === 'mock') {
    console.info('[collector] mock mode: database write skipped')
    return { collected: 0, mode: 'mock', counts: emptyCounts() }
  }

  const counts = emptyCounts()
  const providers = realProviders(env, counter)

  const discovery = await providers.candidate.getCandidates()
  counts.newsSearchRequests = discovery.stats.newsSearchRequests
  counts.rawArticles = discovery.stats.rawArticles
  counts.uniqueArticles = discovery.stats.uniqueArticles
  counts.extractedCandidates = discovery.stats.extractedCandidates
  counts.dedupedCandidates = discovery.stats.dedupedCandidates
  logCount('newsSearchRequests', counts.newsSearchRequests)
  logCount('rawArticles', counts.rawArticles)
  logCount('uniqueArticles', counts.uniqueArticles)
  logCount('extractedCandidates', counts.extractedCandidates)
  logCount('dedupedCandidates', counts.dedupedCandidates)
  console.info('[collector] fixed candidate fallback =', discovery.stats.fallbackUsed)

  const uniqueCandidates = deduplicateCandidates(normalizeCandidates(discovery.candidates))
  const datalabCandidates = uniqueCandidates.slice(0, NEWS_DISCOVERY.datalabCandidateLimit)
  counts.datalabCandidates = datalabCandidates.length
  logCount('datalabCandidates', counts.datalabCandidates)

  const trends = await providers.trend.getTrendSignals(datalabCandidates)
  const trendMap = new Map(trends.map((signal) => [signal.keyword, signal]))

  const supabase = createServerSupabase(env, counter)
  const { data: existing, error: existingError } = await supabase
    .from('keywords')
    .select('id,keyword,slug,first_detected_at,status,keyword_snapshots(issue_score,rank,collected_at)')
    .order('collected_at', { referencedTable: 'keyword_snapshots', ascending: false })
    .limit(1, { referencedTable: 'keyword_snapshots' })
  if (existingError) {
    logSaveError('existing keywords read', existingError, { table: 'keywords' })
    throw existingError
  }

  const existingRows = (existing ?? []) as ExistingKeywordRow[]
  const existingMap = new Map(existingRows.map((row) => [row.keyword, row]))

  console.info('[collector] qualification thresholds =', {
    minIssueScore: COLLECTION.minIssueScore,
    minTrendGrowthScore: COLLECTION.minTrendGrowthScore,
    minNewsFrequencyScore: COLLECTION.minNewsFrequencyScore,
    maxSavedCandidates: COLLECTION.maxSavedCandidates,
    publicTopN: COLLECTION.topN,
  })

  const thresholdCandidates = datalabCandidates
    .map((candidate) => {
      const trend = trendMap.get(candidate.keyword) ?? emptyTrendSignal(candidate.keyword)
      const news = candidate.newsSignal ?? emptyNewsSignal(candidate.keyword)
      const newsMetrics = candidate.newsMetrics ?? emptyNewsMetrics()
      const old = existingMap.get(candidate.keyword)
      const latestSnapshot = old?.keyword_snapshots?.[0]
      const previous = latestSnapshot
        && Date.now() - Date.parse(latestSnapshot.collected_at) <= 30 * 60_000
        ? latestSnapshot
        : undefined
      return {
        candidate,
        trend,
        news,
        newsMetrics,
        old,
        previous,
        score: calculateIssueScore({ trend, news: newsMetrics }),
      }
    })
    .filter((item) =>
      trendMap.has(item.candidate.keyword)
      && item.score >= COLLECTION.minIssueScore
      && item.trend.growthScore >= COLLECTION.minTrendGrowthScore
      && (discovery.stats.fallbackUsed
        || item.newsMetrics.newsFrequencyScore >= COLLECTION.minNewsFrequencyScore),
    )
    .sort((a, b) => b.score - a.score)

  const qualifiedCandidates = thresholdCandidates.slice(0, COLLECTION.topN)
  counts.qualifiedCandidates = qualifiedCandidates.length
  logCount('qualifiedCandidates', counts.qualifiedCandidates)

  const saveCandidates = qualifiedCandidates
  const collectedAt = new Date().toISOString()
  const rankedCandidates = saveCandidates.map((item, index) => {
    const rank = index + 1
    const rankChange = item.previous ? Number(item.previous.rank) - rank : 0
    const scoreDelta = item.previous ? item.score - Number(item.previous.issue_score) : item.score
    return {
      ...item,
      rank,
      rankChange,
      status: determineStatus(!item.previous, scoreDelta, rankChange),
    }
  })

  console.info('[collector] top candidates =', rankedCandidates.map((item) => ({
    rank: item.rank,
    keyword: item.candidate.keyword,
    category: item.candidate.category,
    issueScore: item.score,
    trendGrowthScore: Math.round(item.trend.growthScore),
    newsFrequencyScore: Math.round(item.newsMetrics.newsFrequencyScore),
  })))

  const rawKeywordPayload: KeywordUpsertPayload[] = rankedCandidates.map((item) => ({
    keyword: item.candidate.keyword,
    slug: slugify(item.candidate.keyword),
    category: item.candidate.category,
    last_detected_at: collectedAt,
    status: item.status,
    reason: `${item.candidate.keyword} 관련 보도가 ${item.newsMetrics.articleCount}건 포착됐고 검색 관심도 상승 신호가 확인됐어요.`,
    related_keywords: item.candidate.relatedKeywords ?? [],
    updated_at: collectedAt,
  }))
  const keywordPayload = ensureUniqueSlugs(rawKeywordPayload, existingRows)

  console.info('[collector] keyword upsert payload =', keywordPayload)
  const { data: keywordRows, error: keywordError } = await supabase
    .from('keywords')
    .upsert(keywordPayload, { onConflict: 'keyword', defaultToNull: false })
    .select('id,keyword')
  if (keywordError) {
    logSaveError('keyword upsert', keywordError, keywordPayload)
    return { collected: 0, mode: 'real', counts }
  }

  const keywordIdMap = new Map((keywordRows ?? []).map((row) => [String(row.keyword), Number(row.id)]))
  const snapshotPayload = rankedCandidates.flatMap((item) => {
    const keywordId = keywordIdMap.get(item.candidate.keyword)
    if (!keywordId) return []
    return [{
      keyword_id: keywordId,
      collected_at: collectedAt,
      trend_score: item.trend.growthScore,
      news_count: item.newsMetrics.articleCount,
      issue_score: item.score,
      rank: item.rank,
      rank_change: item.rankChange,
    }]
  })

  console.info('[collector] snapshot insert payload =', snapshotPayload)
  const { data: savedSnapshots, error: snapshotError } = await supabase
    .from('keyword_snapshots')
    .insert(snapshotPayload)
    .select('keyword_id')
  if (snapshotError) {
    logSaveError('snapshot insert', snapshotError, snapshotPayload)
    return { collected: 0, mode: 'real', counts }
  }

  counts.savedCandidates = savedSnapshots?.length ?? snapshotPayload.length

  const newsByUrl = new Map<string, {
    keyword_id: number
    title: string
    description: string
    url: string
    publisher: string
    published_at: string
    collected_at: string
  }>()
  for (const item of rankedCandidates) {
    const keywordId = keywordIdMap.get(item.candidate.keyword)
    if (!keywordId) continue
    for (const article of item.news.articles.slice(0, COLLECTION.newsDisplay)) {
      if (!newsByUrl.has(article.url)) {
        newsByUrl.set(article.url, {
          keyword_id: keywordId,
          title: article.title,
          description: article.description,
          url: article.url,
          publisher: article.publisher,
          published_at: article.publishedAt,
          collected_at: collectedAt,
        })
      }
    }
  }
  const newsPayload = [...newsByUrl.values()]
  console.info('[collector] news upsert payload =', {
    articleCount: newsPayload.length,
    urls: newsPayload.map((article) => article.url),
  })

  if (newsPayload.length > 0) {
    const { error: newsError } = await supabase
      .from('news_articles')
      .upsert(newsPayload, { onConflict: 'url', ignoreDuplicates: true, defaultToNull: false })
    if (newsError) {
      logSaveError('news upsert', newsError, {
        articleCount: newsPayload.length,
        urls: newsPayload.map((article) => article.url),
      })
    }
  }

  const collectedDate = new Date(collectedAt)
  const shouldRunDailyCleanup = collectedDate.getUTCHours() === 18
    && collectedDate.getUTCMinutes() < COLLECTION.intervalMinutes
  if (shouldRunDailyCleanup) await cleanupExpiredData(supabase, collectedDate)

  logCount('savedCandidates', counts.savedCandidates)
  logCount('publicTopN', counts.publicTopN)
  console.info('[collector] stage counts =', counts)
  return { collected: counts.savedCandidates, mode: 'real', counts }
}

export const runCollection = async (env: WorkerEnv): Promise<CollectionResult> => {
  const counter = new SubrequestCounter()
  try {
    return await runCollectionWithCounter(env, counter)
  } finally {
    console.info('[collector] subrequests =', counter.snapshot())
  }
}

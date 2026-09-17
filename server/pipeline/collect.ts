import { COLLECTION } from '../../shared/score-config'
import type { CandidateKeyword, NewsSignal, WorkerEnv } from '../../shared/types'
import { resolveDataMode } from '../data-mode'
import { NaverClient } from '../naver/client'
import { MockCandidateProvider } from '../providers/mock-candidate'
import { NaverNewsProvider } from '../providers/naver-news'
import { NaverSearchTrendProvider } from '../providers/naver-trend'
import type { CandidateProvider, NewsProvider, TrendProvider } from '../providers/interfaces'
import { createServerSupabase } from '../supabase'
import { deduplicateCandidates, keywordHash, normalizeCandidates, slugify } from './normalize'
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
    console.error('[collector] news check failed', {
      keyword,
      ...getSupabaseErrorFields(error),
    })
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
    minTrendScore: COLLECTION.minTrendScore,
    minNewsCount: COLLECTION.minNewsCount,
    maxSavedCandidates: COLLECTION.maxSavedCandidates,
    publicTopN: COLLECTION.topN,
  })

  const qualifiedCandidates = uniqueCandidates
    .map((candidate) => {
      const trend = trendMap.get(candidate.keyword) ?? { keyword: candidate.keyword, current: 0, previous: 0, growthRate: 0 }
      const news = newsMap.get(candidate.keyword) ?? emptyNewsSignal(candidate.keyword)
      const old = existingMap.get(candidate.keyword)
      const previous = old?.keyword_snapshots?.[0]
      const activeHours = old ? (Date.now() - Date.parse(old.first_detected_at)) / 3_600_000 : 0
      return { candidate, trend, news, old, previous, score: calculateIssueScore({ trend, news, activeHours }) }
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

  const saveCandidates = qualifiedCandidates.slice(0, COLLECTION.maxSavedCandidates)
  const collectedAt = new Date().toISOString()
  const rankedCandidates = saveCandidates.map((item, index) => {
    const rank = index + 1
    const rankChange = item.previous ? Number(item.previous.rank) - rank : 0
    const scoreDelta = item.previous ? item.score - Number(item.previous.issue_score) : item.score
    return {
      ...item,
      rank,
      rankChange,
      status: determineStatus(!item.old, scoreDelta, rankChange),
    }
  })

  const rawKeywordPayload: KeywordUpsertPayload[] = rankedCandidates.map((item) => ({
    keyword: item.candidate.keyword,
    slug: slugify(item.candidate.keyword),
    category: item.candidate.category,
    last_detected_at: collectedAt,
    status: item.status,
    reason: `${item.candidate.keyword} 관련 검색 관심도와 최근 뉴스 언급이 함께 증가하고 있어요.`,
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
      trend_score: item.trend.current,
      news_count: item.news.recentCount,
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

  logCount('savedCandidates', counts.savedCandidates)
  console.info('[collector] stage counts =', counts)
  return { collected: counts.savedCandidates, mode: 'real', counts }
}

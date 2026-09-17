import { NEWS_DISCOVERY } from '../../shared/score-config'
import type { CandidateDiscoveryResult, CandidateKeyword, NewsArticle } from '../../shared/types'
import { NaverClient } from '../naver/client'
import { cleanNewsTitle, extractNewsCandidates, type DiscoveryArticle } from '../pipeline/news-candidate-extractor'
import type { CandidateProvider } from './interfaces'

interface NewsResponse {
  items: Array<{
    title: string
    originallink: string
    link: string
    description: string
    pubDate: string
  }>
}

const stripHtml = (value: string): string => cleanNewsTitle(value)

const publisherFrom = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return '출처 미상'
  }
}

const mergeCategoryHint = (article: DiscoveryArticle, category: CandidateKeyword['category']): void => {
  if (!article.categoryHints.includes(category)) article.categoryHints.push(category)
}

export class NaverNewsCandidateProvider implements CandidateProvider {
  constructor(
    private readonly client: NaverClient,
    private readonly fallback: CandidateProvider,
  ) {}

  async getCandidates(): Promise<CandidateDiscoveryResult> {
    const uniqueByUrl = new Map<string, DiscoveryArticle>()
    const uniqueByTitle = new Map<string, DiscoveryArticle>()
    let rawArticles = 0
    let newsSearchRequests = 0

    for (const seed of NEWS_DISCOVERY.seeds) {
      const params = new URLSearchParams({
        query: seed.query,
        display: String(NEWS_DISCOVERY.articlesPerSeed),
        start: '1',
        sort: 'date',
        format: 'json',
      })
      newsSearchRequests += 1
      let response: NewsResponse
      try {
        response = await this.client.request<NewsResponse>(`/search/v1/news?${params}`)
      } catch (error) {
        console.error('[collector] seed news search failed', {
          query: seed.query,
          message: error instanceof Error ? error.message : String(error),
        })
        continue
      }
      rawArticles += response.items.length

      for (const [index, item] of response.items.entries()) {
        const url = item.originallink || item.link
        const cleanedTitle = cleanNewsTitle(item.title)
        if (!url || !cleanedTitle) continue
        const titleKey = cleanedTitle.toLocaleLowerCase('ko-KR')
        const existing = uniqueByUrl.get(url) ?? uniqueByTitle.get(titleKey)
        if (existing) {
          mergeCategoryHint(existing, seed.category)
          continue
        }
        const publishedAt = new Date(item.pubDate)
        if (Number.isNaN(publishedAt.getTime())) continue
        const article: DiscoveryArticle = {
          id: `${publishedAt.getTime()}-${index}-${seed.query}`,
          title: cleanedTitle,
          cleanedTitle,
          description: stripHtml(item.description),
          url,
          publisher: publisherFrom(url),
          publishedAt: publishedAt.toISOString(),
          categoryHints: [seed.category],
        }
        uniqueByUrl.set(url, article)
        uniqueByTitle.set(titleKey, article)
      }
    }

    const uniqueArticles = [...uniqueByUrl.values()]
    const extraction = extractNewsCandidates(uniqueArticles)
    const stats = {
      newsSearchRequests,
      rawArticles,
      uniqueArticles: uniqueArticles.length,
      extractedCandidates: extraction.extractedCandidates,
      dedupedCandidates: extraction.dedupedCandidates,
      fallbackUsed: extraction.candidates.length < NEWS_DISCOVERY.minimumCandidateCount,
    }

    if (!stats.fallbackUsed) return { candidates: extraction.candidates, stats }

    console.warn('[collector] news candidate discovery fallback', stats)
    const fallbackResult = await this.fallback.getCandidates()
    return { candidates: fallbackResult.candidates, stats }
  }
}

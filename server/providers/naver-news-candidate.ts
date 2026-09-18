import { NEWS_DISCOVERY } from '../../shared/score-config'
import type { CandidateDiscoveryResult, CandidateKeyword, NewsArticle } from '../../shared/types'
import { NaverNewsProvider } from './naver-news'
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
    
  ) {}

  async getCandidates(): Promise<CandidateDiscoveryResult> {
    const uniqueByUrl = new Map<string, DiscoveryArticle>()
    const uniqueByTitle = new Map<string, DiscoveryArticle>()
    let rawArticles = 0
    let newsSearchRequests = 0

    const rotation = Math.floor(Date.now() / 600_000) % 3
    for (const seed of NEWS_DISCOVERY.seeds) {
      const query = seed.queries[rotation]
      const params = new URLSearchParams({
        query: query,
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
          query: query,
          message: error instanceof Error ? error.message : String(error),
        })
        continue
      }
      rawArticles += response.items.length

      for (const [index, item] of response.items.entries()) {
        const url = item.originallink || item.link
        const cleanedTitle = cleanNewsTitle(item.title)
        if (!/^https?:\/\//i.test(url) || !cleanedTitle) continue
        const titleKey = cleanedTitle.toLocaleLowerCase('ko-KR')
        const existing = uniqueByUrl.get(url) ?? uniqueByTitle.get(titleKey)
        if (existing) {
          mergeCategoryHint(existing, seed.category)
          continue
        }
        const publishedAt = new Date(item.pubDate)
        if (Number.isNaN(publishedAt.getTime()) || Date.now() - publishedAt.getTime() > 24 * 3_600_000 || publishedAt.getTime() > Date.now()) continue
        const article: DiscoveryArticle = {
          id: `${publishedAt.getTime()}-${index}-${query}`,
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
    let extraction = extractNewsCandidates(uniqueArticles)
    const targeted = new NaverNewsProvider(this.client)
    for (const candidate of extraction.candidates.slice(0, 2)) {
      newsSearchRequests += 1
      try {
        const result = await targeted.getNews(candidate.keyword)
        rawArticles += result.articles.length
        for (const article of result.articles) {
          const cleanedTitle = cleanNewsTitle(article.title)
          const key = cleanedTitle.toLocaleLowerCase('ko-KR')
          if (uniqueByUrl.has(article.url) || uniqueByTitle.has(key)) continue
          const entry = { ...article, cleanedTitle, categoryHints: [candidate.category] }
          uniqueByUrl.set(article.url, entry)
          uniqueByTitle.set(key, entry)
        }
      } catch (error) {
        console.warn('[collector] targeted news unavailable', { keyword: candidate.keyword, message: error instanceof Error ? error.message : 'unknown' })
      }
    }
    extraction = extractNewsCandidates([...uniqueByUrl.values()])
    const stats = {
      newsSearchRequests,
      rawArticles,
      uniqueArticles: uniqueByUrl.size,
      extractedCandidates: extraction.extractedCandidates,
      dedupedCandidates: extraction.dedupedCandidates,
      fallbackUsed: false,
    }

    if (newsSearchRequests > 0 && rawArticles === 0) throw new Error('뉴스 수집 결과가 없습니다. 기존 결과를 유지합니다.')
    return { candidates: extraction.candidates, stats }
  }
}

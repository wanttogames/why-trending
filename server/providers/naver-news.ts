import type { NewsArticle, NewsSignal } from '../../shared/types'
import { NaverClient } from '../naver/client'
import type { NewsProvider } from './interfaces'

interface NewsResponse {
  total: number
  items: Array<{
    title: string
    originallink: string
    link: string
    description: string
    pubDate: string
  }>
}

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const publisherFrom = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return '출처 미상'
  }
}

export class NaverNewsProvider implements NewsProvider {
  constructor(private readonly client: NaverClient) {}

  async getNews(keyword: string): Promise<NewsSignal> {
    const params = new URLSearchParams({ query: keyword, display: '100', start: '1', sort: 'date', format: 'json' })
    const response = await this.client.request<NewsResponse>(`/search/v1/news?${params}`)
    const seen = new Set<string>()
    const articles: NewsArticle[] = response.items.flatMap((item, index) => {
      const url = item.originallink || item.link
      if (seen.has(url)) return []
      seen.add(url)
      return [{
        id: `${Date.parse(item.pubDate)}-${index}`,
        title: stripHtml(item.title),
        description: stripHtml(item.description),
        url,
        publisher: publisherFrom(url),
        publishedAt: new Date(item.pubDate).toISOString(),
      }]
    })
    const now = Date.now()
    const recentCount = articles.filter((item) => now - Date.parse(item.publishedAt) <= 60 * 60_000).length
    const previousCount = articles.filter((item) => {
      const age = now - Date.parse(item.publishedAt)
      return age > 60 * 60_000 && age <= 120 * 60_000
    }).length

    return {
      keyword,
      articles,
      recentCount,
      previousCount,
      publisherCount: new Set(articles.map((item) => item.publisher)).size,
      latestPublishedAt: articles[0]?.publishedAt ?? null,
    }
  }
}

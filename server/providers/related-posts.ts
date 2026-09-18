import type { RelatedPost, WorkerEnv } from '../../shared/types'
import { NaverClient } from '../naver/client'
import { cleanNewsTitle } from '../pipeline/news-candidate-extractor'

interface Result { items: Array<{ title: string; link: string; cafename?: string; bloggername?: string }> }
export const getRelatedPosts = async (keyword: string, env: WorkerEnv): Promise<{ posts: RelatedPost[]; partial: boolean }> => {
  const client = new NaverClient(env)
  const posts: RelatedPost[] = []
  let partial = false
  for (const kind of ['blog', 'cafe'] as const) {
    try {
      const params = new URLSearchParams({ query: keyword, display: '5', sort: 'date', format: 'json' })
      const result = await client.request<Result>(`/search/v1/${kind === 'cafe' ? 'cafearticle' : 'blog'}?${params}`, { retries: 0 })
      for (const item of result.items) {
        if (!/^https?:\/\//i.test(item.link) || posts.some(p => p.url === item.link)) continue
        posts.push({ title: cleanNewsTitle(item.title), url: item.link, source: cleanNewsTitle(item.cafename ?? item.bloggername ?? ''), kind })
      }
    } catch (error) {
      partial = true
      console.warn('[related-posts] unavailable', { kind, message: error instanceof Error ? error.message : 'unknown' })
    }
  }
  return { posts, partial }
}

import assert from 'node:assert/strict'
import { buildEvidence, qualifies } from '../server/pipeline/evidence'
import { extractNewsCandidates, tokenizeNewsTitle } from '../server/pipeline/news-candidate-extractor'
import { runCollection } from '../server/pipeline/collect'
import { slugify } from '../server/pipeline/normalize'
import { NaverSearchTrendProvider } from '../server/providers/naver-trend'
import { NaverClient } from '../server/naver/client'
import { getRelatedPosts } from '../server/providers/related-posts'
import { getIssues } from '../functions/_shared/http'
import type { NewsSignal } from '../shared/types'

const now = Date.now()
const articles = Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: '삼성전자 HBM4 양산 확대', description: '', url: `https://source${i}.example/news/1`, publisher: `source${i}.example`, publishedAt: new Date(now - i * 60_000).toISOString() }))
const news: NewsSignal = { keyword: '삼성전자 HBM4', articles, recentCount: 4, previousCount: 0, publisherCount: 4, latestPublishedAt: articles[0].publishedAt }
assert(qualifies(45, news, undefined), 'breaking news qualifies without DataLab')
assert(!qualifies(45, { ...news, publisherCount: 1 }), 'one source does not qualify')
assert(!qualifies(45, { ...news, recentCount: 1, previousCount: 3 }), 'declining news without search does not qualify')
assert.equal(buildEvidence(news).trendStatus, 'unavailable')
assert(!buildEvidence(news).summary.includes('상승 신호가 확인'))
assert(tokenizeNewsTitle('아이유 공연 귀국').includes('아이유'))
assert.notEqual(slugify('K팝'), slugify('K리그'))
assert.equal(slugify('K팝'), slugify('K팝'))
const extraction = extractNewsCandidates(articles.map(a => ({ ...a, cleanedTitle: a.title, categoryHints: ['사회'] })), now)
assert(extraction.candidates.length > 0)
assert.equal(extraction.candidates[0].category, 'IT', 'content overrides seed category')

const requests: Record<string, number> = { news: 0, trend: 0, db: 0 }
let storedKeywords: Array<Record<string, unknown>> = []
let storedSnapshots: Array<Record<string, unknown>> = []
let storedEvents: Array<Record<string, unknown>> = []
const fixture = Array.from({ length: 25 }, (_, topic) => Array.from({ length: 4 }, (_, source) => ({
  title: `기업${topic} 기술${topic} 양산${topic} 후속보도${source}`,
  originallink: `https://source${source}.example/${topic}`, link: '', description: '',
  pubDate: new Date(now - source * 60_000).toUTCString(),
}))).flat()
const originalFetch = globalThis.fetch
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.pathname.endsWith('/news')) { requests.news++; return json({ items: fixture, total: fixture.length }) }
  if (url.pathname.includes('search-trend')) {
    requests.trend++
    const body = JSON.parse(String(init?.body)) as { keywordGroups: unknown[] }
    assert(body.keywordGroups.length <= 5)
    // Empty response is intentional: missing search data must not discard supported news.
    return json({ results: [] })
  }
  if (url.hostname === 'db.example') {
    requests.db++
    const table = url.pathname.split('/').at(-1)
    if (init?.method === 'POST') {
      const payload = JSON.parse(String(init.body)) as Array<Record<string, unknown>>
      if (table === 'keywords') { storedKeywords = payload.map((p,i) => ({ ...p, id: i+1 })); return json(storedKeywords) }
      if (table === 'keyword_snapshots') { storedSnapshots = payload; return json(payload) }
      if (table === 'issue_events') storedEvents = payload
      return json(payload)
    }
    return json([])
  }
  throw new Error(`Unexpected request ${url}`)
}
try {
  const result = await runCollection({ DATA_MODE: 'real', NAVER_CLIENT_ID: 'test', NAVER_CLIENT_SECRET: 'test', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test' })
  assert.equal(result.counts.datalabCandidates, 25)
  assert.equal(result.counts.savedCandidates, 20)
  assert.equal(requests.news, 8)
  assert.equal(requests.trend, 5)
  assert(storedKeywords.every(row => (row.evidence as { trendStatus: string }).trendStatus === 'unavailable'))
  assert.equal(storedSnapshots.length, 20)
  assert.equal(storedEvents.length, 20)
  assert(Object.values(requests).reduce((a,b) => a+b, 0) < 30)
  console.log('FIXTURE_COLLECTOR_RESULT', JSON.stringify({ ...result.counts, requests }))
  const top = storedKeywords.slice(0,3).map(k => ({ keyword: k.keyword, evidence: k.evidence }))
  console.log('FIXTURE_TOP_SAMPLE', JSON.stringify(top))

  globalThis.fetch = async () => json({ results: [{ title: '누락', data: [] }] })
  const provider = new NaverSearchTrendProvider(new NaverClient({ NAVER_CLIENT_ID: 'test', NAVER_CLIENT_SECRET: 'test' }))
  assert.equal((await provider.getTrendSignals([{ keyword: '누락', category: '사회' }])).length, 0)

  const dateOnly = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const series = Array.from({ length: 7 }, (_, i) => ({ period: dateOnly(new Date(Date.now() - (7-i)*86_400_000)), ratio: i < 5 ? 5 : 90 }))
  globalThis.fetch = async () => json({ results: [{ title: '검색 상승', data: [...series].reverse() }] })
  const rising = await provider.getTrendSignals([{ keyword: '검색 상승', category: '사회' }])
  assert(rising[0].growthScore > 5, 'unordered daily points are aligned by date')
  assert.equal(buildEvidence(news, rising[0]).trendStatus, 'rising')
  assert(qualifies(45, { ...news, recentCount: 1, previousCount: 3 }, rising[0]))

  let reads = 0
  globalThis.fetch = async (input) => {
    const url = new URL(String(input)); reads++
    if (url.pathname.endsWith('keyword_snapshots')) return json([{ collected_at: '2026-09-18T00:00:00Z' }])
    assert.equal(url.searchParams.get('last_detected_at'), 'eq.2026-09-18T00:00:00Z')
    return json([])
  }
  await getIssues({ DATA_MODE: 'real', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test' }, null, 20, true)
  assert.equal(reads, 2)

  globalThis.fetch = async () => json({ items: [{ title: '<b>관련 글</b>', link: 'javascript:alert(1)' }, { title: '관련 글', link: 'https://cafe.naver.com/example' }] })
  const posts = await getRelatedPosts('이슈', { NAVER_CLIENT_ID: 'test', NAVER_CLIENT_SECRET: 'test' })
  assert.equal(posts.posts.length, 1)
  assert.equal(posts.partial, false)
  console.log('PASS: evidence, qualification, category, slug, collector, missing DataLab, latest batch, related links')
} finally { globalThis.fetch = originalFetch }

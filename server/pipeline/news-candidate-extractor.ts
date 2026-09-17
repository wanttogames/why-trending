import { NEWS_DISCOVERY } from '../../shared/score-config'
import type { CandidateKeyword, NewsArticle, NewsCandidateMetrics } from '../../shared/types'

type IssueCategory = CandidateKeyword['category']

export interface DiscoveryArticle extends NewsArticle {
  cleanedTitle: string
  categoryHints: IssueCategory[]
}

export interface CandidateExtractionResult {
  candidates: CandidateKeyword[]
  extractedCandidates: number
  dedupedCandidates: number
}

const STOP_WORDS = new Set([
  '오늘', '기자', '속보', '단독', '종합', '공개', '관련', '논란', '사진', '영상', '인터뷰',
  '뉴스', '소식', '현장', '취재', '보도', '대해', '위해', '통해', '밝혀', '발표', '전망',
  '예정', '진행', '가능성', '관심', '가운데', '이번', '지난', '오는', '최근', '현재', '한국',
])

const ENDING_WORDS = new Set([
  '한다', '했다', '된다', '됐다', '나서', '밝혔다', '말했다', '전했다', '보인다', '있다', '없다',
])

const PARTICLE_SUFFIXES = ['으로는', '에서는', '에게는', '까지는', '부터는', '으로', '에서', '에게', '까지', '부터', '처럼', '보다', '에도', '에는', '이라', '라고', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로']

const decodeHtml = (value: string): string => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&amp;|&#38;/gi, '&')
  .replace(/&lt;|&#60;/gi, '<')
  .replace(/&gt;|&#62;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))

export const cleanNewsTitle = (title: string): string => decodeHtml(title)
  .normalize('NFKC')
  .replace(/^\s*(?:\[[^\]]{1,24}\]|【[^】]{1,24}】|\([^)]{1,24}\))\s*/g, '')
  .replace(/\s*(?:[-–—|｜]\s*)?(?:[가-힣A-Za-z0-9]{2,20}(?:뉴스|일보|신문|방송|TV|타임즈|경제))\s*$/i, '')
  .replace(/[^\p{L}\p{N}+#.-]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const trimParticle = (token: string): string => {
  for (const suffix of PARTICLE_SUFFIXES) {
    if (token.length - suffix.length >= 2 && token.endsWith(suffix)) return token.slice(0, -suffix.length)
  }
  return token
}

export const tokenizeNewsTitle = (title: string): string[] => cleanNewsTitle(title)
  .split(' ')
  .map(trimParticle)
  .filter((token) => {
    if (!token || STOP_WORDS.has(token) || ENDING_WORDS.has(token)) return false
    if (/^\d{1,2}$/.test(token)) return false
    return token.length >= 2 || /[A-Z0-9]/.test(token)
  })
  .slice(0, 16)

const canonicalPhrase = (tokens: string[]): string => tokens.join(' ').toLocaleLowerCase('ko-KR')

const clampScore = (value: number): number => Math.max(0, Math.min(100, value))

const calculateNewsMetrics = (articles: DiscoveryArticle[], now: number): NewsCandidateMetrics => {
  const ages = articles.map((article) => Math.max(0, now - Date.parse(article.publishedAt)))
  const latestAgeHours = Math.min(...ages) / 3_600_000
  const recentShare = ages.filter((age) => age <= 2 * 3_600_000).length / Math.max(1, ages.length)
  const publishers = new Set(articles.map((article) => article.publisher)).size
  return {
    newsFrequencyScore: clampScore((articles.length / 8) * 100),
    recentnessScore: clampScore(Math.exp(-latestAgeHours / 8) * 70 + recentShare * 30),
    sourceDiversityScore: clampScore((publishers / 6) * 100),
    articleCount: articles.length,
  }
}

const candidateScore = (metrics: NewsCandidateMetrics, tokenCount: number): number =>
  metrics.newsFrequencyScore * 0.5
  + metrics.recentnessScore * 0.3
  + metrics.sourceDiversityScore * 0.2
  + Math.min(4, Math.max(0, tokenCount - 2) * 2)

const dominantCategory = (articles: DiscoveryArticle[]): IssueCategory => {
  const votes = new Map<IssueCategory, number>()
  for (const article of articles) {
    const weight = 1 / Math.max(1, article.categoryHints.length)
    for (const category of article.categoryHints) {
      votes.set(category, (votes.get(category) ?? 0) + weight)
    }
  }
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '사회'
}

const relatedKeywords = (articles: DiscoveryArticle[], phraseTokens: Set<string>): string[] => {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const token of new Set(tokenizeNewsTitle(article.cleanedTitle))) {
      const key = token.toLocaleLowerCase('ko-KR')
      if (!phraseTokens.has(key) && !STOP_WORDS.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([token]) => token)
}

const createSearchTerms = (tokens: string[]): string[] => {
  const terms = [tokens.join(' ')]
  if (tokens.length >= 4) terms.push(tokens.slice(0, 3).join(' '))
  if (tokens.length >= 3) terms.push(tokens.slice(0, 2).join(' '))
  return [...new Set(terms)].slice(0, NEWS_DISCOVERY.maxSearchTermsPerCandidate)
}

const tokenSet = (keyword: string): Set<string> =>
  new Set(keyword.toLocaleLowerCase('ko-KR').split(' ').filter(Boolean))

const isSimilarCandidate = (left: string, right: string): boolean => {
  const a = tokenSet(left)
  const b = tokenSet(right)
  const intersection = [...a].filter((token) => b.has(token)).length
  if (intersection < 2) return false
  const union = new Set([...a, ...b]).size
  const containment = intersection / Math.min(a.size, b.size)
  return intersection / union >= 0.6 || containment >= 0.65
}

export const extractNewsCandidates = (
  articles: DiscoveryArticle[],
  now = Date.now(),
): CandidateExtractionResult => {
  const occurrences = new Map<string, { display: string; articleIndexes: Set<number>; tokens: string[] }>()

  articles.forEach((article, articleIndex) => {
    const tokens = tokenizeNewsTitle(article.cleanedTitle)
    const articlePhrases = new Set<string>()
    for (let size = 2; size <= Math.min(4, tokens.length); size += 1) {
      for (let start = 0; start + size <= tokens.length; start += 1) {
        const phraseTokens = tokens.slice(start, start + size)
        const key = canonicalPhrase(phraseTokens)
        if (articlePhrases.has(key)) continue
        articlePhrases.add(key)
        const current = occurrences.get(key) ?? {
          display: phraseTokens.join(' '),
          articleIndexes: new Set<number>(),
          tokens: phraseTokens,
        }
        current.articleIndexes.add(articleIndex)
        occurrences.set(key, current)
      }
    }
  })

  const extracted = [...occurrences.values()]
    .filter((entry) => entry.articleIndexes.size >= NEWS_DISCOVERY.minimumArticleFrequency)
    .map((entry) => {
      const matchedArticles = [...entry.articleIndexes].map((index) => articles[index])
      const metrics = calculateNewsMetrics(matchedArticles, now)
      const phraseTokenSet = new Set(entry.tokens.map((token) => token.toLocaleLowerCase('ko-KR')))
      const recentCount = matchedArticles.filter((article) => now - Date.parse(article.publishedAt) <= 60 * 60_000).length
      const previousCount = matchedArticles.filter((article) => {
        const age = now - Date.parse(article.publishedAt)
        return age > 60 * 60_000 && age <= 120 * 60_000
      }).length
      const newsSignal = {
        keyword: entry.display,
        articles: matchedArticles.map(({ cleanedTitle: _cleanedTitle, categoryHints: _categoryHints, ...article }) => article),
        recentCount,
        previousCount,
        publisherCount: new Set(matchedArticles.map((article) => article.publisher)).size,
        latestPublishedAt: matchedArticles
          .map((article) => article.publishedAt)
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
      }
      return {
        candidate: {
          keyword: entry.display,
          category: dominantCategory(matchedArticles),
          searchTerms: createSearchTerms(entry.tokens),
          relatedKeywords: relatedKeywords(matchedArticles, phraseTokenSet),
          newsSignal,
          newsMetrics: metrics,
        } satisfies CandidateKeyword,
        score: candidateScore(metrics, entry.tokens.length),
      }
    })
    .sort((a, b) => b.score - a.score || b.candidate.keyword.split(' ').length - a.candidate.keyword.split(' ').length)

  const deduped: CandidateKeyword[] = []
  for (const entry of extracted) {
    if (deduped.some((candidate) => isSimilarCandidate(candidate.keyword, entry.candidate.keyword))) continue
    deduped.push(entry.candidate)
  }

  return {
    candidates: deduped,
    extractedCandidates: extracted.length,
    dedupedCandidates: deduped.length,
  }
}

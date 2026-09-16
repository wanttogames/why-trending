export const CATEGORIES = ['전체', '연예', '스포츠', '게임', '경제', '사회', 'IT'] as const
export type Category = (typeof CATEGORIES)[number]
export type IssueStatus = 'NEW' | '급상승' | '상승' | '유지' | '하락'

export interface IssueSnapshot {
  collectedAt: string
  trendScore: number
  newsCount: number
  issueScore: number
  rank: number
  rankChange: number
}

export interface NewsArticle {
  id: string
  title: string
  description: string
  url: string
  publisher: string
  publishedAt: string
}

export interface Issue {
  id: string
  keyword: string
  slug: string
  category: Exclude<Category, '전체'>
  status: IssueStatus
  rank: number
  rankChange: number
  issueScore: number
  firstDetectedAt: string
  lastDetectedAt: string
  reason: string
  relatedKeywords: string[]
  history?: IssueSnapshot[]
  news?: NewsArticle[]
}

export interface ApiEnvelope<T> {
  data: T
  meta: { updatedAt: string; mode: 'mock' | 'real' }
}

export interface CandidateKeyword {
  keyword: string
  category: Exclude<Category, '전체'>
}

export interface TrendSignal {
  keyword: string
  current: number
  previous: number
  growthRate: number
}

export interface NewsSignal {
  keyword: string
  articles: NewsArticle[]
  recentCount: number
  previousCount: number
  publisherCount: number
  latestPublishedAt: string | null
}

export interface WorkerEnv {
  NAVER_CLIENT_ID?: string
  NAVER_CLIENT_SECRET?: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  DATA_MODE?: string
}

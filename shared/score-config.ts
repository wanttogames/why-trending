export const SCORE_WEIGHTS = {
  trendGrowth: 35,
  newsFrequency: 25,
  recentness: 20,
  sourceDiversity: 10,
  trendLevel: 10,
} as const

export const TREND_BATCH = {
  maxGroupsPerRequest: 5,
  maxKeywordsPerGroup: 20,
  lookbackDays: 14,
  recentDays: 2,
  previousDays: 5,
} as const

export const NEWS_DISCOVERY = {
  seeds: [
    { query: '사회', category: '사회' },
    { query: '경제', category: '경제' },
    { query: '연예', category: '연예' },
    { query: '스포츠', category: '스포츠' },
    { query: '게임', category: '게임' },
    { query: 'IT', category: 'IT' },
  ],
  articlesPerSeed: 100,
  datalabCandidateLimit: 25,
  minimumCandidateCount: 5,
  minimumArticleFrequency: 2,
  maxSearchTermsPerCandidate: 4,
} as const

export const COLLECTION = {
  intervalMinutes: 10,
  newsDisplay: 20,
  newsApiDisplay: 100,
  topN: 20,
  maxSavedCandidates: 20,
  snapshotRetentionDays: 30,
  newsRetentionDays: 90,
  minIssueScore: 25,
  minTrendGrowthScore: 5,
  minNewsFrequencyScore: 10,
} as const

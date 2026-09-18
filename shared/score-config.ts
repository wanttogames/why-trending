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
    { queries: ['수사', '사고', '판결'], category: '사회' },
    { queries: ['실적', '금리', '투자'], category: '경제' },
    { queries: ['컴백', '공연', '출연'], category: '연예' },
    { queries: ['우승', '이적', '결승'], category: '스포츠' },
    { queries: ['신작 게임', 'e스포츠', '게임 업데이트'], category: '게임' },
    { queries: ['인공지능', '반도체', '보안'], category: 'IT' },
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

export const SCORE_WEIGHTS = {
  searchTrend: 40,
  newsGrowth: 30,
  newsVelocity: 15,
  publisherSpread: 10,
  persistence: 5,
} as const

export const TREND_BATCH = {
  maxGroupsPerRequest: 5,
  maxKeywordsPerGroup: 20,
  lookbackDays: 7,
} as const

export const COLLECTION = {
  intervalMinutes: 10,
  newsDisplay: 20,
  newsApiDisplay: 100,
} as const

interface KeywordSearchConfig {
  trendTerms: string[]
  newsQuery: string
}

const KEYWORD_SEARCH_OVERRIDES: Record<string, KeywordSearchConfig> = {
  TFT: {
    trendTerms: ['롤토체스', '전략적 팀 전투'],
    newsQuery: '롤토체스',
  },
}

export const getTrendTerms = (keyword: string): string[] =>
  KEYWORD_SEARCH_OVERRIDES[keyword]?.trendTerms ?? [keyword]

export const getNewsQuery = (keyword: string): string =>
  KEYWORD_SEARCH_OVERRIDES[keyword]?.newsQuery ?? keyword


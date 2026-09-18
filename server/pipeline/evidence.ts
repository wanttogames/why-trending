import type { IssueEvidence, NewsSignal, TrendSignal } from '../../shared/types'
import { COLLECTION } from '../../shared/score-config'

export const qualifies = (score: number, news: NewsSignal, trend?: TrendSignal): boolean => {
  if (score < COLLECTION.minIssueScore || news.publisherCount < 2 || news.articles.length < 3) return false
  const newsSurge = news.recentCount >= 3 && news.recentCount >= Math.max(1, news.previousCount) * 1.5
  return newsSurge || !!trend && trend.growthScore >= COLLECTION.minTrendGrowthScore
}

export const buildEvidence = (news: NewsSignal, trend?: TrendSignal): IssueEvidence => {
  const trendStatus = !trend ? 'unavailable' : trend.growthScore >= COLLECTION.minTrendGrowthScore ? 'rising' : 'stable'
  const article = [...news.articles].sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt))[0]
  const search = trendStatus === 'rising' ? '일간 검색 관심도에서도 상승 신호가 확인됐습니다.' : trendStatus === 'unavailable' ? '검색 관심도 데이터는 확인하지 못했습니다.' : '일간 검색 관심도의 뚜렷한 상승은 아직 확인되지 않았습니다.'
  return {
    signal: trendStatus === 'rising' ? 'search' : 'news', trendStatus,
    recentCount: news.recentCount, previousCount: news.previousCount, publisherCount: news.publisherCount,
    summary: `수집한 기사 중 최근 1시간 ${news.recentCount}건, 직전 1시간 ${news.previousCount}건이며 출처 도메인 ${news.publisherCount}곳에서 포착됐습니다. ${search}`,
    representative: article ? { title: article.title, url: article.url, publishedAt: article.publishedAt } : null,
  }
}

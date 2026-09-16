import { SCORE_WEIGHTS } from '../../shared/score-config'
import type { IssueStatus, NewsSignal, TrendSignal } from '../../shared/types'

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export interface ScoreInput {
  trend: TrendSignal
  news: NewsSignal
  previousScore?: number
  activeHours?: number
}

export const calculateIssueScore = ({ trend, news, previousScore = 0, activeHours = 0 }: ScoreInput): number => {
  const trendRise = clamp01(Math.max(0, trend.growthRate) / 2)
  const newsGrowth = clamp01((news.recentCount - news.previousCount + 4) / 12)
  const velocity = clamp01(news.recentCount / 15)
  const spread = clamp01(news.publisherCount / 12)
  const persistence = clamp01(activeHours / 24)
  const raw = trendRise * SCORE_WEIGHTS.searchTrend
    + newsGrowth * SCORE_WEIGHTS.newsGrowth
    + velocity * SCORE_WEIGHTS.newsVelocity
    + spread * SCORE_WEIGHTS.publisherSpread
    + persistence * SCORE_WEIGHTS.persistence
  return Math.round(Math.max(previousScore * 0.15, Math.min(100, raw)))
}

export const determineStatus = (isNew: boolean, scoreDelta: number, rankChange: number): IssueStatus => {
  if (isNew) return 'NEW'
  if (scoreDelta >= 12 || rankChange >= 5) return '급상승'
  if (scoreDelta >= 3 || rankChange >= 1) return '상승'
  if (scoreDelta <= -3 || rankChange <= -1) return '하락'
  return '유지'
}

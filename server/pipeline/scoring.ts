import { SCORE_WEIGHTS } from '../../shared/score-config'
import type { IssueStatus, NewsCandidateMetrics, TrendSignal } from '../../shared/types'

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export interface ScoreInput {
  trend: TrendSignal
  news: NewsCandidateMetrics
}

export const calculateIssueScore = ({ trend, news }: ScoreInput): number => {
  const raw = clamp01(trend.growthScore / 100) * SCORE_WEIGHTS.trendGrowth
    + clamp01(news.newsFrequencyScore / 100) * SCORE_WEIGHTS.newsFrequency
    + clamp01(news.recentnessScore / 100) * SCORE_WEIGHTS.recentness
    + clamp01(news.sourceDiversityScore / 100) * SCORE_WEIGHTS.sourceDiversity
    + clamp01(trend.levelScore / 100) * SCORE_WEIGHTS.trendLevel
  return Math.round(Math.min(100, raw))
}

export const determineStatus = (isNew: boolean, scoreDelta: number, rankChange: number): IssueStatus => {
  if (isNew) return 'NEW'
  if (scoreDelta >= 12 || rankChange >= 5) return '급상승'
  if (scoreDelta >= 3 || rankChange >= 1) return '상승'
  if (scoreDelta <= -3 || rankChange <= -1) return '하락'
  return '유지'
}

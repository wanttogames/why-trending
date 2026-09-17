import { TREND_BATCH } from '../../shared/score-config'
import { getTrendTerms } from '../../shared/keyword-search-config'
import type { CandidateKeyword, TrendSignal } from '../../shared/types'
import { NaverClient } from '../naver/client'
import type { TrendProvider } from './interfaces'

interface TrendResponse {
  results: Array<{ title: string; data: Array<{ period: string; ratio: number }> }>
}

const dateOnly = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date)
const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

export class NaverSearchTrendProvider implements TrendProvider {
  constructor(private readonly client: NaverClient) {}

  async getTrendSignals(keywords: CandidateKeyword[]): Promise<TrendSignal[]> {
    const end = new Date()
    const start = new Date(end.getTime() - TREND_BATCH.lookbackDays * 86_400_000)
    const batches = chunk(keywords, TREND_BATCH.maxGroupsPerRequest)
    const signals: TrendSignal[] = []

    for (const batch of batches) {
      let response: TrendResponse
      try {
        response = await this.client.request<TrendResponse>('/search-trend/v1/search', {
          method: 'POST',
          body: {
            startDate: dateOnly(start),
            endDate: dateOnly(end),
            timeUnit: 'date',
            keywordGroups: batch.map(({ keyword, searchTerms }) => ({
              groupName: keyword,
              keywords: (searchTerms?.length ? searchTerms : getTrendTerms(keyword))
                .slice(0, TREND_BATCH.maxKeywordsPerGroup),
            })),
          },
        })
      } catch (error) {
        console.error('[collector] datalab batch failed', {
          keywords: batch.map((candidate) => candidate.keyword),
          message: error instanceof Error ? error.message : String(error),
        })
        continue
      }
      for (const result of response.results) {
        const values = result.data.map((point) => point.ratio)
        const recentValues = values.slice(-TREND_BATCH.recentDays)
        const previousValues = values.slice(
          -(TREND_BATCH.recentDays + TREND_BATCH.previousDays),
          -TREND_BATCH.recentDays,
        )
        const average = (items: number[]): number =>
          items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0
        const recentAverage = average(recentValues)
        const previousAverage = average(previousValues)
        const growthRate = previousAverage > 0
          ? (recentAverage - previousAverage) / previousAverage
          : recentAverage > 0 ? 2 : 0
        const latest = recentValues.at(-1) ?? recentAverage
        const previousPeak = Math.max(1, ...previousValues)
        const spikeRate = Math.max(0, (latest - previousPeak) / previousPeak)
        const growthScore = Math.max(0, Math.min(100,
          Math.max(0, growthRate) * 35 + spikeRate * 30,
        ))
        const levelScore = Math.max(0, Math.min(100, recentAverage))
        signals.push({
          keyword: result.title,
          current: recentAverage,
          previous: previousAverage,
          growthRate,
          recentAverage,
          previousAverage,
          growthScore,
          levelScore,
        })
      }
    }
    return signals
  }
}

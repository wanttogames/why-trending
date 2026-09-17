import { TREND_BATCH } from '../../shared/score-config'
import { getTrendTerms } from '../../shared/keyword-search-config'
import type { CandidateKeyword, TrendSignal } from '../../shared/types'
import { NaverClient } from '../naver/client'
import type { TrendProvider } from './interfaces'

interface TrendResponse {
  results: Array<{ title: string; data: Array<{ period: string; ratio: number }> }>
}

const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
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
      const response = await this.client.request<TrendResponse>('/search-trend/v1/search', {
        method: 'POST',
        body: {
          startDate: dateOnly(start),
          endDate: dateOnly(end),
          timeUnit: 'date',
          keywordGroups: batch.map(({ keyword }) => ({
            groupName: keyword,
            keywords: getTrendTerms(keyword),
          })),
        },
      })
      for (const result of response.results) {
        const values = result.data.map((point) => point.ratio)
        const current = values.at(-1) ?? 0
        const previous = values.at(-2) ?? current
        signals.push({
          keyword: result.title,
          current,
          previous,
          growthRate: previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0,
        })
      }
    }
    return signals
  }
}

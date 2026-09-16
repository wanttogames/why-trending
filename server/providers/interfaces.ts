import type { CandidateKeyword, NewsSignal, TrendSignal } from '../../shared/types'

export interface CandidateProvider {
  getCandidates(): Promise<CandidateKeyword[]>
}

export interface TrendProvider {
  getTrendSignals(keywords: CandidateKeyword[]): Promise<TrendSignal[]>
}

export interface NewsProvider {
  getNews(keyword: string): Promise<NewsSignal>
}

import type { CandidateDiscoveryResult, CandidateKeyword, NewsSignal, TrendSignal } from '../../shared/types'

export interface CandidateProvider {
  getCandidates(): Promise<CandidateDiscoveryResult>
}

export interface TrendProvider {
  getTrendSignals(keywords: CandidateKeyword[]): Promise<TrendSignal[]>
}

export interface NewsProvider {
  getNews(keyword: string): Promise<NewsSignal>
}

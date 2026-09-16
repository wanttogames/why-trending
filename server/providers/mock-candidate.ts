import type { CandidateKeyword } from '../../shared/types'
import type { CandidateProvider } from './interfaces'

const candidates: CandidateKeyword[] = [
  { keyword: '손흥민', category: '스포츠' },
  { keyword: '아이폰18', category: 'IT' },
  { keyword: 'TFT', category: '게임' },
  { keyword: '비트코인', category: '경제' },
  { keyword: '삼성전자', category: '경제' },
  { keyword: '프로야구', category: '스포츠' },
  { keyword: '추석 연휴', category: '사회' },
  { keyword: '신작 드라마', category: '연예' },
]

export class MockCandidateProvider implements CandidateProvider {
  async getCandidates(): Promise<CandidateKeyword[]> {
    return candidates
  }
}

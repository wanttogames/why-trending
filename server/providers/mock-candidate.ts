import type { CandidateDiscoveryResult, CandidateKeyword } from '../../shared/types'
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
  { keyword: 'K리그', category: '스포츠' },
  { keyword: '축구 국가대표', category: '스포츠' },
  { keyword: '류현진', category: '스포츠' },
  { keyword: '리그 오브 레전드', category: '게임' },
  { keyword: '배틀그라운드', category: '게임' },
  { keyword: '오버워치', category: '게임' },
  { keyword: '메이플스토리', category: '게임' },
  { keyword: '코스피', category: '경제' },
  { keyword: '환율', category: '경제' },
  { keyword: '금리', category: '경제' },
  { keyword: '부동산', category: '경제' },
  { keyword: '날씨', category: '사회' },
  { keyword: '태풍', category: '사회' },
  { keyword: '지하철', category: '사회' },
  { keyword: '교육', category: '사회' },
  { keyword: 'K팝', category: '연예' },
  { keyword: '아이돌', category: '연예' },
  { keyword: '넷플릭스', category: '연예' },
  { keyword: '영화', category: '연예' },
  { keyword: '예능', category: '연예' },
  { keyword: '갤럭시', category: 'IT' },
  { keyword: '인공지능', category: 'IT' },
  { keyword: 'ChatGPT', category: 'IT' },
  { keyword: '반도체', category: 'IT' },
]

export class MockCandidateProvider implements CandidateProvider {
  async getCandidates(): Promise<CandidateDiscoveryResult> {
    return {
      candidates,
      stats: {
        newsSearchRequests: 0,
        rawArticles: 0,
        uniqueArticles: 0,
        extractedCandidates: candidates.length,
        dedupedCandidates: candidates.length,
        fallbackUsed: true,
      },
    }
  }
}

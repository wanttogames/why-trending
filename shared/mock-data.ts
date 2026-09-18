import type { Issue, IssueSnapshot, NewsArticle } from './types'

const now = new Date()
const isoAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()
const history = (rank: number, score: number, seed: number): IssueSnapshot[] =>
  Array.from({ length: 25 }, (_, i) => {
    const wave = Math.sin((i + seed) / 3) * 5
    const ramp = i * (score / 110)
    return {
      collectedAt: isoAgo((24 - i) * 60),
      trendScore: Math.round(Math.min(100, 15 + ramp + wave)),
      newsCount: Math.max(1, Math.round(3 + i * 0.8 + wave / 2)),
      issueScore: Math.round(Math.max(8, Math.min(100, 18 + ramp + wave))),
      rank,
      rankChange: 0,
    }
  })

const news = (keyword: string, publisher: string, minutes: number, suffix: string): NewsArticle => ({
  id: `${keyword}-${minutes}`,
  title: `${keyword}, ${suffix}`,
  description: `${keyword} 관련 최신 소식과 배경을 정리한 기사입니다.`,
  url: `https://example.com/news/${encodeURIComponent(keyword)}-${minutes}`,
  publisher,
  publishedAt: isoAgo(minutes),
})

const seeds: Array<Omit<Issue, 'history' | 'news' | 'lastDetectedAt'>> = [
  { id:'1', keyword:'손흥민', slug:'son-heung-min', category:'스포츠', status:'급상승', rank:1, rankChange:4, issueScore:96, firstDetectedAt:isoAgo(130), reason:'경기 직후 활약 소식과 인터뷰가 여러 매체에서 동시에 보도되며 관심이 빠르게 늘고 있어요.', relatedKeywords:['토트넘','축구','프리미어리그'] },
  { id:'2', keyword:'아이폰18', slug:'iphone-18', category:'IT', status:'NEW', rank:2, rankChange:0, issueScore:91, firstDetectedAt:isoAgo(25), reason:'신제품 예상 사양과 공개 일정 관련 보도가 짧은 시간에 집중됐어요.', relatedKeywords:['애플','iOS','스마트폰'] },
  { id:'3', keyword:'TFT', slug:'tft', category:'게임', status:'상승', rank:3, rankChange:5, issueScore:84, firstDetectedAt:isoAgo(310), reason:'신규 패치와 시즌 메타 변화에 대한 검색과 공략 기사가 함께 증가하고 있어요.', relatedKeywords:['롤토체스','패치노트','전략적 팀 전투'] },
  { id:'4', keyword:'비트코인', slug:'bitcoin', category:'경제', status:'급상승', rank:4, rankChange:7, issueScore:82, firstDetectedAt:isoAgo(80), reason:'가격 변동성이 커지면서 시장 전망과 거래 동향 보도가 급증했어요.', relatedKeywords:['가상자산','이더리움','금리'] },
  { id:'5', keyword:'삼성전자', slug:'samsung-electronics', category:'경제', status:'유지', rank:5, rankChange:0, issueScore:76, firstDetectedAt:isoAgo(620), reason:'반도체 실적 전망과 신규 투자 관련 보도가 꾸준히 이어지고 있어요.', relatedKeywords:['반도체','코스피','HBM'] },
  { id:'6', keyword:'프로야구', slug:'kbo', category:'스포츠', status:'상승', rank:6, rankChange:2, issueScore:73, firstDetectedAt:isoAgo(190), reason:'순위 경쟁이 치열해지며 경기 결과와 하이라이트 관심이 함께 올랐어요.', relatedKeywords:['KBO','가을야구','야구'] },
  { id:'7', keyword:'추석 연휴', slug:'chuseok-holiday', category:'사회', status:'상승', rank:7, rankChange:3, issueScore:69, firstDetectedAt:isoAgo(470), reason:'교통 예보와 연휴 일정 안내가 발표되며 관련 정보 검색이 늘고 있어요.', relatedKeywords:['고속도로','연휴','기차표'] },
  { id:'8', keyword:'신작 드라마', slug:'new-drama', category:'연예', status:'하락', rank:8, rankChange:-3, issueScore:62, firstDetectedAt:isoAgo(760), reason:'첫 방송 반응과 출연진 인터뷰가 이어지고 있지만 증가 속도는 둔화됐어요.', relatedKeywords:['OTT','시청률','배우'] },
]

export const mockIssues: Issue[] = seeds.map((item, index) => ({
  ...item,
  lastDetectedAt: isoAgo(index * 3),
  evidence: {
    signal: 'news', trendStatus: 'unavailable', recentCount: 2, previousCount: 1, publisherCount: 3,
    summary: '개발용 예시 데이터입니다. 실제 수집 결과가 아닙니다.',
    representative: { title: `${item.keyword} 개발용 예시 기사`, url: 'https://example.com', publishedAt: isoAgo(12) },
  },
  events: [{ title: '서비스 최초 감지 (예시)', description: '개발용 타임라인 예시', eventAt: item.firstDetectedAt }],
  history: history(item.rank, item.issueScore, index),
  news: [
    news(item.keyword, '연합뉴스', 12 + index, '관련 소식에 관심 집중'),
    news(item.keyword, '한국경제', 44 + index * 2, '오늘 주목받는 배경은'),
    news(item.keyword, '전자신문', 96 + index * 3, '핵심 흐름 한눈에 보기'),
  ],
}))

export const mockUpdatedAt = isoAgo(3)

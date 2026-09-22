export const BRAND = { name: 'TrendPick', tagline: '관심의 흐름을 발견하다', description: 'NAVER Data Lab 기반 관심도 비교와 쇼핑 클릭 트렌드' } as const
export const CATEGORIES = ['전체','IT','게임','자동차','쇼핑','가전','패션','뷰티','여행','스포츠','엔터테인먼트'] as const
export const PERIODS = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const
export type Period = keyof typeof PERIODS
export const PERIOD_LABELS: Record<Period,string> = { '1d':'오늘 · 최신 일간','7d':'최근 7일','30d':'최근 30일','90d':'최근 3개월','1y':'최근 1년' }
export const NOTICE = '관심도는 NAVER Data Lab 상대 지수를 기반으로 합니다. 실제 검색 횟수·판매량을 의미하지 않습니다.'
export const SHOP_CATEGORIES = [
 { id:'digital', label:'디지털', code:'50000003', official:'디지털/가전' },
 { id:'appliances', label:'가전', code:'50000003', official:'디지털/가전' },
 { id:'fashion', label:'패션', code:'50000000', official:'패션의류' },
 { id:'beauty', label:'뷰티', code:'50000002', official:'화장품/미용' },
 { id:'life', label:'생활', code:'50000008', official:'생활/건강' },
 { id:'food', label:'식품', code:'50000006', official:'식품' },
 { id:'sports', label:'스포츠', code:'50000007', official:'스포츠/레저' },
 { id:'baby', label:'육아', code:'50000005', official:'출산/육아' },
 { id:'furniture', label:'가구', code:'50000004', official:'가구/인테리어' },
 { id:'pets', label:'반려동물', code:'50000008', official:'생활/건강' },
] as const
export const SUGGESTED_PAIRS = [['ChatGPT','Gemini'],['아이폰17','갤럭시 S26'],['T1','젠지'],['넷플릭스','디즈니+']]

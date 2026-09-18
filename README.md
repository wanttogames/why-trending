# 왜떠?

대한민국에서 갑자기 관심이 증가하는 키워드를 찾고, 단순 순위뿐 아니라 **왜 뜨는지**를 함께 보여주는 실시간 이슈 탐지 서비스 MVP입니다.

> 이슈지수는 여러 공개 데이터의 증가 속도를 기반으로 계산한 자체 지표입니다. 실제 검색량이나 네이버 실시간 검색 순위가 아닙니다.

## 아키텍처

```text
Cloudflare Cron Worker (10분)
  ├─ NaverNewsCandidateProvider (최신 뉴스 6개 seed 검색)
  ├─ 제목 정제 / 반복 2~4-gram phrase 추출 / 유사 후보 제거
  ├─ NaverSearchTrendProvider (상위 후보 25개 batch 검증)
  ├─ Issue Score / 순위 / 상태 계산
  └─ Supabase PostgreSQL 저장

Vue 3 Frontend
  └─ Cloudflare Worker /api/*
       └─ Supabase REST (Service Role은 서버에서만 사용)
```

Cloudflare Worker가 `/api/*`를 먼저 처리하고, 나머지 요청은 Static Assets 바인딩으로 Vue 앱에 전달합니다. 별도 Collector Worker가 Cron Trigger로 수집을 실행합니다. 브라우저는 NAVER 및 Supabase Service Role에 직접 접근하지 않습니다.

## 주요 기능

- 모바일 우선 실시간 이슈 TOP 20 및 카테고리 필터
- NEW / 급상승 / 상승 / 유지 / 하락 상태와 순위 변동
- 이슈지수, 최초·마지막 감지 시각, 뜨는 이유
- 최근 24시간 이슈지수 그래프
- 관련 뉴스 및 관련 키워드
- 현재·과거 이슈를 고려한 검색 API 구조
- URL 복사 및 Web Share API
- 이슈별 title, description, Open Graph 메타데이터
- API 키 없이 확인 가능한 mock 데이터 및 그래프
- timeout, retry, 429 처리, 오류 파싱, 로그를 포함한 NAVER 공통 client

## 프로젝트 구조

```text
src/                         Vue 3 UI
  components/                순위, 점수, 그래프, 뉴스 등 UI 컴포넌트
  pages/                     홈, 이슈 상세
functions/api/               기존 Pages Functions 호환 코드
worker/index.ts              API 라우터 + Static Assets 진입점
worker/collector.ts          10분 주기 Cron Worker 진입점
server/
  naver/client.ts            NAVER API HUB 공통 client
  providers/                 Candidate / Trend / News provider
  pipeline/                  정규화, 점수 계산, 수집 오케스트레이션
shared/                      공통 타입, 설정, mock 데이터
supabase/migrations/         PostgreSQL migration
wrangler.collector.toml      Cron Worker 설정
```

## 로컬 실행

요구 사항: Node.js 20 이상

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev`는 Vite UI 개발 서버입니다. Worker API 요청이 실패하면 mock 데이터로 대체하지 않고 오류 상태를 표시합니다.

Worker API까지 함께 확인하려면:

```bash
npm run build
cp .env.example .dev.vars
npm run dev:worker
```

타입과 빌드 검증:

```bash
npm run typecheck
npm run build
```

## 환경변수

| 이름 | 사용 위치 | 설명 |
| --- | --- | --- |
| `NAVER_CLIENT_ID` | Worker secret | NAVER API HUB Client ID |
| `NAVER_CLIENT_SECRET` | Worker secret | NAVER API HUB Client Secret |
| `SUPABASE_URL` | Worker secret | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 선택 | 현재 MVP 프론트에서는 사용하지 않음 |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker secret | 서버 전용 DB 접근 키 |
| `DATA_MODE` | Worker variable | `mock` 또는 `real` |

`VITE_` 접두사가 붙은 Secret을 만들지 마세요. Vite의 `VITE_*` 값은 브라우저 번들에 포함됩니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/migrations/001_initial_schema.sql`을 실행합니다.
3. Project Settings → API에서 Project URL과 Service Role Key를 확인합니다.
4. Cloudflare API Worker와 Collector Worker에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 Secret으로 등록합니다.

Migration은 다음 테이블을 만듭니다.

- `keywords`: 키워드, 카테고리, 감지 시각, 현재 상태, 이유
- `keyword_snapshots`: 시점별 트렌드·뉴스·이슈지수·순위
- `news_articles`: 관련 뉴스. URL unique로 중복 차단
- `issue_events`: 이슈의 주요 이벤트 확장용

조회용 RLS policy는 공개 SELECT만 허용합니다. 쓰기는 Service Role을 사용하는 서버 수집기만 수행합니다.

## NAVER API HUB 설정

NAVER Cloud Platform의 NAVER API HUB Application에 다음 API를 추가합니다.

- Data Lab Search Trend API
- NAVER Search News API

이 프로젝트는 API HUB 전용 헤더만 사용합니다.

```text
X-NCP-APIGW-API-KEY-ID
X-NCP-APIGW-API-KEY
```

구형 `X-Naver-Client-Id`, `X-Naver-Client-Secret` 헤더는 사용하지 않습니다.

Search Trend는 후보 키워드를 생성하지 않습니다. Collector는 수사·실적·컴백·우승·신작 게임·인공지능 등 순환 검색어의 뉴스 결과를 최신순으로 수집하고 URL과 정제 제목을 기준으로 중복을 제거합니다. 정제된 제목에서 여러 기사에 반복되는 2~4단어 phrase를 추출하고 뉴스 빈도·최신성·언론사 다양성으로 25개를 선정합니다. Search Trend는 후보를 최대 5개 그룹씩 묶어 최근 2일과 이전 5일의 상대적 관심도 상승을 검증합니다.

## mock / real 모드

### mock

```text
DATA_MODE=mock
```

손흥민, 아이폰18, TFT, 비트코인, 삼성전자, 프로야구 등의 샘플 이슈와 최근 24시간 그래프가 표시됩니다. Cron Worker는 외부 API와 DB 쓰기를 건너뜁니다.

### real

```text
DATA_MODE=real
```

NAVER와 Supabase Secret이 모두 필요합니다. 정상 실행에서는 뉴스 제목에서 후보를 자동 생성합니다. 실제 모드에서는 고정 후보 fallback을 사용하지 않습니다. 뉴스 수집 실패 시 오류를 기록하며 기존 저장 결과를 유지합니다.

## Cloudflare 배포

### 1. API + Static Assets Worker

Cloudflare Dashboard에서 Git 저장소를 Workers Builds에 연결합니다.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Environment variables: `DATA_MODE`, `SUPABASE_URL`
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`

`wrangler.jsonc`의 기본 Production `DATA_MODE`는 `real`입니다. 로컬 mock 실행은 `.dev.vars`에서 `DATA_MODE=mock`으로 재정의합니다. Vite의 `import.meta.env`나 `VITE_DATA_MODE`는 서버 모드 결정에 사용하지 않습니다.

CLI를 사용한다면:

```bash
npx wrangler login
npm run deploy
```

`worker/index.ts`가 `/api/*`를 처리하며, 나머지 경로는 `env.ASSETS.fetch(request)`로 Vue 앱에 전달됩니다.

### 2. Cron Collector Worker

```bash
npx wrangler secret put NAVER_CLIENT_ID --config wrangler.collector.toml
npx wrangler secret put NAVER_CLIENT_SECRET --config wrangler.collector.toml
npx wrangler secret put SUPABASE_URL --config wrangler.collector.toml
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.collector.toml
```

`wrangler.collector.toml`의 `DATA_MODE`를 `real`로 변경한 뒤 배포합니다.

```bash
npm run deploy:collector
```

Cron은 `*/10 * * * *`로 설정되어 10분마다 실행됩니다. 로컬에서는 `npm run cron:local` 후 `/__scheduled` 테스트 경로를 사용할 수 있습니다.

## API

- `GET /api/trends?category=전체&limit=20`
- `GET /api/issues?category=전체&limit=20`
- `GET /api/issues/:slug`
- `GET /api/issues/:slug/history`
- `GET /api/issues/:slug/news`
- `GET /api/search?q=손흥민`

## Issue Score

가중치는 `shared/score-config.ts`에서 관리합니다.

- 검색 트렌드 상승 35
- 뉴스 출현 빈도 25
- 뉴스 최신성 20
- 언론사 다양성 10
- 검색 관심도 수준 10

각 신호는 0~100 범위로 정규화한 뒤 합산합니다. 원래 검색량이 큰 상시 키워드보다 최근 상승 변화량에 더 큰 가중치를 둡니다. 뉴스 seed 6회 + 상위 후보 보강 최대 2회, DataLab 최대 5회, Supabase 최대 6회(일일 정리 시 2회 추가)입니다. 정상 경로는 최대 19회, 정리 시 21회이며 재시도를 포함해 45회를 넘기지 않도록 제한합니다. 10분 주기이면 DataLab은 하루 약 720회를 사용합니다.

## 현재 MVP에서 규칙 기반인 부분

- 이슈 이유: 규칙 기반 문장. LLM 요약은 제외 범위
- 후보 phrase와 관련 키워드: 형태소 분석기 없이 반복 n-gram과 불용어 규칙으로 추출
- 고정 후보 목록: mock 개발용으로만 남겨두며 real 수집에서는 사용하지 않음
- `DATA_MODE=mock`: API 키 없이 UI를 확인하기 위한 샘플 데이터

운영 로그에서 후보 분포를 관찰한 뒤 불용어와 유사 후보 기준, 최소 이슈지수 임계값을 조정하는 것이 다음 단계입니다.


## 2026-09-18: 뉴스 확산·근거·타임라인 개선

추천 새 이름은 **이슈맥**(이슈의 맥락과 흐름)입니다. 기존 서비스명/도메인은 변경하지 않았습니다.
제품/쇼핑 관심도 기능은 추가하지 않았습니다.

### 적용 순서 (기존 프로젝트)

1. 최신 Git 소스를 pull하고 제공된 패치 ZIP을 프로젝트 루트에 덮어씁니다. 로컬 변경이 있다면 먼저 보존하십시오.
2. Supabase SQL Editor에서 **`supabase/migrations/20260918_issue_evidence.sql`만** 실행합니다. 초기 스키마나 과거 TFT 정리 SQL을 다시 실행하지 않습니다.
3. `npm install`, `npm test`, `npm run build` 실행.
4. `npx wrangler deploy --config wrangler.collector.toml`, `npx wrangler deploy` 실행. Git 연동 배포를 사용한다면 commit/push로 각각의 빌드를 실행해도 됩니다.
5. 다음 Cron 실행 후 `/api/trends`의 `mode`, `data[].evidence`, 상세의 `events` 확인.

새 migration은 nullable `keywords.evidence jsonb`와 뉴스 정리용 index만 추가합니다. 이전 버전으로 되돌려도 기존 컬럼은 유지할 수 있습니다.
Secret은 기존 Worker env 설정을 그대로 사용합니다. 블로그·카페 결과를 가져오지 못하면 관련 글 영역에 부분 실패 상태를 표시하며 뉴스/순위에는 영향을 주지 않습니다.

### 탐지와 설명

- 뉴스 조기 감지: 점수 25 이상, 최소 기사 3건/출처 도메인 2곳. 최근 1시간 3건 이상이고 직전 1시간 대비 1.5배 이상이면 검색 상승이 없어도 선정합니다.
- 검색 검증: 같은 뉴스 품질 기준을 통과하고 DataLab growthScore >= 5이면 선정 가능합니다.
- DataLab은 일간 지표입니다. KST 전일까지 최근 2일/이전 5일을 비교하며 해당 날짜가 누락되면 unavailable로 취급합니다. 현재 10분의 검색량으로 표시하지 않습니다.
- levelScore는 같은 키워드의 최근 7일 최고치 대비 최근 평균입니다. 서로 다른 batch의 원시 ratio를 순위에 직접 비교하지 않습니다.
- Issue Score 가중치는 기존 35/25/20/10/10을 유지합니다. unavailable 검색은 점수 기여가 0이지만 UI에는 실제 0과 구분해 표시합니다.
- 설명은 수집 표본의 최근/직전 1시간 기사 수, 출처 도메인 수, 검색 확인 상태와 대표 기사 링크·시각으로 구성합니다. 전체 보도량, 실제 검색량 또는 여론 수치가 아닙니다.

### 발견 방식

6개 검색어를 10분 단위로 각 그룹에서 순환 선택합니다.

| 그룹 힌트 | 순환 검색어 |
|---|---|
| 사회 | 수사 / 사고 / 판결 |
| 경제 | 실적 / 금리 / 투자 |
| 연예 | 컴백 / 공연 / 출연 |
| 스포츠 | 우승 / 이적 / 결승 |
| 게임 | 신작 게임 / e스포츠 / 게임 업데이트 |
| IT | 인공지능 / 반도체 / 보안 |

검색 seed는 공식 카테고리 피드가 아닙니다. 제목 내 의미 단서로 카테고리를 우선 분류하고 근거가 없을 때 seed 힌트를 사용합니다. 형태소 분석기가 아니므로 고유명사·복합 사건의 정확성에는 한계가 있습니다.
24시간 이내 기사만 사용하고 URL/제목 dedupe 후 반복 2~4단어 phrase를 추출합니다. 짧은 조사를 무조건 제거하지 않아 이름 훼손을 줄였습니다. 유사 phrase는 단어 유사도와 기사 집합의 80% 이상 포함 관계를 함께 확인하고 기사 근거를 합칩니다. 독립 사건이 완벽히 구분되는 것은 아니며 운영 표본을 보며 개선해야 합니다.
상위 2개 후보에 추가 뉴스 검색을 실행해 근거를 보강합니다. 정상 요청은 뉴스 최대 8회, DataLab 5회입니다. DataLab 25개 후보·10분 주기 기준 재시도 제외 720회/일, 30일 21,600회입니다. 실제 계정 한도/비용은 API HUB 콘솔을 확인하십시오.

### 화면과 API

- 기존 API envelope와 광고 슬롯을 유지하고 `evidence`, `events` 필드만 추가.
- 목록에 뉴스 확산/일간 검색 상승 라벨.
- 상세에 대표 기사와 근거, 최초 감지/급상승 전환/출처 확산 타임라인. 이벤트는 배포 후부터 쌓이며 과거를 추정해서 채우지 않습니다.
- 메인 목록은 가장 최근 snapshot 시각과 일치하는 키워드를 표시합니다. 성공 결과가 없으면 빈 목록, 수집 장애 시 이전 결과와 실제 마지막 업데이트 시각을 유지합니다.
- `GET /api/issues/:slug/posts`: 블로그·카페 각 5개 관련 링크. 사용자가 상세의 버튼을 눌렀을 때만 조회하고 Cloudflare Cache API로 10분 캐시합니다. 부분 오류는 1분 캐시. 캐시는 지역별이며 전역 요청 한도를 보장하지 않습니다.
- 게시물 시각을 임의 생성하지 않고 감정 분석/시간대별 반응 지표로 사용하지 않습니다. 원문은 수집하지 않습니다.

### 검증 범위

`npm test`는 실제 외부 API 대신 메모리 응답을 주입하는 회귀/Collector 통합 테스트입니다. 뉴스 조기 감지, 단일 출처 탈락, DataLab 누락, 이름 보존, slug, 실제 저장 payload, 관련 링크 안전성, 최신 배치 조회를 확인합니다.
실제 NAVER·Supabase 호출, 운영 배포 및 브라우저 광고 노출은 별도 운영 확인이 필요합니다. Supabase 저장은 기존 bulk upsert/insert 방식으로 테이블 간 원자적 transaction은 아닙니다.

공식 문서:
- https://api.ncloud-docs.com/docs/naver-api-hub-search-trend
- https://api.ncloud-docs.com/docs/naver-api-hub-search-blog
- https://api.ncloud-docs.com/docs/naver-api-hub-search-cafearticle
- https://guide.ncloud-docs.com/docs/apihub-overview

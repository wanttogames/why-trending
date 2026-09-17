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

Search Trend는 후보 키워드를 생성하지 않습니다. Collector는 사회·경제·연예·스포츠·게임·IT 뉴스 검색 결과를 최신순으로 수집하고 URL과 정제 제목을 기준으로 중복을 제거합니다. 정제된 제목에서 여러 기사에 반복되는 2~4단어 phrase를 추출하고 뉴스 빈도·최신성·언론사 다양성으로 25개를 선정합니다. Search Trend는 후보를 최대 5개 그룹씩 묶어 최근 2일과 이전 5일의 상대적 관심도 상승을 검증합니다.

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

NAVER와 Supabase Secret이 모두 필요합니다. 정상 실행에서는 뉴스 제목에서 후보를 자동 생성합니다. 뉴스 후보가 5개 미만인 비정상 상황에서만 `MockCandidateProvider`의 고정 목록을 fallback으로 사용합니다.

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

각 신호는 0~100 범위로 정규화한 뒤 합산합니다. 원래 검색량이 큰 상시 키워드보다 최근 상승 변화량에 더 큰 가중치를 둡니다. 뉴스 6회와 DataLab 5회, Supabase bulk 4회로 일반 실행의 외부 subrequest는 약 15회입니다. 10분 주기이면 DataLab은 하루 약 720회를 사용합니다.

## 현재 MVP에서 규칙 기반인 부분

- 이슈 이유: 규칙 기반 문장. LLM 요약은 제외 범위
- 후보 phrase와 관련 키워드: 형태소 분석기 없이 반복 n-gram과 불용어 규칙으로 추출
- 고정 후보 목록: 뉴스 후보가 5개 미만일 때만 fallback
- `DATA_MODE=mock`: API 키 없이 UI를 확인하기 위한 샘플 데이터

운영 로그에서 후보 분포를 관찰한 뒤 불용어와 유사 후보 기준, 최소 이슈지수 임계값을 조정하는 것이 다음 단계입니다.

# 왜떠?

대한민국에서 갑자기 관심이 증가하는 키워드를 찾고, 단순 순위뿐 아니라 **왜 뜨는지**를 함께 보여주는 실시간 이슈 탐지 서비스 MVP입니다.

> 이슈지수는 여러 공개 데이터의 증가 속도를 기반으로 계산한 자체 지표입니다. 실제 검색량이나 네이버 실시간 검색 순위가 아닙니다.

## 아키텍처

```text
Cloudflare Cron Worker (10분)
  ├─ CandidateProvider (MVP: MockCandidateProvider)
  ├─ NaverSearchTrendProvider (후보 관심도 검증)
  ├─ NaverNewsProvider (뉴스 증가량·최신성·언론사 확산)
  ├─ Issue Score / 순위 / 상태 계산
  └─ Supabase PostgreSQL 저장

Vue 3 Frontend
  └─ Cloudflare Pages Functions /api/*
       └─ Supabase REST (Service Role은 서버에서만 사용)
```

Cloudflare Pages는 프론트엔드와 조회 API를 제공하고, 별도 Worker가 Cron Trigger로 수집을 실행합니다. 브라우저는 NAVER 및 Supabase Service Role에 직접 접근하지 않습니다.

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
functions/api/               Cloudflare Pages Functions 조회 API
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

`npm run dev`는 Vite UI 개발 서버입니다. Pages Function에 연결되지 않으면 프론트엔드가 자동으로 mock 데이터로 폴백합니다.

Pages Functions까지 함께 확인하려면:

```bash
npm run build
cp .env.example .dev.vars
npm run dev:pages
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
| `SUPABASE_URL` | Pages/Worker secret | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 선택 | 현재 MVP 프론트에서는 사용하지 않음 |
| `SUPABASE_SERVICE_ROLE_KEY` | Pages/Worker secret | 서버 전용 DB 접근 키 |
| `DATA_MODE` | Pages/Worker variable | `mock` 또는 `real` |

`VITE_` 접두사가 붙은 Secret을 만들지 마세요. Vite의 `VITE_*` 값은 브라우저 번들에 포함됩니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/migrations/001_initial_schema.sql`을 실행합니다.
3. Project Settings → API에서 Project URL과 Service Role Key를 확인합니다.
4. Cloudflare Pages와 Collector Worker에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 Secret으로 등록합니다.

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

Search Trend는 후보 키워드를 생성하지 않습니다. `CandidateProvider`가 만든 후보를 최대 5개 그룹씩 묶어 상대적 관심도 상승을 검증합니다. 그룹 내부는 향후 동의어를 최대 20개까지 넣을 수 있습니다. News API는 후보별 최신 기사 100개를 받아 URL 중복을 제거하고 최근 구간 증가량, 최신 기사 시각, 언론사 수를 계산합니다.

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

NAVER와 Supabase Secret이 모두 필요합니다. 현재 후보 생성은 `MockCandidateProvider`의 고정 후보를 사용하고, 그 후보에 대한 실제 Search Trend/News 신호를 수집합니다.

## Cloudflare 배포

### 1. Pages

Cloudflare Dashboard에서 Git 저장소를 Pages에 연결합니다.

- Framework preset: `Vue`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: `DATA_MODE`, `SUPABASE_URL`
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`

CLI를 사용한다면:

```bash
npx wrangler login
npm run deploy:pages
```

Pages Functions는 `functions/` 폴더에서 자동 배포됩니다.

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

- `GET /api/issues?category=전체&limit=20`
- `GET /api/issues/:slug`
- `GET /api/issues/:slug/history`
- `GET /api/issues/:slug/news`
- `GET /api/search?q=손흥민`

## Issue Score

가중치는 `shared/score-config.ts`에서 관리합니다.

- 검색 트렌드 상승 40
- 뉴스 언급 증가 30
- 뉴스 발생 속도 15
- 언론사 확산 10
- 지속성 5

각 신호는 0~1 범위로 정규화한 뒤 합산하여 0~100 점수로 만듭니다. 운영 데이터가 쌓이면 분포 기반 정규화와 카테고리별 보정을 추가하는 것이 좋습니다.

## 현재 MVP에서 mock인 부분

- 후보 키워드 생성: `MockCandidateProvider`의 고정 목록
- 이슈 이유: 규칙 기반 문장. LLM 요약은 제외 범위
- 로컬 Vite 단독 실행 시 API 실패 폴백 데이터
- 관련 키워드 자동 추출

다음 단계는 NAVER 뉴스 제목의 명사/개체명 빈도와 기존 키워드 제외 목록을 이용하는 `NewsTitleCandidateProvider`를 추가하는 것입니다. 그 다음 실제 수집 결과의 분포를 관찰해 이슈지수 정규화와 상태 임계값을 조정하는 순서가 적절합니다.

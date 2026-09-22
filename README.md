# TrendPick — 관심도·비교·쇼핑 트렌드

Vue 3 + Vite + TypeScript / Cloudflare Workers + Static Assets / Supabase PostgreSQL.
기존 왜떠의 뉴스 의미 추론을 제거하고, NAVER가 제공하는 검색 상대 관심도와 쇼핑 검색 클릭 추이를 비교·탐색합니다. AI/LLM, 사건명 생성, 절대 검색량·판매량 추정은 사용하지 않습니다.

서비스명: `shared/config.ts`의 `BRAND`에서 변경합니다. 기존 배포 대상 이름 `why-trending`, `waetteo-collector`는 그대로 유지했습니다.

## 기존 프로젝트에 적용

이 ZIP은 새 서비스의 **전체 소스**입니다. 옛 src/server/functions 파일이 남아 충돌하지 않도록 적용 스크립트를 제공합니다.

1. 기존 저장소에서 `git status`를 확인하고 로컬 변경을 먼저 커밋/보존합니다. 작업 트리가 깨끗하면 `git pull --ff-only origin main`.
2. ZIP을 **기존 프로젝트 외부**에 압축 해제합니다.
3. PowerShell에서 다음 실행(경로는 실제 다운로드 위치에 맞게 변경):

```powershell
& "C:\Downloads\trendpick\Apply-TrendPick.ps1" -ProjectPath "C:\work\why-trending"
cd C:\work\why-trending
```

스크립트는 기존 소스와 변경 대상 파일을 프로젝트 옆 `why-trending-backup-날짜`에 백업합니다. `.git`, 기존 Secret 파일, 기존 Supabase migration은 유지합니다. Git 원격 push나 배포는 수행하지 않습니다. 복원하려면 백업 파일을 되돌리거나 기존 Git 커밋을 사용합니다. 신규 DB 테이블은 옛 코드와 독립적이므로 롤백을 위해 삭제할 필요가 없습니다.

## Supabase 설정 / 실행할 SQL

Supabase SQL Editor에서 **아래 두 파일만 순서대로** 실행합니다.

1. `supabase/migrations/20260921_trendpick.sql`
2. `supabase/seeds/keywords.sql`

기존 `001_initial_schema.sql` 또는 과거 TFT 정리 migration을 다시 실행하지 마세요. 기존 keywords/news/issue_events 테이블은 삭제하지 않습니다.

새 테이블:

| 테이블 | 용도 |
|---|---|
| trend_keywords | 관리 후보 500개, alias 최대 5개, 카테고리, 활성 여부 |
| shopping_categories | UI 카테고리 → NAVER 공식 쇼핑 분야 코드 |
| trend_snapshots | 키워드/검색 또는 쇼핑별 최신 시계열, 수집 시각 |
| trend_rankings | 기간별 자체 계산 결과/상승 정렬 |
| search_content_cache | VS·키워드·콘텐츠·작업 캐시, 갱신 잠금 |
| popular_comparisons | 비교·공유 활동 집계; 시간대 중복 제거 |
| api_usage | 서비스별 월 API 시도 횟수 |
| api_rate_window | 프로젝트 공통 초당 요청 제한 |

쇼핑 키워드는 별도 중복 테이블 대신 `trend_keywords.shopping_category` FK로 관리하고, 쇼핑 시계열은 `trend_snapshots.source='shopping'`으로 구분합니다. 캐시·시계열 등은 RLS를 켜고 anon/authenticated 접근을 차단합니다. 서버 Service Role만 읽고 씁니다.

`tp_save` RPC는 여러 snapshot/ranking을 **한 transaction**으로 저장합니다. 일부 constraint 오류 시 함께 롤백됩니다. `tp_claim_cache`/`tp_finish_cache`는 owner 토큰이 있는 갱신 잠금입니다. 동시 요청 중 한 요청만 공급자 API를 호출합니다.

### 키워드 관리

- `supabase/seeds/keywords.json`: 10개 카테고리 × 50개 = 500개, 이 중 쇼핑 190개.
- seed는 관심도가 높다는 주장이 아니라 운영자가 선택한 분석 대상입니다.
- 직접 DB에서 `enabled=false`로 제외할 수 있습니다. seed 재적용은 이미 비활성화한 항목을 켜지 않습니다.
- JSON 수정 후 `npm run seed:sql`로 SQL 재생성. 실행 전 `npm run budget`로 호출 예산 확인.
- alias는 같은 대상의 표기 변형만 넣습니다. 서로 다른 상품·인물을 한 그룹으로 묶지 마세요.
- 1,000개로 늘릴 때 Collector의 `COLLECTOR_CYCLE_HOURS="6"`로 변경하고 실제 enabled 수/카테고리 분포에 따라 예산을 재계산합니다.

쇼핑의 디지털/가전은 NAVER 디지털/가전 `50000003`, 생활/반려동물은 생활/건강 `50000008` 안의 관리 키워드로 구분합니다. UI 분류 ID를 API category로 보내지 않습니다. 공식 코드 매핑은 `shared/config.ts`와 SQL `shopping_categories`에 있습니다. 최신 NAVER 분류가 바뀌면 양쪽을 함께 갱신하고 해당 키워드가 속한 실제 분야를 확인하세요.

## 로컬 실행

Node.js 22 이상 권장.

```powershell
npm install
npm test
npm run build
npm run dev
```

`npm run dev`는 **preview 환경**의 Wrangler를 시작합니다. 기본 DATA_MODE=mock, 광고 꺼짐. `http://localhost:8787`에서 Worker API와 정적 파일을 함께 봅니다. 소스 수정 후 다시 `npm run build`합니다. `npm run dev:ui`는 Vite UI 개발용으로, 별도 Worker API 연결 없이 real API를 제공하지 않습니다.

real 모드 로컬 확인은 `.env.example`을 `.dev.vars`로 복사하고 값 설정 후:

```powershell
npm run build
npx wrangler dev --env=""
```

`.env`의 `VITE_*` 변수로 Secret을 전달하지 않습니다. `.dev.vars`와 실제 Secret은 Git에 포함하지 않습니다.

### 환경변수 / Secret

| 이름 | 설정 위치 | 설명 |
|---|---|---|
| NAVER_CLIENT_ID | 양쪽 Worker Secret | API HUB Key ID |
| NAVER_CLIENT_SECRET | 양쪽 Worker Secret | API HUB Key |
| SUPABASE_URL | 양쪽 Worker Secret/변수 | 프로젝트 URL |
| SUPABASE_SERVICE_ROLE_KEY | 양쪽 Worker Secret | 서버 전용 DB 접근 |
| DATA_MODE | 양쪽 Worker vars | mock / real. real 오류를 mock으로 전환하지 않음 |
| SITE_URL | 메인 Worker vars | 실제 공개 HTTPS origin; 없으면 요청 origin |
| ADS_ENABLED | 메인 Worker vars | 기본 false. 검토 후 true |
| COLLECTOR_CYCLE_HOURS | Collector vars | 3 또는 6 |
| COLLECTOR_TOKEN | Collector Secret, 선택 | 수동 POST /collect 인증 |

NAVER HUB 인증: `X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`만 사용합니다. `SUPABASE_ANON_KEY`는 필요하지 않습니다.

## Cloudflare 배포

Supabase SQL 적용 → Secret 설정 → Collector → 메인 순서입니다.

```powershell
npx wrangler secret put NAVER_CLIENT_ID --env=""
npx wrangler secret put NAVER_CLIENT_SECRET --env=""
npx wrangler secret put SUPABASE_URL --env=""
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env=""

npx wrangler secret put NAVER_CLIENT_ID --config wrangler.collector.toml --env=""
npx wrangler secret put NAVER_CLIENT_SECRET --config wrangler.collector.toml --env=""
npx wrangler secret put SUPABASE_URL --config wrangler.collector.toml --env=""
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.collector.toml --env=""

npm run build
npx wrangler deploy --config wrangler.collector.toml --env=""
npx wrangler deploy --env=""
```

기존 Worker에 같은 이름의 Secret이 있다면 다시 입력할 필요 없습니다. Preview Secret/vars는 production과 별개이며 preview 기본은 mock입니다. Cloudflare Git 연동을 이용한다면 메인 Build `npm run build`, Deploy `npx wrangler deploy --env=""`; Collector Deploy `npx wrangler deploy --config wrangler.collector.toml --env=""`. root directory는 package.json이 있는 경로입니다.

`assets.run_worker_first=true`로 API와 서버 HTML metadata를 Worker가 우선 처리합니다. `_redirects`는 사용하지 않습니다. 신규 service가 기본 `/`에 나오며 옛 `/issue/:slug`는 `/trending`으로 이동합니다. 옛 이슈 API는 404 JSON입니다.

### Cron / 첫 데이터

실제 Cron은 `*/5 * * * *`입니다. **모든 키워드를 5분마다 수집하는 뜻이 아닙니다.**

- 검색/쇼핑 작업을 번갈아 실행.
- 각각 18개 조각으로 나누어 3시간에 한 번 전체 후보를 순환.
- 6시간 설정이면 각각 36개 조각.
- 매시 한 번 검색 랭킹 상위 1개 키워드의 뉴스/블로그/카페를 보강.
- 매일 UTC 자정 무렵 오래된 캐시/집계를 정리.
- 같은 예정 작업 재실행은 DB 작업 캐시로 중복 방지.
- 첫 배포 직후 일부만 표시되고 **최초 전체 순환 완료까지 최대 3시간** 걸립니다.

```powershell
npx wrangler tail waetteo-collector
curl.exe https://why-trending.wanttogames.workers.dev/api/trends
```

수동 `/collect`는 `COLLECTOR_TOKEN`을 설정한 경우에만 Bearer 인증으로 실행합니다. 현재 시간에 해당하는 조각만 처리하며, 전체 후보를 강제로 한 번에 수집하지 않습니다. 토큰을 URL에 넣지 마세요.

## 예산과 캐시

요청한 한도 기준: 검색 775,000 / 검색 트렌드 50,000 / 쇼핑 50,000회/월. 실제 API HUB 계정의 한도·과금은 콘솔을 확인합니다.

| 항목 | 기본 seed, 31일, 재시도 제외 |
|---|---:|
| 검색 트렌드 500개, 3시간 순환 | 26,784회 |
| 쇼핑 190개, 카테고리별 batch | 32,736회 |
| 상위 1개 관련 콘텐츠, 매시간 3종 | 최대 2,232회 |

키워드 분할 경계와 카테고리 분리 때문에 단순 500/5 계산보다 호출량이 조금 더 큽니다. `npm run budget`은 seed 순서 기준 계산이며 기존 DB identity 값/비활성 후보에 따라 약간 달라질 수 있습니다.

- DB `tp_permit`로 **실제 fetch 시도마다** 예약. 재시도도 포함.
- 검색 트렌드/쇼핑 각각 **35,000회(70%)**, 검색 **500,000회(약 64.5%)**에서 차단.
- 같은 Supabase를 쓰는 두 Worker 합산 초당 최대 40회로 제한. 같은 NAVER 키를 외부 서비스에서도 쓰면 그 서비스 호출은 이 DB가 세지 못하므로 콘솔로 확인해야 합니다.
- VS/일반 키워드 캐시 1시간, 쇼핑 2시간, 콘텐츠 30분(Collector 예열 1시간).
- Cloudflare 지역 캐시 + Supabase 공통 캐시. 다른 지역의 동시 miss도 DB 갱신 잠금으로 제한.
- 첫 조회가 진행 중이면 잠깐 재시도를 안내; 이전 payload가 있으면 stale 데이터와 안내 표시.
- 429/5xx는 최대 1회 재시도. 긴 Retry-After는 이번 실행을 중단하고 다음 수집에 맡김.
- Collector 외부 fetch는 최대 45회에서 중단. 저장 여유를 남기기 위해 추가 batch 시작도 제한.
- 인기 비교 집계는 동일 조합/이벤트의 시간대별 중복을 줄인 활동 지표입니다. 실제 사람 수가 아닙니다.

```sql
select month, service, calls from public.api_usage order by month desc,service;
select source, period, count(*), min(recorded_at), max(recorded_at)
from public.trend_rankings group by source,period order by source,period;
select count(*) from public.trend_keywords where enabled;
```

## 페이지와 API

페이지: `/`, `/trending`, `/vs`, `/vs/:keywordA/:keywordB`, `/shopping`, `/shopping/:keyword`, `/search/:keyword`, `/about`, `/methodology`, `/privacy`, `/terms`.

URL 토큰은 정규화된 검색어 UTF-8의 가역 hex(`k-...`)로 한글 제거/slug 충돌을 피합니다. 영문 raw 입력 URL도 서버가 안전한 canonical URL로 보냅니다. A/B 순서가 바뀌면 동일 비교 캐시와 URL을 사용합니다. 관리 alias가 같은 대상을 가리키면 비교를 거절합니다.

| API | 내용 |
|---|---|
| GET /api/config | 브랜드/모드/광고 여부; Secret 없음 |
| GET /api/trends?period=7d&category=IT | 검색 상승 랭킹 |
| GET /api/shopping?period=7d&category=appliances | 쇼핑 상승 랭킹 |
| GET /api/vs?a=chatgpt&b=gemini&period=7d | 같은 요청에서 두 대상 비교 |
| GET /api/keyword?q=러닝화&period=30d&shopping=1 | 단일 검색/쇼핑 시계열 |
| GET /api/content?q=chatgpt | 관련 콘텐츠; 버튼 클릭 시 조회 |
| GET /api/popular | 집계된 비교 또는 명시된 추천 예시 |
| POST /api/events | 허용된 분석 이벤트 |

쇼핑 필터: `device=pc|mo`, `gender=m|f`, `age=10|20|30|40|50|60`. 각 조건의 상대 클릭 추이이며 서로 다른 요청을 합쳐 연령/성별 점유율을 만들지 않습니다.

검색 API는 원문 탐색에만 사용합니다. 카페에는 API가 제공하지 않는 게시 시각을 만들지 않습니다. API에 없는 연관 검색어를 생성하지 않으며, 관련 VS는 관리된 비교 예시만 사용합니다.

## 계산식과 데이터 주의사항

- KST 전일까지 일간 데이터 요청. 누락은 null, 실제 0과 구분.
- 랭킹의 ‘오늘’은 각 키워드 최신 관측 일간 데이터와 직전 일간 비교. `asOf`로 실제 기준일 표시.
- 상승률 = (최근 N일 평균 − 이전 N일 평균) / 이전 N일 평균 × 100.
- 이전 평균 0, 최근 평균 양수면 ‘신규 관심’. 양쪽 0 또는 누락은 62:38 같은 비율을 만들지 않음.
- 두 구간의 관측률 각각 80% 이상일 때 상승률 표시.
- 급상승 score = min(60, 양의 상승률 × 0.3) + min(25, 양의 (최근 최대 3일 평균 / max(이전 평균,0.01) − 1) × 25) + 이전 평균을 넘은 최근 관측일 비율 × 15. 0~100.
- 이전 평균 0인 신규 관심은 첫 기여도를 35로 제한. 원시 ratio 크기로 다른 batch를 비교하지 않음.
- VS = 같은 API 요청의 공통 날짜 평균 A/(A+B), B/(A+B). 실제 검색 횟수의 점유율이 아님.
- 두 alias 그룹의 의미가 실제로 겹치는지 완벽하게 판별하지 않습니다. 관리 alias 외에는 사용자가 입력한 검색어 그대로 비교합니다.

## 공유 / SEO / 광고

- Canvas PNG 저장, 링크 복사, 파일 공유 가능 시 Web Share. mock 공유 이미지는 가상 데이터 표시.
- Worker가 초기 HTML의 title/description/canonical/OG를 주입하므로 JS를 실행하지 않는 링크 미리보기도 읽을 수 있음.
- OG 이미지는 공통 A vs B 이미지. 수치가 들어가는 카드는 클라이언트 PNG입니다. 서버에서 동적 PNG 생성은 후속 기능.
- VS는 실제 7일 캐시 데이터/관측률이 충분할 때만 index 허용. 일반 키워드 상세는 보수적으로 noindex 유지. sitemap은 주요 고정 페이지만 포함.
- 기본 광고 OFF. real 데이터가 충분한 메인과 상세에서만 수동 슬롯 사용. 기존 publisher/slot 설정 재사용.
- Auto Ads 설정은 AdSense 대시보드 설정이며 코드에서 변경하지 않습니다. 활성화 전 빈 페이지 자동 광고 제외와 적용 지역 동의 요구를 확인하세요.
- 개인정보/약관 페이지 포함. 운영자 문의 링크는 기존 프로젝트 Issues이며 실제 운영 연락처로 바꿀 수 있습니다.

## 검증

```powershell
npm test
npm run typecheck
npm run build
npx wrangler deploy --dry-run --env=""
npx wrangler deploy --dry-run --config wrangler.collector.toml --env=""
```

`npm test`:
- 정규화/가역 slug/역순 비교 캐시
- zero/missing/상승률/62:38 계산
- Shopping Insight 요청 그룹 구조와 category 검사
- PGlite(테스트 전용 PostgreSQL)로 실제 SQL migration/seed/RLS 권한/잠금/예산/transaction 실행
- 실제 Collector 코드 + 가상 NAVER + 실제 SQL의 저장 및 중복 작업 방지
- Worker JSON API routing, input 검증, edge cache, 정적 자산 전달

실제 NAVER 키와 운영 Supabase 권한·데이터 응답, Cloudflare 운영 CPU 시간은 운영에서 추가 확인이 필요합니다. PGlite는 테스트 devDependency이며 Worker에 포함되지 않습니다. 이 전달본의 결과는 `docs/VALIDATION.md`에 기록했습니다.

## 제거된 기능 / 재사용한 기능

제거: 뉴스 n-gram, 사건 후보 추출·병합, 이슈지수/사건 상태, 이슈 타임라인, 왜 뜨는지 설명 생성, 기존 Pages Functions API.
재사용: Vue/Vite/TS, Worker + Static Assets, Supabase SDK, NAVER HUB 공통 인증/timeout/오류 파싱/backoff, 카운터, AdSense 컴포넌트/slot.

새 핵심 폴더: `shared`(브랜드/계산/타입/식별자), `server/trendpick`(공급자/캐시/서비스/수집), `worker`(HTTP/Cron), `src/pages`, `src/components`, `supabase`, `tests`.

## 후속 기능

운영 데이터에 따른 alias/카테고리 정비, 일반 키워드 index 허용 정책 확대, 서버 동적 OG PNG, 실제 성별/연령별 전용 endpoint 분석, 키워드 관리 UI, 봇 트래픽별 추가 요청 제한은 후속 범위입니다. 현재 집단 필터는 이미 구현되어 있지만 집단별 점유율 그래프는 만들지 않습니다. 회원가입·댓글·LLM·쇼핑 상품 가격/구매 링크는 구현하지 않습니다.

## 공식 참고

- https://api.ncloud-docs.com/docs/naver-api-hub-search-trend
- https://api.ncloud-docs.com/docs/naver-api-hub-shopping-insight-keywords
- https://api.ncloud-docs.com/docs/naver-api-hub-search-news
- https://api.ncloud-docs.com/docs/naver-api-hub-search-blog
- https://api.ncloud-docs.com/docs/naver-api-hub-search-cafearticle
- https://guide.ncloud-docs.com/docs/apihub-overview

API HUB 상세 명세에는 검색 그룹당 20개가 기재되어 있지만 이 프로젝트는 요청한 보수적 제한인 **5그룹 × alias 최대 5개**로 제한합니다. 쇼핑 그룹의 param은 명세대로 **검색어 1개**입니다.

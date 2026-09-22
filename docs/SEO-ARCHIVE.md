# 영구 이슈 아카이브 — 적용 안내

이 패치는 이전에 제공한 TrendPick 프로젝트 코드와 migration 및 사용자가 공유한 실제 테이블 목록을 기준으로 작성했습니다. 운영 DB/원격 Git 최신 소스에는 직접 접속하지 않았습니다. 로컬에서 별도 수정한 같은 파일이 있다면 diff를 확인한 뒤 병합하세요.

## 적용 순서

1. 기존 프로젝트를 Git 커밋 또는 별도 복사로 백업합니다.
2. 이 패치 ZIP 안의 `worker`, `server`, `shared`, `src`, `public`, `tests`, `supabase`, `docs` 내용을 기존 `C:\work\why-trending`에 병합 복사합니다. 폴더 전체를 삭제하거나 이전 `Apply-TrendPick.ps1`을 다시 실행하지 않습니다. ZIP의 README-SEO-APPLY.md도 참고하세요.
3. Supabase SQL Editor에서 **`supabase/migrations/20260923_issue_archive.sql` 전체**를 실행합니다. 기존 `20260921_trendpick.sql` 적용 상태가 전제입니다. 옛 SQL/seed를 다시 실행하지 마세요.
4. SQL에는 RLS 활성화 및 anon/authenticated 권한 차단이 포함되어 있습니다. 삭제 함수 정의도 있지만 migration 중 원본 데이터 삭제는 하지 않습니다. 현재 수집 결과/기존 왜떠 요약을 아카이브에 먼저 복사합니다.
5. 아래 검증 후 메인과 Collector를 모두 배포합니다.

```powershell
cd C:\work\why-trending
npm install
npm test
npm run build
npx wrangler deploy --config wrangler.collector.toml --env=""
npx wrangler deploy --env=""
```

Git 자동 배포를 이용한다면 위 직접 deploy 대신 검증 완료 후 변경사항을 commit/push하세요. 운영 Worker 이름은 기존 설정 그대로입니다. 이 패치는 wrangler 설정과 Secret을 변경하지 않습니다.

## 실제 구조와 변경 범위

- `trend_snapshots`: 이미 키워드/소스당 최신 시계열 하나를 upsert하는 구조. 새 snapshot history 테이블을 만들지 않습니다.
- `trend_rankings`: 기존 점수/기간별 랭킹 그대로.
- `keywords`, `keyword_snapshots`, `news_articles`, `issue_events`: 이전 왜떠 테이블. `issue_events`는 이벤트 행 단위이므로 영구 상세 페이지의 유일 키로 재사용하지 않습니다.
- 새 `issue_archive`: 키워드당 한 행, 원본/캐시/FK 수명과 독립. 제목/slug/요약/최초·마지막 감지/최고 기록/별칭 최대5/대표뉴스 최대5/카테고리/버전/생성·수정일을 저장합니다.
- 기존 왜떠 `issue_score`와 현재 7일 상승 점수는 직접 비교할 수 없어서 `score_model` 및 작은 `legacy_peak` 필드로 분리합니다. 재등장해 새 점수로 전환돼도 이전 최고 기록은 유지합니다.
- 기존 뉴스 기반 사건 탐지기는 다시 도입하지 않습니다. 관리 키워드의 **전체 카테고리 검색 7일 TOP20**을 관측할 때 아카이브에 반영합니다. 쇼핑/VS/다른 기간 화면과 API 계약은 그대로입니다.
- 이전 왜떠에서 snapshot이 남아 있는 키워드는 기존 slug/최초 감지/뉴스 최대5개를 migration 시 가져옵니다. snapshot이 없어 최고 기록을 알 수 없는 옛 키워드는 가짜 기록을 만들지 않습니다.

## URL / 중복 / 재등장

`/issues`, `/issue/:slug`, `GET /api/issues?page=1`, `GET /api/issues/:slug`를 추가합니다.

기존 키워드의 충돌 없는 UTF-8 hex slug를 그대로 사용합니다. 옛 slug와 충돌하면 정규화한 키워드 기반 MD5 suffix를 사용하고 추가 충돌도 DB 잠금 안에서 확인합니다. MD5는 인증이 아니라 식별용입니다. unique constraint를 유지합니다. 동일 키워드는 keyword_key로 upsert하며 slug/first_seen_at/created_at은 변경하지 않습니다.

archive에는 cascading FK가 없고 cleanup은 archive/issue_events를 삭제하지 않습니다. 현재 TOP에 없거나 수집 데이터가 7시간 이상 오래되면 ‘과거 이슈’로 표시하지만 페이지는 200으로 유지합니다. 알려지지 않은 slug는 HTML/API 모두 404입니다.

## 요약 원칙

SQL 템플릿으로 **관측일, 최근7일/직전7일 상대 관심도 상승률, 관측 당시 순위와 자체 점수**를 3문장으로 설명합니다. 첫 관측 요약은 영구 보관하며 재등장 시 새 데이터로 갱신합니다. 뉴스 제목을 이어 붙이지 않고, 뉴스로부터 사건의 원인이나 검색 증가의 인과관계를 추론하지 않습니다. AI/API 추가 호출은 없습니다.

대표 뉴스는 이미 수집된 `search_content_cache`의 뉴스 또는 legacy news에서 복사합니다. title/url/publisher/publishedAt만 저장하고 본문·description·원본 응답은 저장하지 않습니다. 없으면 뉴스가 없음을 알리고 현재 관심도 분석으로 연결합니다. 관련 키워드는 관리된 별칭이고, 관련 이슈는 같은 카테고리의 보관 기록이며 의미상 같은 사건이라는 주장을 하지 않습니다.

## 용량 / retention

| 데이터 | 보관 |
|---|---|
| issue_archive / issue_events | 영구, 자동 삭제 없음 |
| legacy news_articles | collected_at 기준 60일 |
| legacy keyword_snapshots | collected_at 기준 30일 |
| trend_snapshots / trend_rankings | 30일 이상 갱신되지 않은 행 삭제 |
| 최신 trend_snapshots 내부 | 최대180개 일별 집계점, 90일 대 이전90일 계산용 rolling aggregate |
| 검색·비교 cache | 기존 정책: 갱신 후2일 경과 및 잠금 해제 시 삭제 |
| api_usage | 기존13개월 |
| 인기 비교 통계 | 기존90일 미사용 |

뉴스 JSON은 DB에서 최대5개/16KB로 제한하며 제목240자, URL1500자, publisher120자까지만 보관합니다. 요약1600자, 별칭5개로 제한합니다. 페이지 수에 따른 소형 행 증가는 있으나 기사/시계열을 페이지마다 복제하지 않습니다. PostgreSQL 인덱스/MVCC 용량은 별도이며 실제 크기를 점검해야 합니다.

기존 Cron `*/5 * * * *` 유지. Collector에서 하루1회 UTC00:00(한국09:00) `tp_archive_cleanup()`을 실행합니다. 오래된 legacy 뉴스/스냅샷은 테이블당 최대5000행씩 삭제하여 잠금을 줄입니다. backlog는 여러 날에 걸쳐 처리됩니다. 해당 시간의 실행 실패 시 다음 일일 실행으로 이월됩니다. 함수 실패 로그를 확인하세요. 자동 VACUUM FULL은 실행하지 않습니다.

필요할 때 수동 정리(SQL Editor, 원본 retention 삭제가 실제 실행됨):
```sql
select public.tp_archive_cleanup();
```

## SEO / sitemap / 공유

신규 이슈 페이지는 Worker가 title/description/canonical/og:title/og:description/og:url/og:type/og:image와 **본문까지 완성한 HTML**로 응답합니다. JavaScript가 꺼져 있어도 읽을 수 있습니다. Vue 내부 이동에서는 동일 콘텐츠 렌더러를 사용합니다. 서버 아카이브 문서는 JS가 필요 없는 페이지이며 다른 기능 이동 시 일반 링크를 사용합니다. 빈 페이지 광고는 넣지 않습니다.

제목은 `{키워드} 관련 이슈와 뉴스 · 관심도 기록 | 브랜드`로 생성합니다. 과거 이슈를 현재 뜨는 것처럼 표현하지 않습니다. 기본 OG 이미지 `/og.png`를 재사용합니다. 동적 수치 이미지 생성은 이번 범위 밖입니다.

`/sitemap.xml` 및 `/sitemap-index.xml`은 sitemap index입니다. `/sitemap-static.xml`과 `/sitemap-issues-N.xml`(각500행)을 참조합니다. 과거 이슈도 필터 없이 포함하며 새로운 행이 생기면 자동 반영됩니다. Supabase 기본1000행 반환 제한에 걸리지 않도록500개씩 조회합니다. lastmod는 archive의 실제 수정일입니다. 동일 데이터 재처리만으로 변경하지 않습니다.

robots는 Allow /, Disallow /api/, 실제도메인의 sitemap을 출력합니다. API/HTML/XML은 Cloudflare Cache에서 최대5분 캐시하고 오류는 저장하지 않습니다. sitemap 반영에 최대5분 걸릴 수 있습니다. sitemap은 크롤링을 돕지만 검색 노출을 보장하지 않습니다.

## 환경변수 / 추가 설정

새 Secret은 없습니다. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `DATA_MODE=real`을 기존처럼 사용합니다.

메인 Worker `SITE_URL`을 **실제 대표 도메인의 origin**으로 설정하세요(예: `https://why-trending.wanttogames.workers.dev`, 경로 없이). 없으면 요청 origin으로 동작합니다. 이후 도메인 변경 시 갱신하세요.

Supabase에서 migration 적용 외 Cron/Extension 설정은 필요 없습니다. Cloudflare Cron도 기존 것을 유지합니다. 배포 후 Search Console 등에 `https://대표도메인/sitemap.xml`을 제출할 수 있습니다.

## 검증

- 실제 migration을 PGlite PostgreSQL에서 실행: 신규/재수집/한글slug충돌/legacy이관/cleanup/RLS.
- 뉴스 원본 삭제 후 대표 뉴스 유지, TOP에서 빠져도 archive 유지.
- Worker 테스트: 서버 본문/서로 다른 metadata/과거 이슈 sitemap/404/XML/XSS escaping.
- 기존 계산·SQL·Collector·Worker API 테스트 유지.
- NAVER fixture 통합: 검색28개 저장, shopping10개 저장, 전체subrequests17/19. 기존 대비Supabase1회 추가, NAVER 호출 변화 없음.
- TypeScript/Vite 빌드 및 두 Worker dry-run 확인.
- 운영 NAVER/Supabase/Cloudflare 접근·실제 배포·브라우저 UI 점검은 실행하지 않았습니다.

운영 확인(SQL Editor):
```sql
select count(*) from public.issue_archive;
select slug,title,peak_rank,last_seen_at from public.issue_archive order by last_seen_at desc limit 10;
select pg_size_pretty(pg_total_relation_size('public.issue_archive'));
```
확인한 slug로 `/issue/슬러그`, `/api/issues/슬러그`, `/sitemap.xml`, `/sitemap-issues-1.xml`을 확인하세요. HTML 원본에 요약과 metadata가 있어야 합니다.

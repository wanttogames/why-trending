# 검증 기록 — 2026-09-21

- npm install: 성공.
- npm test: 계산/정규화/provider 요청/SQL/Collector/Worker route 테스트 통과.
- npm run build: Vue TypeScript 검사 + Vite production build 성공.
- Main Worker / Collector Worker Wrangler dry-run: 번들 생성 성공. 운영 배포는 실행하지 않음.
- 실제 NAVER/Supabase/Cloudflare 계정에 접근한 검증은 아님.

Collector 통합 테스트(NAVER fixture, 실제 PostgreSQL 호환 SQL 실행):

| 작업 | 후보 | 저장 | NAVER 요청 | 전체 외부 요청 카운터 |
|---|---:|---:|---:|---:|
| 검색 조각 | 28 | 28 | 6 | 16 |
| 같은 작업 재실행 | 기존 결과 | 추가 저장 없음 | 0 | 1 |
| 쇼핑 조각 | 10 | 10 | 7 | 18 |

SQL 검증: 500개 seed 두 번 실행 후 500개 유지, 갱신 owner 잠금, 월 35,000 차단, 다른 API 서비스 예산 독립, 잘못된 FK 시 snapshot/ranking 동시 rollback, anon 읽기/RPC 차단.

브라우저 조작 검증은 미완료:
- 이 실행 환경에서 Wrangler local dev는 `uv_interface_addresses ... Unknown system error 1`로 시작 실패.
- Playwright Chromium 설치는 다운로드 timeout/502로 실패.
- 따라서 모바일 실제 렌더링, 공유 PNG 다운로드 UI, 운영 OG 크롤러 결과와 실제 광고 노출은 검증했다고 주장하지 않음.
- `docs/MANUAL-TEST.md`의 로컬 점검 절차를 제공.

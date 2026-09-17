why-trending cumulative update: slug, DB optimization, TFT ambiguity fix

프로젝트 루트에서 압축을 풀어 기존 파일을 덮어쓰세요.

TFT 수정
- 화면 keyword/category: TFT / 게임 유지
- NAVER Search Trend: 롤토체스 + 전략적 팀 전투
- NAVER News: 롤토체스
- 실제 NAVER 요청에 TFT 약어를 사용하지 않아 Thin Film Transistor 데이터 혼입 방지

기존 오염 데이터 정리(선택)
- supabase/migrations/20260917_cleanup_tft_semiconductor_data.sql
- Supabase SQL Editor에서 내용을 검토한 후 실행
- TFT의 기존 snapshot/news를 지우므로 실행 직후 Collector를 한 번 실행

검증
- npm run typecheck
- npm run build
- npx wrangler deploy --config wrangler.collector.toml --dry-run

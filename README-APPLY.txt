why-trending news-driven candidate discovery update

프로젝트 루트에서 압축을 풀어 기존 파일을 덮어쓰세요.

핵심 변경
- 고정 32개 정상 경로 제거
- 뉴스 seed 6회로 최대 600개 제목 수집
- deterministic 2~4단어 phrase 추출 및 유사 후보 제거
- 상위 25개를 DataLab 5회 batch 검증
- TOP20 bulk 저장
- 실제 fetch subrequest 계측
- 고정 후보는 뉴스 후보가 5개 미만일 때만 fallback

검증
npm run typecheck
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy --config wrangler.collector.toml --dry-run

배포 후 실행
curl.exe -X POST https://waetteo-collector.<account>.workers.dev/__scheduled
npx wrangler tail waetteo-collector

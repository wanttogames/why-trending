why-trending Collector slug collision fix

포함 파일:
- server/pipeline/normalize.ts
- server/pipeline/collect.ts

프로젝트 루트에서 이 압축 파일을 풀어 기존 파일을 덮어쓴 뒤 커밋/푸시하세요.
Cloudflare Git 연동이 main push를 감지하면 Collector Worker가 다시 빌드·배포됩니다.

배포 후 확인:
1. npx wrangler tail waetteo-collector
2. Collector 수동 실행 또는 Cron 대기
3. 로그에서 다음 값을 확인
   [collector] slug uniqueness check passed = 32
   [collector] qualifiedCandidates = 32
   [collector] savedCandidates = 32
4. curl.exe "https://why-trending.wanttogames.workers.dev/api/trends?limit=100"

참고: /api/issues 기본 limit은 20이며 화면도 반환 배열 전체를 표시합니다.

Cloudflare Web Analytics 적용

1. index.html을 기존 프로젝트 루트에 덮어쓰세요.
2. 이전 SEO 아카이브 패치를 적용한 경우 shared/archive.ts도 같은 위치에 덮어쓰세요.
3. npm run build 후 메인 Worker를 배포하거나 Git 자동 배포를 이용하세요.

수정: Vue HTML 및 서버 생성 아카이브 HTML의 body 끝에 제공된 스크립트 1회 삽입.
TypeScript/Vite 빌드 성공. 실제 분석 수신은 배포 후 확인 필요.
DB migration, Secret 변경, Collector 재배포는 필요 없습니다.

# 로컬/운영 점검

1. SQL migration → seed, `npm install`, `npm test`, `npm run build`.
2. `npm run dev` 후 http://localhost:8787 에서 체험 모드 배너 확인.
3. ChatGPT / Gemini 비교 → 7일/30일/3개월/1년 변경. 데이터 표와 차트 날짜 일치 확인.
4. 반대 순서 입력 → 동일 URL/결과. 같은 검색어 → 명확한 오류.
5. 공유 링크를 새 탭에서 열고 선택한 기간 유지 확인. 이미지 저장에 가상 데이터 표시 확인.
6. 390px / 1440px 화면에서 가로 넘침, 메뉴, 카드, 긴 검색어 점검.
7. 쇼핑 키워드 클릭 → 기기/성별/연령 필터 변경. 일반 검색 관심도와 쇼핑 클릭 관심도 구분.
8. 관련 콘텐츠 버튼 → mock에서는 빈 상태, real에서는 제공된 필드/원문 링크.
9. real 전환 후 Collector health 및 Cron 로그 확인. 첫 전체 수집에는 최대 3시간.
10. Supabase api_usage, trend_snapshots, trend_rankings에서 실제 호출/저장 확인.
11. 동일 VS 반복 요청 시 NAVER 호출 증가가 없는지 api_usage로 확인. 다른 배포 지역의 첫 조회도 Supabase 캐시를 공유.
12. 키 제한/429/데이터 부족 시 이전 데이터 안내 또는 재시도 메시지, 빈 페이지 광고 없음 확인.
13. 페이지 소스에서 동적 title/OG/canonical 확인. VS index 허용은 유효한 7일 캐시가 있을 때만 적용.
14. 실제 키로 shopping category 허용·권한과 각 키워드의 분야 분류를 확인. 잘못된 분야는 DB/seed/config를 교정.

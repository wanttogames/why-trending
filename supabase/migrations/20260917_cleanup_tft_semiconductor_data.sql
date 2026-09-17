-- TFT가 Thin Film Transistor 의미로 수집된 기존 점수와 기사를 제거합니다.
-- 이 migration 적용 직후 Collector를 한 번 실행해 게임 의미의 최신 snapshot을 생성하세요.

delete from public.keyword_snapshots
where keyword_id in (
  select id from public.keywords where keyword = 'TFT'
);

delete from public.news_articles
where keyword_id in (
  select id from public.keywords where keyword = 'TFT'
);

update public.keywords
set status = 'NEW',
    reason = '롤토체스 관련 검색 관심도와 최근 뉴스 언급이 함께 증가하고 있어요.',
    updated_at = now()
where keyword = 'TFT';

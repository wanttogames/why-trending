-- Run before deploying the updated Collector and API.
alter table public.keywords add column if not exists evidence jsonb;
create index if not exists news_collected_at_idx on public.news_articles(collected_at);

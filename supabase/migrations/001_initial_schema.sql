create extension if not exists pg_trgm;

create type public.issue_status as enum ('NEW', '급상승', '상승', '유지', '하락');
create type public.issue_category as enum ('연예', '스포츠', '게임', '경제', '사회', 'IT');

create table public.keywords (
  id bigint generated always as identity primary key,
  keyword text not null,
  slug text not null unique,
  category public.issue_category not null,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  status public.issue_status not null default 'NEW',
  reason text,
  related_keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint keywords_keyword_unique unique (keyword)
);

create table public.keyword_snapshots (
  id bigint generated always as identity primary key,
  keyword_id bigint not null references public.keywords(id) on delete cascade,
  collected_at timestamptz not null default now(),
  trend_score numeric(6,2) not null default 0 check (trend_score between 0 and 100),
  news_count integer not null default 0 check (news_count >= 0),
  youtube_count integer check (youtube_count is null or youtube_count >= 0),
  issue_score numeric(6,2) not null check (issue_score between 0 and 100),
  rank integer not null check (rank > 0),
  rank_change integer not null default 0,
  constraint keyword_snapshots_unique_time unique (keyword_id, collected_at)
);

create table public.news_articles (
  id bigint generated always as identity primary key,
  keyword_id bigint not null references public.keywords(id) on delete cascade,
  title text not null,
  description text,
  url text not null,
  publisher text,
  published_at timestamptz not null,
  collected_at timestamptz not null default now(),
  constraint news_articles_url_unique unique (url)
);

create table public.issue_events (
  id bigint generated always as identity primary key,
  keyword_id bigint not null references public.keywords(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  event_at timestamptz not null default now()
);

create index keywords_category_status_idx on public.keywords(category, status);
create index keywords_last_detected_idx on public.keywords(last_detected_at desc);
create index keywords_keyword_trgm_idx on public.keywords using gin(keyword gin_trgm_ops);
create index snapshots_keyword_collected_idx on public.keyword_snapshots(keyword_id, collected_at desc);
create index snapshots_collected_rank_idx on public.keyword_snapshots(collected_at desc, rank);
create index news_keyword_published_idx on public.news_articles(keyword_id, published_at desc);
create index events_keyword_event_at_idx on public.issue_events(keyword_id, event_at desc);

alter table public.keywords enable row level security;
alter table public.keyword_snapshots enable row level security;
alter table public.news_articles enable row level security;
alter table public.issue_events enable row level security;

create policy "public read keywords" on public.keywords for select using (true);
create policy "public read snapshots" on public.keyword_snapshots for select using (true);
create policy "public read news" on public.news_articles for select using (true);
create policy "public read events" on public.issue_events for select using (true);

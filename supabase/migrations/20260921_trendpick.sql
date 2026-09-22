begin;
create table if not exists public.trend_keywords (
 id bigint generated always as identity primary key,
 keyword text not null unique check (length(keyword) between 1 and 60),
 slug text not null unique, category text not null, aliases text[] not null default '{}',
 enabled boolean not null default true, shopping_category text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (cardinality(aliases)<=5)
);
create table if not exists public.shopping_categories (
 id text primary key, name text not null, naver_code text not null check(naver_code ~ '^[0-9]{8}$'), official_name text not null
);
insert into public.shopping_categories values
 ('digital','디지털','50000003','디지털/가전'),('appliances','가전','50000003','디지털/가전'),
 ('fashion','패션','50000000','패션의류'),('beauty','뷰티','50000002','화장품/미용'),
 ('life','생활','50000008','생활/건강'),('food','식품','50000006','식품'),
 ('sports','스포츠','50000007','스포츠/레저'),('baby','육아','50000005','출산/육아'),
 ('furniture','가구','50000004','가구/인테리어'),('pets','반려동물','50000008','생활/건강')
 on conflict (id) do update set naver_code=excluded.naver_code, official_name=excluded.official_name;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='tp_shopping_category_fk') then
 alter table public.trend_keywords add constraint tp_shopping_category_fk foreign key(shopping_category) references public.shopping_categories(id);
 end if;
end $$;
create table if not exists public.trend_snapshots (
 keyword_id bigint not null references public.trend_keywords(id) on delete cascade,
 source text not null check(source in ('search','shopping')),
 series jsonb not null, recorded_at timestamptz not null,
 primary key(keyword_id,source)
);
create table if not exists public.trend_rankings (
 keyword_id bigint not null references public.trend_keywords(id) on delete cascade,
 source text not null check(source in ('search','shopping')), period text not null check(period in ('1d','7d','30d','90d')),
 metrics jsonb not null, trend_score numeric not null, recorded_at timestamptz not null,
 primary key(keyword_id,source,period)
);
create index if not exists tp_rank_idx on public.trend_rankings(source,period,trend_score desc);
create table if not exists public.search_content_cache (
 key text primary key, payload jsonb, expires_at timestamptz not null default '-infinity',
 updated_at timestamptz not null default now(), lock_until timestamptz not null default '-infinity', owner uuid
);
create index if not exists tp_cache_expiry on public.search_content_cache(expires_at);
create table if not exists public.api_usage (
 month date not null, service text not null check(service in ('search','trend','shopping')),
 calls integer not null default 0, primary key(month,service)
);
create table if not exists public.api_rate_window (id boolean primary key default true check(id), second timestamptz not null, calls integer not null);
create table if not exists public.popular_comparisons (
 keyword_a text not null, keyword_b text not null, view_count bigint not null default 0, share_count bigint not null default 0,
 last_viewed_at timestamptz not null default now(), primary key(keyword_a,keyword_b), check(keyword_a<keyword_b)
);
create or replace function public.tp_permit(p_service text) returns boolean
language plpgsql security definer set search_path=public as $$
declare m date:=date_trunc('month',timezone('Asia/Seoul',now()))::date; n integer; lim integer; r integer; sec timestamptz:=date_trunc('second',clock_timestamp());
begin
 if p_service not in ('search','trend','shopping') then return false; end if;
 perform pg_advisory_xact_lock(742021);
 lim:=case when p_service='search' then 500000 else 35000 end;
 insert into api_usage(month,service) values(m,p_service) on conflict do nothing;
 select calls into n from api_usage where month=m and service=p_service;
 if n>=lim then return false; end if;
 insert into api_rate_window(id,second,calls) values(true,sec,0) on conflict(id) do nothing;
 update api_rate_window set second=sec,calls=0 where second<>sec;
 select calls into r from api_rate_window where id=true;
 if r>=40 then return false; end if;
 update api_usage set calls=calls+1 where month=m and service=p_service;
 update api_rate_window set calls=calls+1 where id=true;
 return true;
end $$;
create or replace function public.tp_claim_cache(p_key text,p_owner uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare row search_content_cache; state text;
begin
 if length(p_key)>1500 then raise exception 'cache key too long'; end if;
 insert into search_content_cache(key) values(p_key) on conflict do nothing;
 select * into row from search_content_cache where key=p_key for update;
 if row.expires_at>now() and row.payload is not null then state:='hit';
 elsif row.lock_until>now() then state:='busy';
 else state:='claimed'; update search_content_cache set lock_until=now()+interval '180 seconds',owner=p_owner where key=p_key; end if;
 return jsonb_build_object('state',state,'payload',row.payload,'updated_at',row.updated_at);
end $$;
create or replace function public.tp_finish_cache(p_key text,p_owner uuid,p_payload jsonb,p_ttl integer) returns void
language plpgsql security definer set search_path=public as $$
begin
 update search_content_cache set payload=p_payload,updated_at=now(),expires_at=now()+make_interval(secs=>least(86400,greatest(30,p_ttl))),lock_until='-infinity',owner=null where key=p_key and owner=p_owner;
 if not found then raise exception 'cache lease expired'; end if;
end $$;
create or replace function public.tp_release_cache(p_key text,p_owner uuid) returns void
language sql security definer set search_path=public as $$ update search_content_cache set lock_until='-infinity',owner=null where key=p_key and owner=p_owner $$;
create or replace function public.tp_candidates(p_slot integer,p_shards integer,p_kind text) returns setof public.trend_keywords
language sql security definer set search_path=public as $$
 select * from trend_keywords where enabled and mod(id-1,greatest(1,p_shards))=p_slot and (p_kind='search' or shopping_category is not null) order by id limit 60
$$;
create or replace function public.tp_save(p_snapshots jsonb,p_rankings jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into trend_snapshots(keyword_id,source,series,recorded_at)
 select keyword_id,source,series,recorded_at from jsonb_to_recordset(p_snapshots) as x(keyword_id bigint,source text,series jsonb,recorded_at timestamptz)
 on conflict(keyword_id,source) do update set series=excluded.series,recorded_at=excluded.recorded_at where excluded.recorded_at>=trend_snapshots.recorded_at;
 get diagnostics n=row_count;
 insert into trend_rankings(keyword_id,source,period,metrics,trend_score,recorded_at)
 select keyword_id,source,period,metrics,trend_score,recorded_at from jsonb_to_recordset(p_rankings) as x(keyword_id bigint,source text,period text,metrics jsonb,trend_score numeric,recorded_at timestamptz)
 on conflict(keyword_id,source,period) do update set metrics=excluded.metrics,trend_score=excluded.trend_score,recorded_at=excluded.recorded_at where excluded.recorded_at>=trend_rankings.recorded_at;
 return n;
end $$;
create or replace function public.tp_comparison_event(p_a text,p_b text,p_share boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_a>=p_b or length(p_a)>60 or length(p_b)>60 then return; end if;
 insert into popular_comparisons(keyword_a,keyword_b,view_count,share_count) values(p_a,p_b,case when p_share then 0 else 1 end,case when p_share then 1 else 0 end)
 on conflict(keyword_a,keyword_b) do update set view_count=popular_comparisons.view_count+case when p_share then 0 else 1 end, share_count=popular_comparisons.share_count+case when p_share then 1 else 0 end,last_viewed_at=now();
end $$;
create or replace function public.tp_cleanup() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from search_content_cache where updated_at<now()-interval '2 days' and lock_until<now();
 delete from api_usage where month<date_trunc('month',now())-interval '13 months';
 delete from popular_comparisons where last_viewed_at<now()-interval '90 days';
end $$;
-- Server-only data access: no browser role can read caches or call budget/lease functions.
do $$ declare t text; f record; begin
 foreach t in array array['trend_keywords','shopping_categories','trend_snapshots','trend_rankings','search_content_cache','api_usage','api_rate_window','popular_comparisons'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'tp_%' loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant usage,select on sequence public.trend_keywords_id_seq to service_role;
commit;

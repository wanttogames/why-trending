begin;
-- Independent from expiring rows; no cascading FK may delete permanent pages.
create table if not exists public.issue_archive (
 id bigint generated always as identity primary key,
 keyword_key text not null unique check(length(keyword_key) between 1 and 120),
 slug text not null unique check(length(slug) between 1 and 500),
 title text not null check(length(title)<=120),
 summary text not null check(length(summary) between 20 and 1600),
 first_seen_at timestamptz not null, last_seen_at timestamptz not null,
 peak_score numeric not null check(peak_score between 0 and 100),
 peak_rank integer not null check(peak_rank>0),
 category text not null default '전체',
 related_keywords text[] not null default '{}' check(cardinality(related_keywords)<=5),
 representative_news jsonb not null default '[]' check(jsonb_typeof(representative_news)='array' and jsonb_array_length(representative_news)<=5 and octet_length(representative_news::text)<=16000),
 score_model text not null default 'trend7d' check(score_model in ('legacy','trend7d')),
 legacy_peak jsonb not null default '{}',
 summary_version smallint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists issue_archive_seen_idx on public.issue_archive(last_seen_at desc,id desc);
create index if not exists issue_archive_category_idx on public.issue_archive(category,last_seen_at desc);
alter table public.issue_archive enable row level security;
revoke all on public.issue_archive from anon,authenticated;
grant select,insert,update on public.issue_archive to service_role;
grant usage,select on sequence public.issue_archive_id_seq to service_role;

-- Bounded projection only: never store descriptions, bodies or raw responses.
create or replace function public.tp_archive_news(p_news jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('title',left(title,240),'url',url,'publisher',left(publisher,120),'publishedAt',published)), '[]'::jsonb)
 from (select distinct on (e->>'url') e->>'title' title,e->>'url' url,
 coalesce(e->>'publisher',e->>'source','') publisher,left(e->>'publishedAt',40) published
 from jsonb_array_elements(case when jsonb_typeof(p_news)='array' then p_news else '[]'::jsonb end) e
 where e->>'url' ~ '^https?://' and length(e->>'url')<=1500 and length(e->>'title')>0
 order by e->>'url' limit 5) n
$$;
create or replace function public.tp_archive_put(p_items jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare item jsonb; k text; s text; base text; news jsonb; n integer:=0; suffix integer; seen timestamptz;
begin
 perform pg_advisory_xact_lock(742022);
 for item in select value from jsonb_array_elements(p_items) loop
  k:=lower(regexp_replace(trim(normalize(item->>'title',NFKC)),'\s+',' ','g'));
  s:=item->>'slug';
  if s is null or s !~ '^[a-zA-Z0-9_-]+$' then s:='issue-'||md5(k); end if;
  select slug into base from issue_archive where keyword_key=k;
  if base is not null then s:=base;
  else
   base:=s; suffix:=0;
   while exists(select 1 from issue_archive where slug=s and keyword_key<>k) loop
    s:=left(base,120)||'-'||md5(k||case when suffix=0 then '' else ':'||suffix::text end); suffix:=suffix+1;
   end loop;
  end if;
  news:=tp_archive_news(item->'news'); seen:=(item->>'lastSeenAt')::timestamptz;
  insert into issue_archive(keyword_key,slug,title,summary,first_seen_at,last_seen_at,peak_score,peak_rank,category,related_keywords,representative_news,score_model)
  values(k,s,left(item->>'title',120),item->>'summary',(item->>'firstSeenAt')::timestamptz,seen,
  (item->>'score')::numeric,(item->>'rank')::integer,coalesce(item->>'category','전체'),
  array(select left(value,60) from jsonb_array_elements_text(coalesce(item->'related','[]')) limit 5),news,coalesce(item->>'scoreModel','trend7d'))
  on conflict(keyword_key) do update set
   last_seen_at=greatest(issue_archive.last_seen_at,excluded.last_seen_at),
   peak_score=case when issue_archive.score_model=excluded.score_model then greatest(issue_archive.peak_score,excluded.peak_score) else excluded.peak_score end,
   peak_rank=case when issue_archive.score_model=excluded.score_model then least(issue_archive.peak_rank,excluded.peak_rank) else excluded.peak_rank end,
   legacy_peak=case when issue_archive.score_model='legacy' and excluded.score_model='trend7d' then jsonb_build_object('score',issue_archive.peak_score,'rank',issue_archive.peak_rank) else issue_archive.legacy_peak end,
   score_model=excluded.score_model,
   summary=excluded.summary,category=excluded.category,related_keywords=excluded.related_keywords,
   representative_news=case when jsonb_array_length(excluded.representative_news)>0 then excluded.representative_news else issue_archive.representative_news end,
   updated_at=now()
  where excluded.last_seen_at>=issue_archive.last_seen_at and (excluded.last_seen_at>issue_archive.last_seen_at or excluded.summary is distinct from issue_archive.summary or excluded.peak_score>issue_archive.peak_score or excluded.peak_rank<issue_archive.peak_rank or (jsonb_array_length(excluded.representative_news)>0 and excluded.representative_news is distinct from issue_archive.representative_news));
  n:=n+1;
 end loop;
 return n;
end $$;
-- Match the default global search TOP20 (7d). Other period/category lists remain unchanged.
create or replace function public.tp_archive_refresh() returns integer
language plpgsql security definer set search_path=public as $$
declare items jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
 'title',keyword,'slug',slug,'category',category,'related',to_jsonb(aliases[1:5]),
 'firstSeenAt',recorded_at,'lastSeenAt',recorded_at,'score',trend_score,'rank',position,
 'news',coalesce(payload->'news','[]'::jsonb),
 'summary',format('%s은(는) %s 기준 최근 7일 평균 상대 관심도가 직전 7일보다 %s 상승해 TrendPick 관심도 목록에 포착됐습니다. 당시 관리 키워드의 7일 상승 순위는 %s위이며 자체 상승 점수는 %s점입니다. 이 기록은 NAVER Data Lab 상대 지수의 변화를 설명하며, 특정 사건이 상승의 원인인지는 확인하지 않습니다.',
 keyword,coalesce(metrics->>'asOf',to_char(recorded_at at time zone 'Asia/Seoul','YYYY-MM-DD')),
 case when metrics->>'changeRate' is null then '0 기준에서 새롭게' else round((metrics->>'changeRate')::numeric,1)::text||'%' end,position,trend_score)
 )), '[]'::jsonb) into items
 from (
 select k.keyword,k.slug,k.category,k.aliases,r.recorded_at,r.trend_score,r.metrics,c.payload,
 row_number() over(order by r.trend_score desc,k.id) position
 from trend_rankings r join trend_keywords k on k.id=r.keyword_id
 left join search_content_cache c on c.key='content:'||k.keyword
 where r.source='search' and r.period='7d' and k.enabled and r.trend_score>0
 and r.metrics->>'status'<>'insufficient' and (r.metrics->>'change')::numeric>0
 and r.recorded_at>now()-interval '7 hours'
 order by r.trend_score desc,k.id limit 20
 ) ranked;
 return tp_archive_put(items);
end $$;
-- One bounded status read, no per-page NAVER fetch.
create or replace function public.tp_archive_active() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
 select k.keyword,r.trend_score score,r.metrics->>'changeRate' rate,
 row_number() over(order by r.trend_score desc,k.id) rank
 from trend_rankings r join trend_keywords k on k.id=r.keyword_id
 where r.source='search' and r.period='7d' and k.enabled and r.trend_score>0
 and r.metrics->>'status'<>'insufficient' and (r.metrics->>'change')::numeric>0
 and r.recorded_at>now()-interval '7 hours'
 order by r.trend_score desc,k.id limit 20) r
$$;
-- Preserve legacy URLs/data BEFORE retention can remove their sources.
do $$ declare items jsonb;
begin
 if to_regclass('public.keywords') is not null and to_regclass('public.keyword_snapshots') is not null and to_regclass('public.news_articles') is not null then
  execute $q$
  select coalesce(jsonb_agg(jsonb_build_object('scoreModel','legacy','title',k.keyword,'slug',k.slug,'category',k.category::text,
   'firstSeenAt',k.first_detected_at,'lastSeenAt',k.last_detected_at,'score',s.score,'rank',s.rank,
   'related',to_jsonb(k.related_keywords[1:5]),'news',coalesce(n.news,'[]'::jsonb),
   'summary',format('%s은(는) %s부터 %s까지 이전 왜떠 서비스에서 감지된 관심 키워드입니다. 보관된 기록의 최고 순위는 %s위이며 당시 이슈지수 최고값은 %s점입니다. 이 점수는 현재 TrendPick 상승 점수와 계산 방식이 다르며, 보관 뉴스만으로 구체적인 상승 원인을 단정하지 않습니다.',k.keyword,to_char(k.first_detected_at,'YYYY-MM-DD'),to_char(k.last_detected_at,'YYYY-MM-DD'),s.rank,s.score))), '[]'::jsonb)
  from keywords k join lateral (select max(issue_score) score,min(rank) rank from keyword_snapshots where keyword_id=k.id) s on s.rank is not null
  left join lateral (select jsonb_agg(to_jsonb(x)) news from (select title,url,publisher,published_at as "publishedAt" from news_articles where keyword_id=k.id order by published_at desc limit 5) x) n on true
  $q$ into items;
  perform tp_archive_put(items);
 end if;
end $$;

create or replace function public.tp_archive_cleanup() returns jsonb
language plpgsql security definer set search_path=public as $$
declare a integer:=0;b integer:=0;c integer:=0;
begin
 -- At most 5000 legacy rows per run avoids long locks. Daily batches catch up gradually.
 if to_regclass('public.news_articles') is not null then
  execute 'delete from public.news_articles where id in (select id from public.news_articles where collected_at<now()-interval ''60 days'' order by collected_at limit 5000)';
  get diagnostics a=row_count;
 end if;
 if to_regclass('public.keyword_snapshots') is not null then
  execute 'delete from public.keyword_snapshots where id in (select id from public.keyword_snapshots where collected_at<now()-interval ''30 days'' order by collected_at limit 5000)';
  get diagnostics b=row_count;
 end if;
 -- Current 180 daily points are a compact rolling aggregate, needed by the 90d comparison.
 delete from trend_snapshots where recorded_at<now()-interval '30 days'; get diagnostics c=row_count;
 delete from trend_rankings where recorded_at<now()-interval '30 days';
 perform tp_cleanup();
 return jsonb_build_object('news',a,'legacySnapshots',b,'staleTrendSnapshots',c);
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'tp_archive_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
-- Populate currently observed TOP rows without another NAVER request.
select public.tp_archive_refresh();
commit;

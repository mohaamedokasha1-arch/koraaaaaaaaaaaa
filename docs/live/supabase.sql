-- Apply once in Supabase SQL Editor. Free-tier compatible; no video is stored.
-- Back up any existing catalogue before applying migrations.
begin;

create table if not exists public.live_catalog (
  id text primary key check (id = 'primary'),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.live_limits (
  key text primary key,
  hits integer not null,
  reset_at timestamptz not null
);
create table if not exists public.live_reports (
  id bigint generated always as identity primary key,
  stream_id text not null,
  reporter_hash text not null check (reporter_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists live_reports_recent on public.live_reports (stream_id, reporter_hash, created_at desc);
create table if not exists public.live_discoveries (
  id text primary key check (id = 'primary'),
  document jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.live_catalog enable row level security;
alter table public.live_limits enable row level security;
alter table public.live_reports enable row level security;
alter table public.live_discoveries enable row level security;

revoke all on public.live_catalog, public.live_limits, public.live_reports, public.live_discoveries from anon, authenticated;
grant select on public.live_catalog to anon, authenticated;
grant all on public.live_catalog, public.live_limits, public.live_reports, public.live_discoveries to service_role;
grant usage, select on sequence public.live_reports_id_seq to service_role;
drop policy if exists live_catalog_public_read on public.live_catalog;
create policy live_catalog_public_read on public.live_catalog for select to anon, authenticated using (id = 'primary');
-- No anon INSERT/UPDATE/DELETE policies, and no public reads of identity hashes.

insert into public.live_catalog(id, document) values ('primary',
  '{"version":1,"revision":0,"updatedAt":null,"matches":[],"streams":[],"broadcasters":[]}'::jsonb
) on conflict (id) do nothing;

-- An atomic, shared rate limiter. Only the service role may call it.
create or replace function public.consume_live_limit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_now timestamptz := clock_timestamp(); v_hits integer; v_reset timestamptz;
begin
  if p_key is null or p_limit is null or p_window_seconds is null or length(p_key) > 200 or p_limit < 1 or p_limit > 100 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid limit';
  end if;
  insert into public.live_limits(key, hits, reset_at) values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    hits = case when public.live_limits.reset_at <= v_now then 1 else public.live_limits.hits + 1 end,
    reset_at = case when public.live_limits.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds) else public.live_limits.reset_at end
  returning hits, reset_at into v_hits, v_reset;
  return jsonb_build_object('allowed', v_hits <= p_limit, 'retry_after', greatest(0, ceil(extract(epoch from v_reset - v_now)))::integer);
end $$;

create or replace function public.record_live_report(p_match_id text, p_stream_id text, p_reporter_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_doc jsonb; v_stream jsonb; v_index integer; v_count integer;
  v_limit jsonb; v_now timestamptz := clock_timestamp(); v_hidden timestamptz;
begin
  if p_reporter_hash is null or p_stream_id is null or p_match_id is null or p_reporter_hash !~ '^[a-f0-9]{64}$' or length(p_stream_id) > 120 or length(p_match_id) > 120 then
    raise exception 'Invalid report';
  end if;
  -- Prevent concurrent reports/catalogue edits from losing counts.
  select document into v_doc from public.live_catalog where id = 'primary' for update;
  select value, (ordinality - 1)::integer into v_stream, v_index
    from jsonb_array_elements(v_doc->'streams') with ordinality
    where value->>'id' = p_stream_id and value->>'matchId' = p_match_id;
  if v_stream is null or v_stream->>'provider' = 'external' then
    return jsonb_build_object('outcome', 'unknown_stream', 'retry_after', 0);
  end if;
  v_limit := public.consume_live_limit('report:' || p_reporter_hash, 5, 600);
  if not (v_limit->>'allowed')::boolean then
    return jsonb_build_object('outcome', 'rate_limited', 'retry_after', (v_limit->>'retry_after')::integer);
  end if;
  if exists (select 1 from public.live_reports where stream_id = p_stream_id and reporter_hash = p_reporter_hash and created_at > v_now - interval '15 minutes') then
    return jsonb_build_object('outcome', 'duplicate', 'retry_after', 0);
  end if;
  insert into public.live_reports(stream_id, reporter_hash, created_at) values (p_stream_id, p_reporter_hash, v_now);
  select count(distinct reporter_hash) into v_count from public.live_reports
    where stream_id = p_stream_id and created_at > v_now - interval '30 minutes';
  v_stream := jsonb_set(v_stream, '{reportCount}', to_jsonb(coalesce((v_stream->>'reportCount')::integer, 0) + 1));
  if v_count >= 5 then
    v_hidden := greatest(coalesce((v_stream->>'hiddenUntil')::timestamptz, v_now), v_now + interval '15 minutes');
    v_stream := jsonb_set(v_stream, '{hiddenUntil}', to_jsonb(v_hidden));
  end if;
  v_doc := jsonb_set(v_doc, array['streams', v_index::text], v_stream);
  v_doc := jsonb_set(v_doc, '{updatedAt}', to_jsonb(v_now));
  update public.live_catalog set document = v_doc, updated_at = v_now where id = 'primary';
  -- Best-effort retention cleanup, indexed below. No raw IPs are ever stored.
  delete from public.live_reports where created_at < v_now - interval '1 day';
  delete from public.live_limits where reset_at < v_now - interval '1 day';
  return jsonb_build_object('outcome', 'accepted', 'retry_after', 0);
end $$;
create index if not exists live_reports_retention on public.live_reports (created_at);
create index if not exists live_limits_retention on public.live_limits (reset_at);

-- Admin/automation save. Preserve community counters for an unchanged source,
-- even if an editor had a stale JSON document open when new reports arrived.
create or replace function public.save_live_catalog(p_document jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old jsonb; v_streams jsonb;
begin
  if p_document is null or p_document->>'version' is distinct from '1' or jsonb_typeof(p_document->'matches') is distinct from 'array'
    or jsonb_typeof(p_document->'streams') is distinct from 'array' or jsonb_typeof(p_document->'broadcasters') is distinct from 'array'
    or octet_length(p_document::text) > 1000000 then raise exception 'Invalid catalogue'; end if;
  select document into v_old from public.live_catalog where id = 'primary' for update;
  if coalesce((v_old->>'revision')::integer, 0) <> coalesce((p_document->>'revision')::integer, 0) then
    raise exception 'Catalogue revision conflict: reload before saving';
  end if;
  -- Clear old report events if an ID is removed or now describes a different
  -- video/provider/match. Otherwise the previous video's reporters could hide
  -- the new source immediately, even though its visible counter was reset.
  delete from public.live_reports r where not exists (
    select 1 from jsonb_array_elements(p_document->'streams') incoming
    join jsonb_array_elements(coalesce(v_old->'streams','[]'::jsonb)) previous
      on previous->>'id'=incoming->>'id' and previous->>'sourceRef'=incoming->>'sourceRef'
      and previous->>'provider'=incoming->>'provider' and previous->>'matchId'=incoming->>'matchId'
    where incoming->>'id'=r.stream_id
  );
  select coalesce(jsonb_agg(case when previous.value is null then incoming.value || jsonb_build_object('reportCount',0,'hiddenUntil',null) else incoming.value || jsonb_build_object(
      'reportCount', coalesce(previous.value->'reportCount', '0'::jsonb),
      'hiddenUntil', coalesce(previous.value->'hiddenUntil', 'null'::jsonb)
    ) end order by incoming.ordinality), '[]'::jsonb) into v_streams
    from jsonb_array_elements(p_document->'streams') with ordinality as incoming
    left join lateral (select value from jsonb_array_elements(v_old->'streams')
      where value->>'id' = incoming.value->>'id' and value->>'matchId' = incoming.value->>'matchId'
        and value->>'sourceRef' = incoming.value->>'sourceRef' and value->>'provider' = incoming.value->>'provider' limit 1) as previous on true;
  p_document := jsonb_set(p_document, '{revision}', to_jsonb(coalesce((v_old->>'revision')::integer, 0) + 1));
  p_document := jsonb_set(p_document, '{streams}', v_streams);
  p_document := jsonb_set(p_document, '{updatedAt}', to_jsonb(clock_timestamp()));
  insert into public.live_catalog(id, document) values ('primary', p_document)
    on conflict (id) do update set document = excluded.document, updated_at = clock_timestamp();
  return jsonb_build_object('saved', true, 'revision', (p_document->>'revision')::integer, 'updatedAt', p_document->>'updatedAt');
end $$;

revoke all on function public.consume_live_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.record_live_report(text, text, text) from public, anon, authenticated;
revoke all on function public.save_live_catalog(jsonb) from public, anon, authenticated;
grant execute on function public.consume_live_limit(text, integer, integer) to service_role;
grant execute on function public.record_live_report(text, text, text) to service_role;
grant execute on function public.save_live_catalog(jsonb) to service_role;
commit;

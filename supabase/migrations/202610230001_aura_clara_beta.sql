-- Aura Clara beta schema. Run this file in Supabase SQL Editor before deploying.
create extension if not exists pgcrypto;

create table if not exists public.study_maps (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null default 'Nuevo tema de estudio',
  map_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint study_maps_title_length check (char_length(title) <= 180),
  constraint study_maps_payload_size check (pg_column_size(map_data) <= 1500000)
);

create index if not exists study_maps_user_updated_idx on public.study_maps (user_id, updated_at desc);
alter table public.study_maps enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.study_maps to authenticated;
revoke all on public.study_maps from public, anon;

drop policy if exists "Students read their own maps" on public.study_maps;
create policy "Students read their own maps" on public.study_maps for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Students create their own maps" on public.study_maps;
create policy "Students create their own maps" on public.study_maps for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Students update their own maps" on public.study_maps;
create policy "Students update their own maps" on public.study_maps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Students delete their own maps" on public.study_maps;
create policy "Students delete their own maps" on public.study_maps for delete to authenticated using ((select auth.uid()) = user_id);

-- Private daily AI quota table. Clients cannot access it directly; the Edge Function reserves quota via its service role.
create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  requests integer not null default 0,
  input_chars integer not null default 0,
  primary key (user_id, usage_date),
  constraint ai_usage_requests_nonnegative check (requests >= 0),
  constraint ai_usage_chars_nonnegative check (input_chars >= 0)
);
alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from public, anon, authenticated;

create or replace function public.consume_ai_quota(p_user_id uuid, p_max_requests integer, p_max_chars integer, p_chars integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer := 0;
begin
  if p_chars < 1 or p_chars > p_max_chars then
    return false;
  end if;
  insert into public.ai_usage_daily as current_usage (user_id, usage_date, requests, input_chars)
  values (p_user_id, (timezone('utc', now()))::date, 1, p_chars)
  on conflict (user_id, usage_date) do update
    set requests = current_usage.requests + 1,
        input_chars = current_usage.input_chars + excluded.input_chars
    where current_usage.requests < p_max_requests
      and current_usage.input_chars + excluded.input_chars <= p_max_chars;
  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer, integer, integer) to service_role;

-- Storage is optional for this beta: extracted source text is kept inside each user's private map.
-- Raw uploaded files are not retained by the frontend integration unless a private storage workflow is added later.

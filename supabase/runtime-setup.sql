-- Interview AI additive runtime setup. Paste this WHOLE file into Supabase SQL Editor.
-- Prerequisite: existing 001_core.sql member tables/functions, PostgreSQL 15+.
-- Re-runnable: preserves existing questions, answers, profiles and private RLS policies.
-- Adds atomic AI quota RPC (002) and company collections (003). No credentials required here.
-- Does NOT grant service_role access to private member tables or alter their existing policies.
begin;

-- Apply after 001. Only the service role may invoke this atomic limiter.
create table if not exists public.ai_usage (
 subject text not null,
 usage_date date not null default (timezone('utc',now())::date),
 requests integer not null default 0 check (requests >= 0),
 primary key(subject,usage_date)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
create or replace function public.consume_ai_usage(p_subjects text[],p_limit integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare subject_key text; day_key date := timezone('utc',now())::date; current_count integer;
begin
 if p_limit < 1 or p_limit > 100 or cardinality(p_subjects) < 1 or cardinality(p_subjects) > 3 then raise exception 'invalid usage request'; end if;
 -- Stable lock order prevents deadlocks across guest and IP subjects.
 for subject_key in select distinct unnest(p_subjects) order by 1 loop
   if length(subject_key)>160 then raise exception 'invalid subject'; end if;
   perform pg_advisory_xact_lock(hashtextextended(subject_key || day_key::text,0));
 end loop;
 foreach subject_key in array p_subjects loop
   select requests into current_count from public.ai_usage where subject=subject_key and usage_date=day_key;
   if coalesce(current_count,0)>=p_limit then return false; end if;
 end loop;
 foreach subject_key in array p_subjects loop
   insert into public.ai_usage(subject,usage_date,requests) values(subject_key,day_key,1)
   on conflict(subject,usage_date) do update set requests=ai_usage.requests+1;
 end loop;
 return true;
end; $$;
revoke all on function public.consume_ai_usage(text[],integer) from public,anon,authenticated;
grant execute on function public.consume_ai_usage(text[],integer) to service_role;


-- Apply after deployed 001_core.sql and 002_ai_usage.sql. PostgreSQL 15+ / Supabase.
-- Existing saved questions remain present and unassigned.
create table if not exists public.company_collections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 100),
 position text not null default '' check(char_length(position)<=150),
 stage text not null default 'PREPARING' check(stage in ('PREPARING','APPLIED','INTERVIEW','COMPLETED')),
 deadline date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create unique index if not exists company_collections_owner_name_position on public.company_collections(user_id,lower(btrim(name)),lower(btrim(position)));
create index if not exists company_collections_owner_stage on public.company_collections(user_id,stage,created_at desc);
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.company_collections'::regclass and tgname='company_collections_updated' and not tgisinternal) then
  create trigger company_collections_updated before update on public.company_collections for each row execute function public.touch_updated_at();
 end if;
end;$$;
alter table public.company_collections enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='company_collections' and policyname='company_collections_owner') then
  create policy company_collections_owner on public.company_collections for all to authenticated
   using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
 end if;
end;$$;
revoke all on public.company_collections from anon;
grant select,insert,update,delete on public.company_collections to authenticated;
alter table public.saved_questions add column if not exists company_id uuid;
-- Composite ownership FK prevents cross-member assignment even through direct PostgREST.
-- PostgreSQL FK locks serialize deletion races. Delete the association, never the questions.
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.saved_questions'::regclass and conname='saved_questions_company_owner') then
  alter table public.saved_questions add constraint saved_questions_company_owner
   foreign key(user_id,company_id) references public.company_collections(user_id,id)
   on delete set null (company_id);
 end if;
end;$$;
create index if not exists saved_questions_owner_company on public.saved_questions(user_id,company_id,created_at desc);


-- Refresh PostgREST RPC/table schema after commit (fixes stale PGRST202 schema cache).
notify pgrst, 'reload schema';
commit;
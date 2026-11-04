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

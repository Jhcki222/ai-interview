-- Apply once in the Supabase SQL editor or with supabase db push.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null default '' check (char_length(nickname)<=40),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Keep the database boundary safe when authenticated clients use PostgREST directly.
create function public.question_text_valid(value jsonb, minimum integer, maximum integer)
returns boolean language sql immutable set search_path = '' as $$
 select coalesce(jsonb_typeof(value)='string' and char_length(value #>> '{}') between minimum and maximum,false)
$$;
create function public.question_snapshot_valid(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; item jsonb; answer jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' then return false;end if;
 if not public.question_text_valid(value->'id',1,150)
  or not public.question_text_valid(value->'subcategory',1,100)
  or not public.question_text_valid(value->'topic',1,200)
  or not public.question_text_valid(value->'question',1,5000) then return false;end if;
 if coalesce(value->>'category','') not in ('CS','BACKEND','AI','PERSONALITY','MOTIVATION','BUSINESS','PROJECTS')
  or coalesce(value->>'difficulty','') not in ('BASIC','INTERMEDIATE','ADVANCED')
  or coalesce(value->>'importance','') not in ('ESSENTIAL','IMPORTANT','ADVANCED') then return false;end if;
 answer := value->'modelAnswer';
 if jsonb_typeof(answer) is distinct from 'object' then return false;end if;
 if not public.question_text_valid(answer->'summary',1,10000)
  or not public.question_text_valid(answer->'interviewAnswer',1,20000)
  or not public.question_text_valid(answer->'detailedExplanation',1,20000)
  or not public.question_text_valid(answer->'example',1,10000) then return false;end if;
 if jsonb_typeof(answer->'keywords') is distinct from 'array' then return false;end if;
 if jsonb_array_length(answer->'keywords')>30 then return false;end if;
 for item in select jsonb_array_elements(answer->'keywords') loop
  if not public.question_text_valid(item,0,100) then return false;end if;
 end loop;
 if jsonb_typeof(value->'followUps') is distinct from 'array' then return false;end if;
 if jsonb_array_length(value->'followUps') not between 2 and 20 then return false;end if;
 for item in select jsonb_array_elements(value->'followUps') loop
  if jsonb_typeof(item) is distinct from 'object' then return false;end if;
  if not public.question_text_valid(item->'id',1,150)
   or not public.question_text_valid(item->'question',1,5000)
   or not public.question_text_valid(item->'modelAnswer',1,10000) then return false;end if;
 end loop;
 if value ? 'source' then
  if jsonb_typeof(value->'source') is distinct from 'object' then return false;end if;
  if not public.question_text_valid(value->'source'->'type',0,100)
   or not public.question_text_valid(value->'source'->'evidence',0,10000) then return false;end if;
 end if;
 return true;
end;$$;
create table public.saved_questions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 question jsonb not null check (public.question_snapshot_valid(question)),
 source_question_id text generated always as (question->>'id') stored,
 note text not null default '' check(char_length(note)<=10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,id), unique(user_id,source_question_id)
);
create table public.user_answers (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 question_key text not null check(question_key ~ '^(base:[A-Za-z0-9_-]{1,100}|saved:[0-9a-fA-F-]{36})$'),
 answer_text text not null default '' check(char_length(answer_text)<=20000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),unique(user_id,question_key)
);
create table public.learning_progress (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 question_key text not null check(question_key ~ '^(base:[A-Za-z0-9_-]{1,100}|saved:[0-9a-fA-F-]{36})$'),
 status text not null default 'NOT_STARTED' check(status in ('NOT_STARTED','IN_PROGRESS','NEEDS_REVIEW','COMPLETED')),
 bookmarked boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),unique(user_id,question_key)
);
create index saved_questions_user_created on public.saved_questions(user_id,created_at desc);
create index learning_progress_user_status on public.learning_progress(user_id,status);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now();return new;end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger saved_questions_updated before update on public.saved_questions for each row execute function public.touch_updated_at();
create trigger user_answers_updated before update on public.user_answers for each row execute function public.touch_updated_at();
create trigger learning_progress_updated before update on public.learning_progress for each row execute function public.touch_updated_at();
-- Prevent direct API writes referencing another member's saved question.
create function public.check_saved_reference() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.question_key like 'saved:%' then
  -- The key-share lock serializes child writes with deleting their parent.
  -- If insert wins, delete waits and its cleanup sees the committed child.
  -- If delete wins, this lookup finds no parent and rejects the child.
  perform 1 from public.saved_questions
   where id::text=substring(new.question_key from 7) and user_id=new.user_id
   for key share;
  if not found then raise foreign_key_violation using message='Invalid saved question reference';end if;
 end if;
 return new;
end;$$;
create trigger user_answers_reference before insert or update on public.user_answers for each row execute function public.check_saved_reference();
create trigger learning_progress_reference before insert or update on public.learning_progress for each row execute function public.check_saved_reference();
create function public.cleanup_saved_question() returns trigger language plpgsql set search_path = '' as $$ begin delete from public.user_answers where user_id=old.user_id and question_key='saved:'||old.id::text;delete from public.learning_progress where user_id=old.user_id and question_key='saved:'||old.id::text;return old;end;$$;
create trigger saved_question_cleanup after delete on public.saved_questions for each row execute function public.cleanup_saved_question();
alter table public.profiles enable row level security;
alter table public.saved_questions enable row level security;
alter table public.user_answers enable row level security;
alter table public.learning_progress enable row level security;
create policy profiles_owner on public.profiles for all to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy saved_questions_owner on public.saved_questions for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy user_answers_owner on public.user_answers for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy learning_progress_owner on public.learning_progress for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.profiles,public.saved_questions,public.user_answers,public.learning_progress from anon;
grant select,insert,update,delete on public.profiles,public.saved_questions,public.user_answers,public.learning_progress to authenticated;

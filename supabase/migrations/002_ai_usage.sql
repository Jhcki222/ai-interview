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

-- Allow frontend questions in saved snapshots for existing Supabase projects.
create or replace function public.question_snapshot_valid(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; item jsonb; answer jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' then return false;end if;
 if not public.question_text_valid(value->'id',1,150)
  or not public.question_text_valid(value->'subcategory',1,100)
  or not public.question_text_valid(value->'topic',1,200)
  or not public.question_text_valid(value->'question',1,5000) then return false;end if;
 if coalesce(value->>'category','') not in ('CS','FRONTEND','BACKEND','AI','PERSONALITY','MOTIVATION','BUSINESS','PROJECTS')
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
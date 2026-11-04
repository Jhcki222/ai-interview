-- Run against a disposable Supabase database AFTER 001_core.sql with an admin SQL connection.
-- psql -v ON_ERROR_STOP=1 -f tests/auth-database.sql "$TEST_DATABASE_URL"
-- All fixtures are rolled back. These are database tests, not source-text assertions.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','auth-test-owner@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','auth-test-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.saved_questions(id,user_id,question) values(
 '33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 '{"id":"custom-1","category":"FRONTEND","subcategory":"React 렌더링","topic":"React state","difficulty":"BASIC","importance":"ESSENTIAL","question":"React 상태 변경은 화면에 어떻게 반영되나요?","modelAnswer":{"summary":"요약","interviewAnswer":"답변","detailedExplanation":"설명","example":"예시","keywords":["React","state"]},"followUps":[{"id":"f1","question":"렌더 단계에서 무엇을 계산하나요?","modelAnswer":"새 UI 트리를 계산합니다."},{"id":"f2","question":"커밋 단계에서는 무엇을 하나요?","modelAnswer":"필요한 DOM 변경을 적용합니다."}]}'
);
do $$ declare invalid jsonb; original jsonb; retained jsonb; begin
 select question into original from public.saved_questions where id='33333333-3333-4333-8333-333333333333';
 -- Direct authenticated updates must reject both malformed objects and incomplete answers.
 foreach invalid in array array[
  '{"id":"x","question":"x","modelAnswer":{},"followUps":null}'::jsonb,
  original #- '{modelAnswer,interviewAnswer}',
  jsonb_set(original,'{followUps}','[]'),
  jsonb_set(original,'{followUps,1,modelAnswer}','null'),
  jsonb_set(original,'{category}','"UNKNOWN"'),
  jsonb_set(original,'{modelAnswer,keywords}','[{}]')
 ] loop
  begin
   update public.saved_questions set question=invalid where id='33333333-3333-4333-8333-333333333333';
   raise exception 'Malformed question was accepted';
  exception when check_violation then null;
  end;
 end loop;
 -- The same member cannot save the source twice or replace their first snapshot by saving again.
 begin
  insert into public.saved_questions(user_id,question) values('11111111-1111-4111-8111-111111111111',jsonb_set(original,'{question}','"replacement snapshot"'));
  raise exception 'Duplicate source question was accepted';
 exception when unique_violation then null;
 end;
 select question into retained from public.saved_questions where id='33333333-3333-4333-8333-333333333333';
 if retained is distinct from original then raise exception 'Duplicate save changed the first snapshot';end if;
end; $$;
insert into public.user_answers(user_id,question_key,answer_text) values('11111111-1111-4111-8111-111111111111','saved:33333333-3333-4333-8333-333333333333','실제 답변');
insert into public.learning_progress(user_id,question_key,status,bookmarked) values('11111111-1111-4111-8111-111111111111','saved:33333333-3333-4333-8333-333333333333','IN_PROGRESS',true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from public.saved_questions) or exists(select 1 from public.user_answers) or exists(select 1 from public.learning_progress) then raise exception 'Owner isolation failed';end if;
 begin
  insert into public.user_answers(user_id,question_key,answer_text) values('22222222-2222-4222-8222-222222222222','saved:33333333-3333-4333-8333-333333333333','other owner');
  raise exception 'Foreign saved reference was accepted';
 exception when foreign_key_violation then null;
 end;
end;$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
delete from public.saved_questions where id='33333333-3333-4333-8333-333333333333';
do $$ begin
 if exists(select 1 from public.user_answers) or exists(select 1 from public.learning_progress) then raise exception 'Delete cleanup failed';end if;
end;$$;
rollback;

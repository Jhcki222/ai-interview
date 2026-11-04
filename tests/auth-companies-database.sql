-- Run against a disposable Supabase project AFTER migrations 001, 002 and 003.
-- psql -v ON_ERROR_STOP=1 -f tests/auth-companies-database.sql "$TEST_DATABASE_URL"
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','company-owner-test@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','company-other-test@example.invalid');
insert into public.company_collections(id,user_id,name,position) values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Owner company','Backend'),
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','Other company','Backend');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.saved_questions(id,user_id,company_id,question) values(
 '33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
 '{"id":"company-custom-1","category":"CS","subcategory":"network","topic":"HTTP","difficulty":"BASIC","importance":"ESSENTIAL","question":"HTTP란?","modelAnswer":{"summary":"요약","interviewAnswer":"답변","detailedExplanation":"설명","example":"예시","keywords":["HTTP"]},"followUps":[{"id":"f1","question":"특징은?","modelAnswer":"첫 답변"},{"id":"f2","question":"제약은?","modelAnswer":"둘째 답변"}]}'
);
insert into public.user_answers(user_id,question_key,answer_text) values('11111111-1111-4111-8111-111111111111','saved:33333333-3333-4333-8333-333333333333','보존할 답변');
insert into public.learning_progress(user_id,question_key,status,bookmarked) values('11111111-1111-4111-8111-111111111111','saved:33333333-3333-4333-8333-333333333333','COMPLETED',true);
do $$ begin
 if exists(select 1 from public.company_collections where id='55555555-5555-4555-8555-555555555555') then raise exception 'Company RLS leaked another owner';end if;
 begin
  update public.saved_questions set company_id='55555555-5555-4555-8555-555555555555' where id='33333333-3333-4333-8333-333333333333';
  raise exception 'Cross-owner company assignment succeeded';
 exception when foreign_key_violation then null;
 end;
end;$$;
delete from public.company_collections where id='44444444-4444-4444-8444-444444444444';
do $$ begin
 if not exists(select 1 from public.saved_questions where id='33333333-3333-4333-8333-333333333333' and company_id is null) then raise exception 'Company deletion did not preserve question as unassigned';end if;
 if not exists(select 1 from public.user_answers where answer_text='보존할 답변') then raise exception 'Company deletion removed answer';end if;
 if not exists(select 1 from public.learning_progress where status='COMPLETED' and bookmarked) then raise exception 'Company deletion removed learning progress';end if;
end;$$;
rollback;

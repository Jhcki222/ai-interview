import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SavedQuestionControls } from '../components/auth/saved-question-controls';

describe('saved question learning entry point',()=>{
 it('renders answer, status and bookmark controls before any learning records exist',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const html=renderToStaticMarkup(<SavedQuestionControls id={id} onMutate={async()=>{}}/>);
  expect(html).toContain(`saved:${id}`);
  expect(html).toContain('name="answer_text"');
  expect(html).toContain('value="NOT_STARTED" selected');
  expect(html).toContain('북마크 추가');
  expect(html).toContain('내 답변 저장');
 });
 it('renders the saved answer and progress for its independent record',()=>{
  const html=renderToStaticMarkup(<SavedQuestionControls id="11111111-1111-4111-8111-111111111111" answer="나의 첫 답변" progress={{status:'NEEDS_REVIEW',bookmarked:true}} onMutate={async()=>{}}/>);
  expect(html).toContain('나의 첫 답변');
  expect(html).toContain('value="NEEDS_REVIEW" selected');
  expect(html).toContain('북마크 해제');
 });
});

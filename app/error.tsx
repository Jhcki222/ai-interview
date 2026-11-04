"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <h1>화면을 불러오지 못했어요.</h1>
      <p>잠시 후 다시 시도해 주세요. 작성 중인 답변은 같은 탭에 보관됩니다.</p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}

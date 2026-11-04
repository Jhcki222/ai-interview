import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="empty-state">
      <SearchX size={38} />
      <h1>페이지를 찾을 수 없어요.</h1>
      <p>주소를 확인하거나 질문 목록에서 다시 찾아보세요.</p>
      <Button asChild>
        <Link href="/questions">질문 학습으로 이동</Link>
      </Button>
    </div>
  );
}

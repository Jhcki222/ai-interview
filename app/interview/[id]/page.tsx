import { InterviewWorkspace } from "@/components/interview/interview-workspace";
export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewWorkspace requestedSessionId={id} />;
}

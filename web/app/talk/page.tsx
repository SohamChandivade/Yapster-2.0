import { TalkScreen } from "@/components/talk/TalkScreen";

type TalkPageProps = { searchParams: Promise<{ scenario?: string; session?: string }> };

export default async function TalkPage({ searchParams }: TalkPageProps) {
  const { scenario, session } = await searchParams;
  return <TalkScreen scenario={scenario ?? null} resumeId={session ?? null} />;
}

import { TalkScreen } from "@/components/talk/TalkScreen";

type TalkPageProps = { searchParams: Promise<{ scenario?: string }> };

export default async function TalkPage({ searchParams }: TalkPageProps) {
  const { scenario } = await searchParams;
  return <TalkScreen scenario={scenario ?? null} />;
}

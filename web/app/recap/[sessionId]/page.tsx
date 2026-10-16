import { RecapScreen } from "@/components/recap/RecapScreen";

type RecapPageProps = { params: Promise<{ sessionId: string }> };

export default async function RecapPage({ params }: RecapPageProps) {
  const { sessionId } = await params;
  return <RecapScreen sessionId={sessionId} />;
}

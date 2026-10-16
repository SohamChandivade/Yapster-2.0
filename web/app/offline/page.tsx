import type { Metadata } from "next";
import { OfflineScreen } from "@/components/pwa/OfflineScreen";

export const metadata: Metadata = { title: "Offline · Yapster" };

export default function OfflinePage() {
  return <OfflineScreen />;
}

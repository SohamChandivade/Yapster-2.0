"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { PillLink } from "@/components/ui/Pill";
import { startSession } from "@/lib/auth";

/** Google sends the browser back here via the API, with our token in the URL fragment. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    if (!token) {
      setFailed(true);
      return;
    }
    const onboarded = params.get("onboarded") === "1";
    startSession(token, onboarded);
    window.history.replaceState(null, "", "/auth/callback");
    router.replace(onboarded ? "/" : "/onboarding");
  }, [router]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <Backdrop variant="cool" />
      <Blob size={120} palette="cool" expression={failed ? "sad" : "thinking"} />
      <p className="mt-6 text-[14px] text-ink-muted">
        {failed ? "That sign-in link is missing its token." : "Signing you in…"}
      </p>
      {failed && (
        <PillLink href="/login" variant="glass" className="mt-6">
          Back to log in
        </PillLink>
      )}
    </main>
  );
}

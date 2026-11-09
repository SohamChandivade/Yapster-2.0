"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InstallCard } from "@/components/pwa/InstallCard";
import { Backdrop } from "@/components/ui/Backdrop";
import { GlassCard } from "@/components/ui/GlassCard";
import { ChevronRightIcon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { useMe } from "@/lib/useMe";

const GOAL_LABELS: Record<string, string> = {
  work: "Work",
  living: "Living in Germany",
  travel: "Travel",
  exams: "Exams",
  fun: "Just because",
};

export function ProfileScreen() {
  const router = useRouter();
  const { me } = useMe();
  const [leaving, setLeaving] = useState(false);
  const user = me?.user;
  const name = user?.name ?? "";
  const goals = user?.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ") || "Not set";

  async function logout() {
    setLeaving(true);
    try {
      await api.logout();
    } catch {
      /* the token may already be gone; the cookies go regardless */
    }
    clearSession();
    router.replace("/welcome");
  }

  const rows = [
    { label: "Level", value: user?.level ?? "…" },
    { label: "Goals", value: goals },
    { label: "Tutor", value: user?.tutor_name ?? "Lena" },
    { label: "Voice", value: "German · browser" },
    { label: "Corrections", value: user?.correction_intensity === "normal" ? "Normal" : (user?.correction_intensity ?? "Normal") },
  ];

  return (
    <main
      className="relative mx-auto min-h-dvh max-w-[480px] px-6 pb-36"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <Backdrop variant="cool" />

      <header className="flex items-center justify-between">
  <div className="glass-strong flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-[18px] font-medium">
    {user?.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
    ) : name ? (
      name[0].toUpperCase()
    ) : (
      "·"
    )}
  </div>
</header>

      <h1 className="mt-7 text-[34px] leading-[1.18] font-normal tracking-[-0.025em]">
        {name || "Profile"}
      </h1>
      <p className="mt-2 text-[13px] text-ink-muted">{user?.email ?? "Loading your profile…"}</p>

      <section className="mt-8" aria-label="Appearance">
        <p className="mb-3 text-[12px] text-ink-muted">Appearance</p>
        <GlassCard strong>
          <p className="text-[15px] font-medium">Theme</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">Light is the default. Auto follows your device.</p>
          <ThemeToggle className="mt-4" />
        </GlassCard>
      </section>

      <section className="mt-6" aria-label="Learning">
        <p className="mb-3 text-[12px] text-ink-muted">Learning · editable in milestone 5</p>
        <GlassCard strong padded={false}>
          {rows.map(({ label, value }, i) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${i > 0 ? "border-t border-ink/8" : ""}`}
            >
              <span className="text-[15px] font-medium">{label}</span>
              <span className="flex min-w-0 items-center gap-1 text-right text-[14px] text-ink-muted">
                <span className="truncate">{value}</span>
                <ChevronRightIcon className="h-4 w-4 shrink-0" />
              </span>
            </div>
          ))}
        </GlassCard>
      </section>

      <section className="mt-6" aria-label="App">
        <p className="mb-3 text-[12px] text-ink-muted">App</p>
        <InstallCard />
      </section>

      <section className="mt-6" aria-label="Account">
        <p className="mb-3 text-[12px] text-ink-muted">Account</p>
        <Pill variant="glass" className="w-full" onClick={() => void logout()} disabled={leaving}>
          {leaving ? "Signing out…" : "Log out"}
        </Pill>
        <p className="mt-3 px-1 text-[12px] text-ink-muted">Delete my data will live here too.</p>
      </section>
    </main>
  );
}

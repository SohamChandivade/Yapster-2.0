import { GoogleButton } from "@/components/auth/GoogleButton";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { Glow } from "@/components/ui/Glow";
import { PillLink } from "@/components/ui/Pill";

const features = [
  {
    title: "Real conversations",
    text: "Order bread, argue with a landlord, survive a party. No lesson tree.",
  },
  {
    title: "A tutor who remembers",
    text: "Lena keeps what you tell her and brings it up next time, like a friend would.",
  },
  {
    title: "Notes after, not during",
    text: "Slips are kept quiet while you talk, then handed to you at the end.",
  },
];

/** Landing for signed-out visitors (reference images 3 and 4). */
export default function WelcomePage() {
  return (
    <main
      className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
      }}
    >
      <Backdrop />
      {/* One big blob bleeding off the left edge, as in the Nextly reference */}
      <Glow color="#FF8E5E" to="var(--glow-peach)" size={540} blur={48} opacity={0.85} className="-left-72 top-[110px]" drift={1} />
      <Glow color="var(--glow-sky)" to="var(--glow-lilac)" size={440} blur={48} opacity={0.8} className="-left-52 top-[340px]" drift={3} />

      <header className="relative flex items-center gap-2">
        <Blob size={32} expression="none" />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Yapster</span>
      </header>

      <section className="relative flex flex-1 flex-col justify-center py-6">
        <Blob size={168} expression="happy" className="self-center" />

        <p className="mt-7 text-[12px] text-ink-muted">German practice, spoken daily</p>
        <h1 className="mt-2 text-[36px] leading-[1.1] tracking-[-0.03em]">
          <span className="font-light">Stop studying German.</span>
          <br />
          <span className="font-medium">Start speaking it.</span>
        </h1>
        <p className="mt-4 max-w-[330px] text-[15px] leading-relaxed text-ink-muted">
          A tutor who talks like a friend, remembers what you told her, and keeps the corrections
          for after.
        </p>

        <ul className="no-scrollbar -mx-6 mt-6 flex snap-x gap-2.5 overflow-x-auto px-6" aria-label="What makes it different">
          {features.map((f) => (
            <li key={f.title} className="glass w-[224px] shrink-0 snap-start rounded-card p-4">
              <p className="text-[14px] font-medium">{f.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="relative space-y-2">
        <GoogleButton />
        <div className="flex gap-2">
          <PillLink href="/register" size="lg" className="flex-1">
            Get started
          </PillLink>
          <PillLink href="/login" variant="glass" size="lg">
            Log in
          </PillLink>
        </div>
      </div>
      <p className="relative mt-3 text-center text-[11px] text-ink-muted">
        No lesson tree. No streak guilt. Just talking.
      </p>
    </main>
  );
}

"use client";

import { type FormEvent, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { api, type Help } from "@/lib/api";

type Props = {
  open: boolean;
  sessionId: string | null;
  onClose: () => void;
  onUse: (german: string) => void;
};

/** Type English, get the German, use it. The conversation carries on as if nothing happened. */
export function HelpMeSayThis({ open, sessionId, onClose, onUse }: Props) {
  const [english, setEnglish] = useState("");
  const [result, setResult] = useState<Help | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function translate(e: FormEvent) {
    e.preventDefault();
    if (!sessionId || !english.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.help(sessionId, english.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not translate.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setEnglish("");
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title="Help me say this">
      <form onSubmit={translate}>
        <label htmlFor="help-english" className="text-[12px] text-ink-muted">
          What do you want to say? In English.
        </label>
        <textarea
          id="help-english"
          value={english}
          onChange={(e) => setEnglish(e.target.value)}
          rows={2}
          placeholder="Could I have a bag, please?"
          className="glass mt-2 w-full resize-none rounded-[20px] px-4 py-3 text-[16px] text-ink outline-none placeholder:text-ink-muted/70"
        />
        <Pill type="submit" className="mt-3 w-full" disabled={busy || !english.trim()}>
          {busy ? "Translating…" : "Translate"}
        </Pill>
      </form>
      {error && <p className="mt-3 text-[13px] text-[#C2415F]">{error}</p>}
      {result && (
        <div className="glass mt-4 rounded-card p-4">
          <p className="text-[18px] leading-snug" lang="de">
            {result.german}
          </p>
          {result.note && <p className="mt-2 text-[12px] text-ink-muted">{result.note}</p>}
          <div className="mt-4 flex gap-2">
            <Pill
              className="flex-1"
              onClick={() => {
                onUse(result.german);
                close();
              }}
            >
              Use it
            </Pill>
            <Pill variant="glass" onClick={() => setResult(null)}>
              Try again
            </Pill>
          </div>
        </div>
      )}
    </Sheet>
  );
}

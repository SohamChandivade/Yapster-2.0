import { Backdrop } from "./Backdrop";
import { Blob, type BlobExpression } from "./Blob";

type PlaceholderProps = {
  title: string;
  note: string;
  expression?: BlobExpression;
};

/** Temporary screen for routes that arrive in a later milestone. */
export function Placeholder({ title, note, expression = "thinking" }: PlaceholderProps) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 pb-36 text-center">
      <Backdrop variant="cool" />
      <Blob size={150} expression={expression} palette="cool" />
      <h1 className="mt-10 text-[32px] font-light tracking-[-0.02em]">{title}</h1>
      <p className="mt-3 max-w-[260px] text-[14px] leading-relaxed text-ink-muted">{note}</p>
    </main>
  );
}

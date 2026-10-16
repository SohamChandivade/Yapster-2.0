/**
 * Turns streamed text into speakable sentences. A sentence is emitted only when
 * its end punctuation is followed by whitespace (or at flush), so "4,80 Euro" and
 * "z.B." never split a token.
 */
export class SentenceSplitter {
  private buffer = "";

  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    const re = /[^.!?…]*[.!?…]+["»“”)]?(?=\s)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(this.buffer)) !== null) {
      const sentence = match[0].trim();
      if (sentence) out.push(sentence);
      last = re.lastIndex;
    }
    this.buffer = this.buffer.slice(last).replace(/^\s+/, "");
    return out;
  }

  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest || null;
  }
}

/** Split a complete text at once. */
export function splitSentences(text: string): string[] {
  const s = new SentenceSplitter();
  const out = s.push(text);
  const rest = s.flush();
  if (rest) out.push(rest);
  return out;
}

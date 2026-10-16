"""Pull one string field out of a JSON document while it is still streaming.

The tutor answers with JSON whose first key is "reply_de". Rather than wait for
the whole object, we watch the byte stream, find the key, and emit the decoded
string value character by character so the client can render (and later speak)
the reply as it arrives. The final JSON parse remains authoritative.
"""

_ESCAPES = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "/": "/", "\\": "\\", '"': '"'}


class ReplyExtractor:
    def __init__(self, field: str = "reply_de") -> None:
        self._key = f'"{field}"'
        self._stage = "key"  # key -> colon -> string -> done
        self._buf = ""
        self._escape = False
        self._unicode: str | None = None
        self.text = ""

    @property
    def done(self) -> bool:
        return self._stage == "done"

    def feed(self, chunk: str) -> str:
        """Consume a chunk of raw JSON text; return newly decoded reply text."""
        if self._stage == "done":
            return ""
        if self._stage == "key":
            self._buf += chunk
            idx = self._buf.find(self._key)
            if idx < 0:
                # keep a tail in case the key straddles two chunks
                self._buf = self._buf[-(len(self._key) - 1) :]
                return ""
            chunk = self._buf[idx + len(self._key) :]
            self._buf = ""
            self._stage = "colon"

        out: list[str] = []
        for ch in chunk:
            if self._stage == "colon":
                if ch == '"':
                    self._stage = "string"
                continue
            if self._unicode is not None:
                self._unicode += ch
                if len(self._unicode) == 4:
                    out.append(chr(int(self._unicode, 16)))
                    self._unicode = None
                continue
            if self._escape:
                self._escape = False
                if ch == "u":
                    self._unicode = ""
                else:
                    out.append(_ESCAPES.get(ch, ch))
                continue
            if ch == "\\":
                self._escape = True
                continue
            if ch == '"':
                self._stage = "done"
                break
            out.append(ch)

        piece = "".join(out)
        self.text += piece
        return piece

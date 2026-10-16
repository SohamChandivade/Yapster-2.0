import json

from app.llm.reply_extractor import ReplyExtractor

DOC = {
    "reply_de": 'Hallo! Sagst du "Brötchen"?\nSchön, dich zu sehen, über Übung.',
    "difficulty_signal": 0,
    "silent_corrections": [],
}


def _run(chunks: list[str]) -> tuple[str, bool]:
    ex = ReplyExtractor()
    out = "".join(ex.feed(c) for c in chunks)
    return out, ex.done


def test_whole_document_at_once() -> None:
    text, done = _run([json.dumps(DOC, ensure_ascii=False)])
    assert text == DOC["reply_de"]
    assert done


def test_character_by_character_including_split_key_and_escapes() -> None:
    raw = json.dumps(DOC)  # ensure_ascii=True → ü becomes ü, newline becomes \n
    text, done = _run(list(raw))
    assert text == DOC["reply_de"]
    assert done


def test_ignores_text_after_the_field_closes() -> None:
    ex = ReplyExtractor()
    first = ex.feed('{"reply_de": "Hallo", "silent_corrections": [{"you_said": "x"}]}')
    assert first == "Hallo"
    assert ex.feed(' trailing "junk"') == ""
    assert ex.done


def test_field_not_first_still_found() -> None:
    raw = '{"difficulty_signal": 1, "reply_de": "Guten Tag"}'
    text, done = _run([raw[:10], raw[10:30], raw[30:]])
    assert text == "Guten Tag"
    assert done


def test_nothing_emitted_before_key_arrives() -> None:
    ex = ReplyExtractor()
    assert ex.feed('{"reply_') == ""
    assert ex.feed('de": "Ja') == "Ja"
    assert not ex.done

"""Scenario catalogue. Scripts feed the tutor prompt; markdown scenario files with
phrases and cultural notes arrive with RAG in milestone 4."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Scenario:
    slug: str
    title: str
    blurb: str
    minutes: int
    script: str


_LIST = [
    Scenario(
        "bakery",
        "Bakery",
        "Order bread, ask for a bag, pay.",
        5,
        "You are behind the counter of a small German Bäckerei in the morning; the learner is a "
        "customer. Greet them, ask what they would like, mention what is fresh today, ask about "
        "quantity, slicing or a bag, and take payment. Typical lines: 'Was darf es sein?', "
        "'Sonst noch etwas?', 'Das macht zusammen 4,80.'",
    ),
    Scenario(
        "train",
        "Train ticket",
        "Buy a ticket, ask about the delay.",
        6,
        "You work at a Deutsche Bahn ticket counter; the learner wants to travel today. Ask where "
        "to, when, single or return, which class, whether they have a BahnCard, and mention a "
        "delay or a platform change. Typical lines: 'Wohin möchten Sie?', 'Hin und zurück?', "
        "'Der Zug hat leider zwanzig Minuten Verspätung.'",
    ),
    Scenario(
        "doctor",
        "Doctor",
        "Describe what hurts, book a follow-up.",
        8,
        "You are a friendly Hausärztin/Hausarzt; the learner is a patient. Ask what brings them "
        "in, since when, how bad, ask about symptoms and medication, suggest something simple and "
        "arrange a follow-up. Typical lines: 'Was führt Sie zu mir?', 'Seit wann haben Sie das?', "
        "'Ich schreibe Sie bis Freitag krank.'",
    ),
    Scenario(
        "landlord",
        "Landlord",
        "The heating is broken. Again.",
        8,
        "You are the learner's landlord (Vermieter), a bit grumpy but fair; the learner calls "
        "because the heating is broken again. Be mildly defensive, ask for details, negotiate "
        "when a technician can come, and mention the rent is due. Typical lines: 'Schon wieder?', "
        "'Wann passt es Ihnen?', 'Der Techniker kann erst Donnerstag.'",
    ),
    Scenario(
        "party",
        "Party small talk",
        "Who are you, how do you know the host?",
        7,
        "You are a guest at a friend's house party in Berlin; the learner is another guest you "
        "have just met. Make small talk: how do you know the host, what do you do, where are you "
        "from, how do you like the city, weekend plans. Be curious and informal (du). Typical "
        "lines: 'Woher kennst du Lena?', 'Und was machst du so?', 'Bist du schon lange hier?'",
    ),
    Scenario(
        "interview",
        "Job interview",
        "Introduce yourself, talk about strengths.",
        10,
        "You are an HR manager interviewing the learner for a job in their field. Use formal "
        "address (Sie). Ask them to introduce themselves, about their experience, strengths, a "
        "weakness, why this company, and when they could start. Typical lines: 'Erzählen Sie "
        "mir etwas über sich.', 'Was sind Ihre Stärken?', 'Haben Sie noch Fragen an uns?'",
    ),
    Scenario(
        "free",
        "Free talk",
        "No script. Just talk.",
        10,
        "No fixed situation. You are chatting with a friend over coffee. Follow whatever the "
        "learner brings up; if they bring nothing, ask about their day, their week or something "
        "you know about them.",
    ),
]

SCENARIOS: dict[str, Scenario] = {s.slug: s for s in _LIST}
FREE_TALK = SCENARIOS["free"]


def get_scenario(slug: str | None) -> Scenario:
    return SCENARIOS.get(slug or "free", FREE_TALK)

"""detect_script: which script a sentence is written in (chooses the AI model)."""

import pytest

from app.services.assist.normalize import detect_script

CASES = [
    # English
    ("I need an electrician near me", "latin"),
    ("laptop repair in Hamra", "latin"),
    ("cheap plumber open now", "latin"),
    ("my fridge is not cooling, who can fix it?", "latin"),
    ("I want a dentist, under 20k", "latin"),
    ("math tutor for my son, 15usd per hour", "latin"),
    ("is there a pharmacy near me", "latin"),
    ("3 bedroom cleaning service", "latin"),
    ("plumber within 5km", "latin"),
    ("book a barber for the 2nd of May", "latin"),
    # French
    ("je cherche un plombier pas cher à Jounieh", "latin"),
    ("j'ai besoin d'un électricien ce soir", "latin"),
    ("où trouver une pharmacie ouverte ?", "latin"),
    ("ma voiture est en panne", "latin"),
    ("un mécanicien près de chez moi", "latin"),
    # Arabic
    ("بدي سنكري هلق، في تسريب مي بالمطبخ", "arabic"),
    ("وين في كهربجي قريب مني؟", "arabic"),
    ("بدي ميكانيكي", "arabic"),
    ("دكتور اسنان بالحمرا", "arabic"),
    ("بدي صلح لابتوب", "arabic"),
    # Arabizi with digits
    ("fi 7ada bysalle7 laptop bel hamra?", "arabizi"),
    ("baddé sankari 2arib", "arabizi"),
    ("3am dawwer 3ala mechanic", "arabizi"),
    ("ma3ajim", "arabizi"),
    ("2arib", "arabizi"),
    ("7ada", "arabizi"),
    ("sankari 5ayyat", "arabizi"),
    ("2ostez riyadiyat a2al men 20$ bel se3a", "arabizi"),
    ("tabib asnan 9a7i", "arabizi"),
    ("m3allem 6ayyeb", "arabizi"),
    # Arabizi without digits (two or more common words)
    ("baddi sankari ktir 3ajel", "arabizi"),
    ("shu fi hon", "arabizi"),
    ("kif badde ehki", "arabizi"),
    ("hayda ktir helo", "arabizi"),
    ("bde electrician w plumber", "arabizi"),
    # One common word alone is not enough
    ("ma voiture", "latin"),
    ("el plomero", "latin"),
    ("fi", "latin"),
    ("w", "latin"),
    # One Lebanese word that cannot be English or French is enough
    ("baddi electrician near hamra", "arabizi"),
    ("shu a7san dentist", "arabizi"),
    ("I need a 7akim", "arabizi"),
    # Arabic letters and Latin letters together: not "pure", routed
    ("بدي plumber", "mixed"),
    ("بدي سنكري 2arib", "mixed"),
    ("بدي 7ada يصلح laptop bel hamra", "mixed"),
    ("بدي حدا يصلح AC", "mixed"),
    # Still pure: no letters from the other script, or only one stray letter
    ("بدي سنكري بـ 20$", "arabic"),
    ("بدي سنكري بأقل من ٢٠ دولار", "arabic"),  # Arabic-Indic digits
    ("ﺑﺪﻱ ﺳﻨﻜﺮﻱ", "arabic"),  # presentation forms, typed by some keyboards
    ("بدي سنكري x", "arabic"),
    ("électricien à Jounieh, très urgent", "latin"),
    ("", "latin"),
    ("123 456", "latin"),
    ("👍", "latin"),
]


@pytest.mark.parametrize("text,expected", CASES)
def test_detect_script(text, expected):
    assert detect_script(text) == expected


def test_there_are_at_least_30_examples():
    assert len(CASES) >= 30

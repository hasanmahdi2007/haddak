"""One way to clean up text before comparing or hashing it.

"  Baddé SANKARI  2arib!! " and "badde sankari 2arib" should count as the same
sentence: the same cache entry, the same exact-match check. The rules:
  - lower case;
  - accents removed (é -> e) and Arabic marks removed (vowel signs, and the
    hamza on أ إ آ ؤ ئ, which people type inconsistently);
  - ة -> ه, ى -> ي, ٱ -> ا, and the stretching character ـ removed;
  - punctuation becomes a space; several spaces become one.

The SQL function normalize_name() (migration 0006) does the letter rules
the same way, so a normalised Python text can be compared with
normalize_name(column) in a query.
"""

import hashlib
import unicodedata

# Letters that are not removed by stripping marks, mapped by hand.
LETTER_MAP = str.maketrans({"ة": "ه", "ى": "ي", "ٱ": "ا", "ـ": None})


def normalize_text(value: str) -> str:
    # NFKD splits "é" into "e" + an accent mark, and "أ" into "ا" + a hamza
    # mark. Category "Mn" (mark, non-spacing) is exactly those marks.
    decomposed = unicodedata.normalize("NFKD", value.lower())
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    letters = without_marks.translate(LETTER_MAP)
    # Keep letters and digits (Arabizi uses digits as letters: 2, 3, 7);
    # everything else, like punctuation and emoji, separates words.
    cleaned = "".join(ch if ch.isalnum() else " " for ch in letters)
    return " ".join(cleaned.split())


def text_hash(normalized: str) -> str:
    """SHA-256 of the normalised text: the cache key and the log id.

    A hash lets us recognise a sentence again without storing the sentence.
    """
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

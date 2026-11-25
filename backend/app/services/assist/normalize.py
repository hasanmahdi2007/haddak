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

Arabizi (Lebanese Arabic in Latin letters and digits) needs more: the same
word is typed many ways ("sankari", "sankary", "snkri", "sanakri";
"baddé", "baddi", "bde"). arabizi_word() and skeleton() below give one
spelling for all of them. They are used only by the keyword fallback, never
for the cache key, so changing them never changes a stored hash.
"""

import hashlib
import re
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


# ---------------------------------------------------------------------------
# Arabizi
# ---------------------------------------------------------------------------

# Digits used as Arabic letters. 2 is the glottal stop (ء, or ق as Lebanese
# say it); it is often not typed at all ("2arib" / "arib"), so it is dropped.
ARABIZI_DIGITS = {"2": "", "3": "a", "5": "kh", "6": "t", "7": "h", "8": "gh", "9": "s"}

# Spellings of the same sound, replaced in this order ("ou" before "o").
SPELLING_VARIANTS = [
    ("ee", "i"),  # "tabeeb" = "tabib"
    ("oo", "u"),
    ("ou", "u"),  # "2ostez" / "oustez" / "ustez"
    ("o", "u"),
    ("ch", "sh"),  # "chahr" = "shahr", French spelling
    ("ph", "f"),  # "physique" = "fizik"
    ("q", "k"),  # "qarib" = "karib"
]

# A word that is a number ("20", "500", "20k", "15usd") keeps its digits:
# the price reader needs them.
NUMBER_WORD = re.compile(r"^\d+$|^\d{2,}")

REPEATED_LETTERS = re.compile(r"(.)\1+")

# Letters dropped from the skeleton: vowels, and y / w, which Arabizi uses
# as vowels too ("sayyara", "dawleb").
SKELETON_DROP = set("aeiouyw")


def arabizi_word(word: str) -> str:
    """One spelling for the many ways an Arabizi (or French/English) word is typed.

    "baddé", "baddi", "badde", "baddddé" -> "bade"
    "2ostez", "ostez", "oustez"         -> "ustez"
    "sankari", "sankary", "sannkari"    -> "sankare"
    "7akim" -> "hakim", "5ayyat" -> "khayat", "3oud" -> "aud"

    Arabic-script words and numbers come back unchanged.
    """
    word = normalize_text(word).replace(" ", "")
    if not word.isascii() or NUMBER_WORD.match(word) or not any(ch.isalpha() for ch in word):
        return word
    # A final "h" after a vowel is not pronounced: "jounieh", "knafeh".
    if len(word) > 3 and word[-1] == "h" and word[-2] in "ae":
        word = word[:-1]
    word = "".join(ARABIZI_DIGITS.get(ch, ch) for ch in word)
    for written, same_as in SPELLING_VARIANTS:
        word = word.replace(written, same_as)
    # People double letters freely ("baddddé", "sannkari", "m3allme"):
    # any repeated letter counts once.
    word = REPEATED_LETTERS.sub(r"\1", word)
    # A final i / y / e is the same sound in Lebanese: "baddi" = "badde".
    if len(word) >= 3 and word[-1] in "iy":
        word = word[:-1] + "e"
    return word


def skeleton(word: str) -> str:
    """The consonants of a word, for fuzzy matching.

    Arabizi has no fixed vowels: "sankari", "sankary", "snkri" and "sanakri"
    all become "snkr". Only Latin words have a skeleton; others return "".
    """
    canonical = arabizi_word(word)
    if not canonical.isascii() or NUMBER_WORD.match(canonical):
        return ""
    return "".join(ch for ch in canonical if ch not in SKELETON_DROP)


# ---------------------------------------------------------------------------
# Which script is the sentence in? (used to choose the AI model)
# ---------------------------------------------------------------------------

# A digit used as an Arabic letter, touching Latin letters: "7ada", "ma3ajim".
DIGIT_IN_WORD = re.compile(r"[a-z][235679]|[235679][a-z]|[a-z]8[a-z]|^8[a-z]|[a-z]8$")
# Numbers with a unit are not Arabizi: "20k", "15usd", "2nd", "5km".
NUMBER_WITH_UNIT = re.compile(r"^\d+(k|usd|lbp|eur|m|km|h|hr|hrs|min|st|nd|rd|th|d|pm)$")
# Lebanese Arabizi words with no digits. These cannot be English or French,
# so one of them is enough: "baddi electrician" is Arabizi.
ARABIZI_WORDS = {
    "baddi", "badde", "bade", "bde", "badna", "baddak", "baddek", "shu", "shou",
    "kifak", "kifik", "hayda", "hayde", "ktir", "kteer", "hala2", "halla2", "halla",
    "hallaq", "mni7", "mnih", "ya3ni", "yaani", "inshallah", "habibi", "wein",
    "bdi", "bede", "bedde", "ebne", "ebni", "wled", "maksoura", "maksour", "daroure",
    "darouri", "faddye", "tlifon", "sayyara", "sayyarte", "ostez", "oustez", "drous",
    "dourous", "khsousi", "sankari", "sankary", "kahrabji", "dahhan", "ydahhenli",
}  # fmt: skip
# Short words that are Arabizi but also French, Spanish or English ("ma",
# "el", "fi", "w", "hon"): only two or more of them (or with one word above)
# make a sentence Arabizi, so "ma voiture" stays French.
ARABIZI_SHORT_WORDS = {
    "fi", "ma", "el", "w", "bel", "lal", "hon", "hek", "shi", "mish", "aktar",
    "wen", "kaman", "kif", "sho", "bl",
}  # fmt: skip
MIN_SHORT_WORDS = 2


def is_arabic_letter(ch: str) -> bool:
    """A letter from one of Unicode's Arabic blocks: Arabic (U+0600-06FF),
    Arabic Supplement (U+0750-077F), Arabic Extended-A (U+08A0-08FF) and the
    two presentation-form blocks (U+FB50-FDFF, U+FE70-FEFF) that some
    keyboards still type. Arabic-Indic digits (٠-٩) are not letters."""
    code = ord(ch)
    in_block = (
        0x0600 <= code <= 0x06FF
        or 0x0750 <= code <= 0x077F
        or 0x08A0 <= code <= 0x08FF
        or 0xFB50 <= code <= 0xFDFF
        or 0xFE70 <= code <= 0xFEFF
    )
    return in_block and ch.isalpha()


def is_latin_letter(ch: str) -> bool:
    """A-Z, a-z and the accented Latin letters French uses (é, à, ç ...):
    Unicode's Latin blocks run from U+0041 to U+024F."""
    return ch.isalpha() and ord(ch) <= 0x024F


def detect_script(text: str) -> str:
    """ "arabic", "latin", "arabizi" or "mixed", from the characters alone
    (no AI). It chooses the AI model: arabic and latin are "pure" and go to
    ASSIST_MODEL; arabizi and mixed go to ASSIST_MODEL_ARABIZI.

    - mixed: both Arabic letters and Latin letters, at least 2 of each
      ("بدي plumber", "بدي سنكري 2arib"); one stray letter does not count;
    - arabic: Arabic letters only (digits, $ and emoji do not matter);
    - arabizi: Latin letters with a digit used as a letter inside a word
      ("7ada", "3am", "2arib"), or one Lebanese word that cannot be English
      or French ("baddi", "shu", "ktir"), or two short ones ("shu fi hon");
    - latin: everything else (English, French, numbers, empty).
    """
    arabic_letters = sum(1 for ch in text if is_arabic_letter(ch))
    latin_letters = sum(1 for ch in text if is_latin_letter(ch))
    if arabic_letters >= 2 and latin_letters >= 2:
        return "mixed"
    if arabic_letters > latin_letters:
        return "arabic"

    # Plain spelling only: "baddé" -> "badde", punctuation -> space.
    words = normalize_text(text).split()
    short = 0
    for word in words:
        if not word.isascii() or NUMBER_WITH_UNIT.match(word):
            continue
        if DIGIT_IN_WORD.search(word) or word in ARABIZI_WORDS:
            return "arabizi"
        if word in ARABIZI_SHORT_WORDS:
            short += 1
    if short >= MIN_SHORT_WORDS:
        return "arabizi"
    return "latin"

"""Places and the assistant's tables.

- Extension pg_trgm, for fuzzy ("similar spelling") place lookup.
- Function normalize_name(text): lower case, plain Arabic letters, no accents.
  Python does the same in app/services/assist/normalize.py.
- New table places: towns and neighbourhoods the assistant can centre a search
  on ("a plumber in Jounieh"), with a first hand-made list of about 60 rows.
- New table assist_cache: remembered AI answers, keyed by a hash of the text.
- New table assist_log: one row per assistant request (tokens, cost, no user id).
The SQL matches docs/SCHEMA.md.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# The first list of places.
#
# COORDINATES ARE APPROXIMATE (hand-placed centres, good to a few hundred
# metres). They are to be replaced by a GeoNames import (free, CC BY; the app
# must then show the credit). Aliases are other spellings people type:
# Arabizi, French, with or without "el", Arabic variants.
#
# Columns: slug, English name, Arabic name, aliases, kind, district,
#          latitude, longitude, radius in metres (how wide the place is).
# Two rows named "Jdeideh" on purpose: they are different towns in different
# districts, and the assistant must ask which one is meant.
# ---------------------------------------------------------------------------
PLACES = [
    # --- cities and towns ---
    ("beirut", "Beirut", "بيروت", ["beyrouth", "bayrut", "bayrout", "beyrout", "birut"], "city", "Beirut", 33.8938, 35.5018, 5000),
    ("tripoli", "Tripoli", "طرابلس", ["trablos", "trablous", "tarablus", "tripoli liban"], "city", "Tripoli", 34.4367, 35.8497, 5000),
    ("saida", "Saida", "صيدا", ["sidon", "sayda", "saida city", "seida", "saïda"], "city", "Saida", 33.5571, 35.3729, 4000),
    ("tyre", "Tyre", "صور", ["sour", "sur", "tyr", "soor"], "city", "Tyre", 33.2705, 35.2038, 4000),
    ("jounieh", "Jounieh", "جونية", ["jounie", "jouniyeh", "jounyeh", "junieh", "jouniye", "جونيه"], "city", "Keserwan", 33.9808, 35.6178, 4000),
    ("zahle", "Zahle", "زحلة", ["zahleh", "zahlé", "zahli", "zahlee"], "city", "Zahle", 33.8497, 35.9042, 4000),
    ("byblos", "Byblos", "جبيل", ["jbeil", "jbail", "jubayl", "jbayl", "jbeil byblos"], "city", "Jbeil", 34.1230, 35.6519, 3000),
    ("baalbek", "Baalbek", "بعلبك", ["baalback", "ba3albak", "baalbeck", "baalbak", "ba3lbak"], "city", "Baalbek", 34.0058, 36.2181, 4000),
    ("nabatieh", "Nabatieh", "النبطية", ["nabatiyeh", "nabatiye", "nabatiyah", "nabatiyé", "nabatyeh"], "city", "Nabatieh", 33.3772, 35.4836, 4000),
    ("aley", "Aley", "عاليه", ["alay", "3aley", "aaley", "3alay"], "town", "Aley", 33.8053, 35.6006, 3000),
    ("batroun", "Batroun", "البترون", ["batrun", "el batroun", "batroûn"], "town", "Batroun", 34.2553, 35.6581, 3000),
    ("broummana", "Broummana", "برمانا", ["brummana", "broumana", "broummana", "brumana"], "town", "Matn", 33.8833, 35.6206, 2000),
    ("bikfaya", "Bikfaya", "بكفيا", ["bickfaya", "bekfaya", "bikfaiya"], "town", "Matn", 33.9228, 35.6814, 2000),
    ("jdeideh-metn", "Jdeideh", "الجديدة", ["jdeide", "jdaideh", "el jdeideh", "jdeidet el metn", "jdeideh metn"], "town", "Matn", 33.8925, 35.5603, 1500),
    ("jdeideh-marjayoun", "Jdeideh", "جديدة مرجعيون", ["jdeide", "jdeidet marjayoun", "jdeidet marjeyoun", "jdeideh marjayoun"], "town", "Marjayoun", 33.3640, 35.5860, 2000),
    ("zgharta", "Zgharta", "زغرتا", ["zghorta", "zgharta ehden"], "town", "Zgharta", 34.3972, 35.8939, 2500),
    ("ehden", "Ehden", "إهدن", ["ehdin", "ihdin"], "town", "Zgharta", 34.3110, 35.9950, 2000),
    ("bcharre", "Bcharre", "بشري", ["bsharri", "bcharreh", "bsharre", "becharre", "bcharré"], "town", "Bcharre", 34.2508, 36.0117, 2500),
    ("chtaura", "Chtaura", "شتورا", ["chtoura", "shtaura", "shtoura", "شتورة"], "town", "Zahle", 33.8139, 35.8519, 2000),
    ("anjar", "Anjar", "عنجر", ["3anjar", "aanjar"], "town", "Zahle", 33.7300, 35.9300, 2000),
    ("halba", "Halba", "حلبا", ["7alba"], "town", "Akkar", 34.5428, 36.0797, 2500),
    ("hermel", "Hermel", "الهرمل", ["hermil", "el hermel"], "town", "Hermel", 34.3942, 36.3844, 3000),
    ("jezzine", "Jezzine", "جزين", ["jezzin", "jizzine", "jezzîne"], "town", "Jezzine", 33.5431, 35.5847, 2500),
    ("bint-jbeil", "Bint Jbeil", "بنت جبيل", ["bent jbeil", "bint jbail", "bintjbeil"], "town", "Bint Jbeil", 33.1208, 35.4331, 2500),
    ("marjayoun", "Marjayoun", "مرجعيون", ["marjeyoun", "marj3youn", "marjayoûn"], "town", "Marjayoun", 33.3606, 35.5911, 2500),
    ("hasbaya", "Hasbaya", "حاصبيا", ["hasbaiya", "7asbaya"], "town", "Hasbaya", 33.3980, 35.6850, 2000),
    ("rashaya", "Rashaya", "راشيا", ["rachaya", "rashaya el wadi"], "town", "Rashaya", 33.5000, 35.8430, 2000),
    ("damour", "Damour", "الدامور", ["el damour", "damor"], "town", "Chouf", 33.7317, 35.4569, 2500),
    ("beiteddine", "Beiteddine", "بيت الدين", ["beit eddine", "beit el din", "beiteddin", "beit ed dine"], "town", "Chouf", 33.6950, 35.5800, 2000),
    ("amchit", "Amchit", "عمشيت", ["3amchit", "amshit"], "town", "Jbeil", 34.1500, 35.6400, 2000),
    ("chekka", "Chekka", "شكا", ["shekka", "chikka"], "town", "Batroun", 34.3240, 35.7280, 2000),
    ("ghazir", "Ghazir", "غزير", ["ghazeer"], "town", "Keserwan", 34.0170, 35.6620, 1500),
    ("harissa", "Harissa", "حريصا", ["7arissa", "harrissa"], "town", "Keserwan", 33.9820, 35.6440, 1500),
    ("faraya", "Faraya", "فاريا", ["faraiya", "fariya"], "town", "Keserwan", 34.0050, 35.8240, 2500),
    ("kaslik", "Kaslik", "الكسليك", ["kaslek", "el kaslik"], "neighbourhood", "Keserwan", 33.9730, 35.6070, 1500),
    ("zouk-mosbeh", "Zouk Mosbeh", "ذوق مصبح", ["zouk mosbeh", "zouk mesbeh", "zouk mosbe"], "town", "Keserwan", 33.9500, 35.6100, 1500),
    ("dbayeh", "Dbayeh", "ضبية", ["dbaye", "dbayyeh", "dbayé"], "town", "Matn", 33.9360, 35.5900, 2000),
    ("antelias", "Antelias", "أنطلياس", ["antilias", "antelyas", "antélias"], "town", "Matn", 33.9139, 35.5872, 1500),
    ("jal-el-dib", "Jal el Dib", "جل الديب", ["jal eddib", "jall el dib", "jal el deeb"], "town", "Matn", 33.9100, 35.5800, 1200),
    ("zalka", "Zalka", "الزلقا", ["zalqa", "el zalka"], "town", "Matn", 33.9050, 35.5750, 1500),
    ("mansourieh", "Mansourieh", "المنصورية", ["mansouriyeh", "mansouriye", "el mansourieh"], "town", "Matn", 33.8580, 35.5650, 1500),
    ("beit-mery", "Beit Mery", "بيت مري", ["beit meri", "beit miri"], "town", "Matn", 33.8560, 35.5950, 1500),
    ("hadath", "Hadath", "الحدث", ["hadat", "el hadath", "hadas", "7adath", "7adas"], "town", "Baabda", 33.8400, 35.5340, 2000),
    ("baabda", "Baabda", "بعبدا", ["ba3bda", "baabdat"], "town", "Baabda", 33.8339, 35.5442, 2000),
    ("kfarshima", "Kfarshima", "كفرشيما", ["kfar shima", "kfarchima"], "town", "Baabda", 33.8250, 35.5300, 1500),
    ("choueifat", "Choueifat", "الشويفات", ["shweifat", "chouaifat", "choueifet", "shwayfat"], "town", "Aley", 33.8072, 35.5122, 3000),
    ("khalde", "Khalde", "خلدة", ["khaldeh", "khalda", "khaldé"], "town", "Aley", 33.7760, 35.4790, 2000),
    ("aramoun", "Aramoun", "عرمون", ["3aramoun", "aramun"], "town", "Aley", 33.7750, 35.5000, 2000),
    ("bhamdoun", "Bhamdoun", "بحمدون", ["bhamdun", "b7amdoun"], "town", "Aley", 33.8000, 35.6500, 2500),
    # --- Beirut neighbourhoods ---
    ("hamra", "Hamra", "الحمرا", ["el hamra", "hamra street", "al hamra", "الحمراء", "شارع الحمرا"], "neighbourhood", "Beirut", 33.8960, 35.4820, 1000),
    ("achrafieh", "Achrafieh", "الأشرفية", ["ashrafieh", "achrafiye", "ashrafiyeh", "ashrafiye", "achrafié", "ashrafiya"], "neighbourhood", "Beirut", 33.8880, 35.5200, 1500),
    ("verdun", "Verdun", "فردان", ["fardan", "verdan"], "neighbourhood", "Beirut", 33.8850, 35.4840, 1000),
    ("gemmayzeh", "Gemmayzeh", "الجميزة", ["gemmayze", "jemmayzeh", "gemayzeh", "jmeizeh", "jemmayze"], "neighbourhood", "Beirut", 33.8956, 35.5164, 700),
    ("mar-mikhael", "Mar Mikhael", "مار مخايل", ["mar mkhayel", "mar mikhail", "mar michael", "mar mkhael", "مار مخائيل"], "neighbourhood", "Beirut", 33.8975, 35.5245, 700),
    ("badaro", "Badaro", "بدارو", ["badaro street", "badarou"], "neighbourhood", "Beirut", 33.8730, 35.5120, 800),
    ("ras-beirut", "Ras Beirut", "رأس بيروت", ["ras bayrut", "ras beyrouth"], "neighbourhood", "Beirut", 33.8990, 35.4780, 1000),
    ("raouche", "Raouche", "الروشة", ["rawcheh", "rawshe", "raouché", "rawsheh"], "neighbourhood", "Beirut", 33.8890, 35.4750, 800),
    ("downtown-beirut", "Downtown Beirut", "وسط بيروت", ["downtown", "centre ville", "solidere", "wasat beirut", "el balad", "البلد", "وسط البلد"], "neighbourhood", "Beirut", 33.8960, 35.5050, 1000),
    ("mar-elias", "Mar Elias", "مار الياس", ["mar elias street", "mar elyas", "mar elie"], "neighbourhood", "Beirut", 33.8820, 35.4860, 800),
    ("ain-el-mreisseh", "Ain el Mreisseh", "عين المريسة", ["ain el mraiseh", "3ein el mreisseh", "ain mreisseh", "ain el mreisse"], "neighbourhood", "Beirut", 33.9010, 35.4920, 700),
    ("mazraa", "Mazraa", "المزرعة", ["mazra3a", "el mazraa", "mazra3"], "neighbourhood", "Beirut", 33.8790, 35.4950, 1000),
    ("tariq-el-jdideh", "Tariq el Jdideh", "طريق الجديدة", ["tarik el jdide", "tare2 el jdide", "tariq al jadida", "tarik jdideh"], "neighbourhood", "Beirut", 33.8710, 35.4930, 1000),
    ("jnah", "Jnah", "الجناح", ["el jnah", "janah"], "neighbourhood", "Beirut", 33.8600, 35.4860, 1000),
    # --- southern suburbs (Dahieh) and the eastern edge of Beirut ---
    ("dahieh", "Dahieh", "الضاحية", ["dahiyeh", "dahye", "da7ye", "dahiye", "el dahye", "southern suburbs", "الضاحية الجنوبية", "ضاحية"], "neighbourhood", "Baabda", 33.8550, 35.5050, 3000),
    ("haret-hreik", "Haret Hreik", "حارة حريك", ["haret 7reik", "haret hrek", "7aret 7reik", "haret hreyk", "hart hreik"], "neighbourhood", "Baabda", 33.8547, 35.5097, 1000),
    ("ghobeiry", "Ghobeiry", "الغبيري", ["ghbeiry", "ghobeyri", "ghobairy", "ghbairi"], "neighbourhood", "Baabda", 33.8620, 35.4980, 1500),
    ("chiyah", "Chiyah", "الشياح", ["chiah", "shiyah", "chiyeh", "chiyah"], "neighbourhood", "Baabda", 33.8620, 35.5200, 1000),
    ("bir-el-abed", "Bir el Abed", "بئر العبد", ["bir el 3abed", "bir al abed", "bir el abd", "بير العبد"], "neighbourhood", "Baabda", 33.8580, 35.5130, 700),
    ("rouweiss", "Rouweiss", "الرويس", ["rweiss", "ruways", "rwais", "rouaiss"], "neighbourhood", "Baabda", 33.8480, 35.5115, 700),
    ("bourj-el-barajneh", "Bourj el Barajneh", "برج البراجنة", ["borj el barajneh", "burj al barajneh", "borj barajne", "bourj barajneh"], "neighbourhood", "Baabda", 33.8460, 35.5040, 1500),
    ("mreijeh", "Mreijeh", "المريجة", ["mreije", "mraijeh", "el mreijeh"], "neighbourhood", "Baabda", 33.8430, 35.5160, 1000),
    ("bir-hassan", "Bir Hassan", "بئر حسن", ["bir 7asan", "bir hasan", "بير حسن"], "neighbourhood", "Baabda", 33.8640, 35.4930, 1000),
    ("laylaki", "Laylaki", "الليلكي", ["lailaki", "leylaki", "el laylaki"], "neighbourhood", "Baabda", 33.8390, 35.5200, 800),
    ("ouzai", "Ouzai", "الأوزاعي", ["awzai", "el ouzai", "ouzaii", "ouzaï"], "neighbourhood", "Baabda", 33.8470, 35.4880, 1500),
    ("hay-el-sellom", "Hay el Sellom", "حي السلم", ["hay el selom", "7ay el sellom", "hay al sullam", "hay el sollom"], "neighbourhood", "Aley", 33.8300, 35.5000, 1500),
    ("furn-el-chebbak", "Furn el Chebbak", "فرن الشباك", ["forn el chebbak", "furn el shebbak", "forn el shebbek"], "neighbourhood", "Baabda", 33.8720, 35.5240, 800),
    ("ain-el-remmaneh", "Ain el Remmaneh", "عين الرمانة", ["ain el remmane", "3ein el remmeneh", "ain al rummaneh", "ain remmaneh"], "neighbourhood", "Baabda", 33.8660, 35.5250, 800),
    ("hazmieh", "Hazmieh", "الحازمية", ["hazmiyeh", "hazmiye", "hazmié", "el hazmieh"], "neighbourhood", "Baabda", 33.8510, 35.5410, 1500),
    ("sin-el-fil", "Sin el Fil", "سن الفيل", ["sinn el fil", "sin el feel", "sin elfil", "sinn al fil"], "neighbourhood", "Matn", 33.8710, 35.5330, 1500),
    ("dekwaneh", "Dekwaneh", "الدكوانة", ["dekwane", "dekweneh", "dikwaneh"], "neighbourhood", "Matn", 33.8780, 35.5450, 1500),
    ("bourj-hammoud", "Bourj Hammoud", "برج حمود", ["borj hammoud", "bourj hamoud", "burj hammud", "borj 7ammoud"], "neighbourhood", "Matn", 33.8925, 35.5383, 1500),
]  # fmt: skip


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Used on both sides of every place comparison, so "Achrafié", "achrafie"
    # and "ACHRAFIE" all compare equal, and so do Arabic spellings with or
    # without hamza. translate() swaps each character of the 2nd text for the
    # one at the same position in the 3rd; characters with no partner (the
    # Arabic tatweel at the end) are deleted. IMMUTABLE lets an index use it.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION normalize_name(value TEXT) RETURNS TEXT
        LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
        AS $$
            SELECT lower(translate(value,
                'أإآٱؤئةىéèêëàâäáôöóûüùúîïíçÉÈÊÀÂÔÛÎÇـ',
                'ااااويهيeeeeaaaaooouuuuiiiceeeaaouic'))
        $$
        """
    )

    op.execute(
        """
        CREATE TABLE places (
            id          SERIAL PRIMARY KEY,
            slug        TEXT NOT NULL UNIQUE,
            name_en     TEXT NOT NULL,
            name_ar     TEXT NOT NULL,
            aliases     TEXT[] NOT NULL DEFAULT '{}',
            kind        TEXT NOT NULL CHECK (kind IN ('city', 'town', 'neighbourhood')),
            district    TEXT NOT NULL,
            location    GEOGRAPHY(Point, 4326) NOT NULL,
            radius_m    INTEGER NOT NULL CHECK (radius_m BETWEEN 100 AND 50000)
        )
        """
    )
    # Trigram index: lets similarity searches ("jouneih" ~ "Jounieh") use an
    # index instead of reading every row once the list grows (GeoNames import).
    op.execute(
        "CREATE INDEX places_name_en_trgm_idx ON places "
        "USING GIN (normalize_name(name_en) gin_trgm_ops)"
    )

    insert = sa.text(
        """
        INSERT INTO places (slug, name_en, name_ar, aliases, kind, district, location, radius_m)
        VALUES (:slug, :name_en, :name_ar, :aliases, :kind, :district,
                ST_GeogFromText(:point), :radius_m)
        """
    )
    rows = [
        {
            "slug": slug,
            "name_en": name_en,
            "name_ar": name_ar,
            "aliases": aliases,
            "kind": kind,
            "district": district,
            # PostGIS wants longitude first.
            "point": f"SRID=4326;POINT({lng} {lat})",
            "radius_m": radius_m,
        }
        for slug, name_en, name_ar, aliases, kind, district, lat, lng, radius_m in PLACES
    ]
    op.get_bind().execute(insert, rows)

    # Remembered AI answers. Only a hash of the sentence is stored, not the text.
    op.execute(
        """
        CREATE TABLE assist_cache (
            text_hash   TEXT PRIMARY KEY,
            result      JSONB NOT NULL,
            model       TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    # One row per assistant request. No user id and no IP address.
    op.execute(
        """
        CREATE TABLE assist_log (
            id                  BIGSERIAL PRIMARY KEY,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            source              TEXT NOT NULL CHECK (source IN ('ai', 'cache', 'direct')),
            model               TEXT,
            input_tokens        INTEGER NOT NULL DEFAULT 0,
            output_tokens       INTEGER NOT NULL DEFAULT 0,
            cache_read_tokens   INTEGER NOT NULL DEFAULT 0,
            cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
            cost_usd            NUMERIC(10, 6) NOT NULL DEFAULT 0,
            kind                TEXT NOT NULL,
            text_hash           TEXT NOT NULL,
            wanted_text         TEXT,
            place_unknown       TEXT
        )
        """
    )
    op.execute("CREATE INDEX assist_log_created_idx ON assist_log (created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE assist_log")
    op.execute("DROP TABLE assist_cache")
    op.execute("DROP TABLE places")
    op.execute("DROP FUNCTION IF EXISTS normalize_name(TEXT)")
    # pg_trgm is left installed: other things may use it, and it is harmless.

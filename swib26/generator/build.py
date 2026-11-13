"""Build the SWIB26 exercises: for each example a page (swib26/<page>.html), a start file for the
participants (swib26/start/<page>.ttl: agents and manifestations, nothing linking a manifestation to
what it embodies) and the complete model (swib26/solutions/<page>.ttl).

Manifestation data comes from the MARC 21 records in swib26/marc (fetch_marc.py); works and
expressions are stated here.
"""
import html
import pathlib
import re
import xml.etree.ElementTree as ET

from selection import SELECTION

ROOT = pathlib.Path(__file__).parents[1]
# File name of each example's page and Turtle files
PAGES = {"Cataloguing": "cataloguing", "TranslationsAckroyd": "translations-christie", "RelationshipsLittleWomen": "relationships-little-women",
         "CollectionsTolkien": "collections-tolkien"}
# Classes and links kept in the start files
START_CLASSES = {"rdac:C10004", "rdac:C10005", "rdac:C10007"}
# Relationships left out of the start files: what a manifestation embodies, and whole/part and other
# relationships between works and between expressions
START_DROPPED = {"rdamo:P30139", "rdawo:P10147", "rdaeo:P20145", "rdawo:P10187"}
M = "{http://www.loc.gov/MARC21/slim}"
LANG = "http://id.loc.gov/vocabulary/iso639-2/"
CT = "<http://rdaregistry.info/termList/RDAContentType/{}>"
MT = "<http://rdaregistry.info/termList/RDAMediaType/{}>"
CA = "<http://rdaregistry.info/termList/RDACarrierType/{}>"
NTSF = "<https://id.nb.no/vocabulary/ntsf/{}>"
TEXT, STILL, SPOKEN, MOVING, MUSIC, NOTATED = "1020", "1014", "1013", "1023", "1011", "1010"
UNMEDIATED, AUDIO, VIDEO = "1007", "1001", "1008"
VOLUME, AUDIODISC, VIDEODISC = "1049", "1004", "1060"

# Publications linked to another catalogue than the one the data comes from
RECORD_LINKS = {
    "eng-harper-2002": ("https://catalogue.bl.uk/permalink/44BL_MAIN/195da65/alma990093804890109251", "British Library"),
    # the British Library does not display its own record of this set; Cambridge has the same description
    "lotr-companion-set-2014": ("https://idiscover.lib.cam.ac.uk/discovery/fulldisplay?docid=alma9958399173403606"
                                "&context=L&vid=44CAM_INST:44CAM_PROD&lang=en", "Cambridge University Library"),
}

# VIAF clusters, found through Wikidata and VIAF's own search; where VIAF has several clusters for
# one person or work, the first is used
VIAF = {
    "cataloguing": {
        "agent/adichie": "87194517",
        "agent/atkinson": "59219639",
        "agent/barnes": "51710796",
        "agent/child": "100304282",
        "agent/cleeves": "40585642",
        "agent/coben": "116846308",
        "agent/connelly": "19745715",
        "agent/egan": "56717951",
        "agent/flynn": "103168327",
        "agent/french": "149427877",
        "agent/hawkins": "14277202",
        "agent/herron": "24546389",
        "agent/hosseini": "98912036",
        "agent/kingsolver": "79097759",
        "agent/lahiri": "100885199",
        "agent/lehane": "10004693",
        "agent/levy": "74098174",
        "agent/lippman": "85629402",
        "agent/mantel": "44415775",
        "agent/martel": "85372278",
        "agent/mcewan": "109587997",
        "agent/ng": "20146635715841982875",
        "agent/osman": "310665412",
        "agent/owens": "110347652",
        "agent/penny": "79555703",
        "agent/rankin": "76462000",
        "agent/rooney": "49149912708206212971",
        "agent/slaughter": "56832090",
        "agent/smith": "14951645",
        "agent/strout": "66631918",
        "work/adichie": "305113980",
        "work/connelly": "180944535",
        "work/egan": "6720151474916500490009",
        "work/hawkins": "317270260",
        "work/hosseini": "220035581",
        "work/kingsolver": "342170292134077690001",
        "work/lahiri": "207953409",
        "work/mantel": "308112483",
        "work/mcewan": "195844162",
        "work/ng": "316872346",
        "work/slaughter": "1175145424652986831400",
    },
    "ackroyd": {
        "agent/christie": "71388952", "agent/arentz": "179147423157144881771", "agent/frisch": "229606047",
        "agent/puetsch": "22576440", "agent/mundhenk": "104727766", "agent/christensen": "19145971391132330928",
        "agent/kafka": "2940916", "work/novel": "217048217", "work/announced": "181004220",
    },
    "littlewomen-relationships": {
        "agent/alcott": "29528997", "agent/terciero": "5141154923707663780000",
        "agent/indigo": "33154921207663590177", "agent/asher": "43130453", "agent/adamo": "51306277",
        "agent/gerwig": "169433365", "agent/ronan": "166139052",
        "work/novel": "174058143", "work/part2": "183030696", "work/graphic": "3082160310483258300009", "work/opera": "306113684",
        "work/film2019": "80167863629422740114",
    },
    "tolkien-collections": {
        "agent/tolkien": "95218067", "work/treeleaf": "312366212",
        "work/bombadil": "184649660", "work/perilous": "206154501846639210009", "work/giles": "275497244",
        "work/smith": "312339051", "work/niggle": "178224870", "work/fairy": "180202865",
        "work/homecoming": "184640748", "work/poem10": "175850039", "work/hobbit": "309569545",
        "work/lotr": "184093601", "work/fellowship": "185888925", "work/towers": "186301504",
        "work/king": "306062885", "work/companion": "9014152502908610800009", "agent/hammond": "59153962",
        "agent/scull": "54260077",
    },
}
# Works whose VIAF identifier the data keeps but the page does not list: which collections are works
# of their own is part of the exercise, and listing them would give it away. The page lists the
# distinct texts only
VIAF_NOT_LISTED = {
    "tolkien-collections": {"work/treeleaf", "work/bombadil", "work/perilous", "work/poem10"},
}

# Identifier for person / identifier for work
VIAF_PROPERTY = {"agent": "rdaad:P50094", "work": "rdawd:P10002"}

PREFIXES = """@prefix entedit: <http://oslomet.no/abi/vocab#> .
@prefix rdaad: <http://rdaregistry.info/Elements/a/datatype/> .
@prefix rdac: <http://rdaregistry.info/Elements/c/> .
@prefix rdaed: <http://rdaregistry.info/Elements/e/datatype/> .
@prefix rdaeo: <http://rdaregistry.info/Elements/e/object/> .
@prefix rdamd: <http://rdaregistry.info/Elements/m/datatype/> .
@prefix rdamo: <http://rdaregistry.info/Elements/m/object/> .
@prefix rdawd: <http://rdaregistry.info/Elements/w/datatype/> .
@prefix rdawo: <http://rdaregistry.info/Elements/w/object/> .
@prefix rdaxd: <http://rdaregistry.info/Elements/x/datatype/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix vtp: <https://schema.nb.no/Bibliographic/Values/> .
"""


def lit(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def clean(s):
    """Strip ISBD punctuation that closes a MARC subfield, and MARC non-sort marks."""
    s = re.sub("[\x88\x89\x98\x9c]", "", s or "").strip()
    return re.sub(r"\s*[/:;,=]$", "", s).strip()


def subs(rec, tag, code):
    return [clean(s.text) for d in rec.findall(f"{M}datafield[@tag='{tag}']")
            for s in d if s.get("code") == code]


def first(rec, tag, code):
    return (subs(rec, tag, code) + [None])[0]


def pub(rec, code):
    return first(rec, "264", code) or first(rec, "260", code)


def description(rec):
    """The fields the manifestation and the ISBD line are made from."""
    date = pub(rec, "c")
    title, other = first(rec, "245", "a"), first(rec, "245", "b")
    raw = rec.find(f"{M}datafield[@tag='245']/{M}subfield[@code='a']").text.strip()
    if raw.endswith(";") and other:  # no collective title: the titles follow one another
        title, other = f"{title} ; {other}", None
    return {
        "title": title, "other": other, "resp": (first(rec, "245", "c") or "").rstrip(".") or None,
        "edition": first(rec, "250", "a"), "place": pub(rec, "a"), "publisher": pub(rec, "b"),
        "date": date and date.rstrip("."),
        "extent": " : ".join(x for x in (first(rec, "300", "a"), first(rec, "300", "b")) if x),
        "dims": first(rec, "300", "c"),
        "series": subs(rec, "490", "a") + subs(rec, "440", "a"),
        "isbn": (re.sub(r"\s.*", "", first(rec, "020", "a") or "") or None),
    }


def isbd(d):
    title = d["title"] + (f" : {d['other']}" if d["other"] else "") + (f" / {d['resp']}" if d["resp"] else "")
    parts = [title]
    if d["edition"]:
        parts.append(d["edition"])
    parts.append(f"{d['place'] or '[S.l.]'} : {d['publisher']}, {d['date']}")
    parts.append(d["extent"] + (f" ; {d['dims']}" if d["dims"] else ""))
    parts += [f"({s})" for s in d["series"]]
    if d["isbn"]:
        parts.append(f"ISBN {d['isbn']}")
    return ". — ".join(p.rstrip(".") for p in parts)


def record_page(cat, rec):
    """The address of the page where the catalogue displays this record, and the catalogue's name."""
    rid = rec.findtext(f"{M}controlfield[@tag='001']")
    if cat == "loc":
        lccn = rec.find(f"{M}datafield[@tag='010']/{M}subfield[@code='a']").text.replace(" ", "")
        return f"https://lccn.loc.gov/{lccn}", "Library of Congress"
    if cat == "dnb":
        return f"https://d-nb.info/{rid}", "Deutsche Nationalbibliothek"
    if cat == "bl":
        return f"https://catalogue.bl.uk/permalink/44BL_MAIN/195da65/alma{rid}", "British Library"
    return ("https://bibsys-xp.primo.exlibrisgroup.com/discovery/fulldisplay"
            f"?docid=alma{rid}&context=L&vid=47BIBSYS_HIOA:HIOA&lang=en"), "Oria, Norway"


STYLE = """  <style>
    :root { --text: #1f2328; --muted: #59636e; --line: #d8dee4; --accent: #0b5cad; --bg: #ffffff; --panel: #f6f8fa; }
    @media (prefers-color-scheme: dark) {
      :root { --text: #e6edf3; --muted: #9198a1; --line: #3d444d; --accent: #6cb6ff; --bg: #151b23; --panel: #1f2630; }
    }
    body { margin: 0; background: var(--bg); color: var(--text);
           font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 1rem; }
    .intro { font-size: 1.05rem; margin: 0 0 2.5rem; }
    .publications { list-style: none; counter-reset: pub; margin: 0; padding: 0; }
    .publications > li { counter-increment: pub; padding: 1.25rem 0 1.5rem; border-top: 1px solid var(--line); }
    .publications h2 { font-size: 1.15rem; line-height: 1.35; margin: 0 0 .5rem; }
    .publications h2::before { content: counter(pub) ". "; color: var(--muted); }
    .publications p { margin: .4rem 0; }
    .isbd { background: var(--panel); border-left: 3px solid var(--line); padding: .6rem .8rem;
            font-size: .92rem; color: var(--text); }
    .record { font-size: .9rem; color: var(--muted); }
    a { color: var(--accent); }
    .back { margin: 0 0 1.5rem; font-size: .9rem; }
    .eyebrow { margin: 0 0 .25rem; font-size: .85rem; letter-spacing: .06em; text-transform: uppercase;
               color: var(--muted); }
    main > section { margin-top: 2.25rem; }
    main > section > h2 { font-size: 1.3rem; margin: 0 0 .75rem; }
    .todo { color: var(--muted); font-style: italic; }
    .back a::before { content: "← "; }
    .start { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: .6rem .9rem;
             margin: 0 0 2.5rem; font-size: .95rem; }
    .exercises { padding-left: 1.25rem; }
    .exercises li { margin: 0 0 1.25rem; }
    .exercises h3 { font-size: 1.1rem; margin: 0 0 .25rem; }
    .exercises p { margin: .2rem 0; }
    ol.steps li { margin: 0 0 .5rem; }
    .viaf { margin-top: 3rem; padding-top: 1.5rem; border-top: 2px solid var(--line); font-size: .92rem; }
    .viaf h2 { font-size: 1.15rem; }
    .viaf h3 { font-size: 1rem; margin: 1.25rem 0 .25rem; }
    .viaf ul { padding-left: 1.25rem; }
  </style>
"""


class Example:
    def __init__(self, name, slug, comment):
        self.name, self.base, self.out = name, f"http://example.org/{slug}/", [f"# {comment}\n", PREFIXES]
        self.pubs = {s: (cat, cover) for s, cat, _, _, cover in SELECTION[name]}
        self.viaf = {"agent": [], "work": []}  # (label, VIAF id) for the list at the end of the page
        root = ET.parse(ROOT / "marc" / f"{name}.xml").getroot()
        self.entities = []  # (class, IRI, properties), written to both Turtle files
        self.start_works = set()  # works given in the start file, with their expressions
        # True: the start file has every entity and what each manifestation embodies, and leaves out only
        # the relationships between works and between expressions
        self.start_all = False
        self.has_start = True  # False: participants start from an empty repository
        self.records = dict(zip([s for s, *_ in SELECTION[name]], root))

    def iri(self, path):
        """The entity's IRI: its VIAF permalink when it has one, an ad hoc example.org IRI otherwise."""
        viaf = VIAF.get(self.base.split("/")[-2], {}).get(path)
        return f"http://viaf.org/viaf/{viaf}" if viaf else f"{self.base}{path}"

    def uri(self, path):
        return f"<{self.iri(path)}>"

    def entity(self, path, cls, props):
        viaf = VIAF.get(self.base.split("/")[-2], {}).get(path)
        if viaf:
            label = next(o for p, o in props if p == "rdfs:label")[1:-1].replace('\\"', '"')
            if path not in VIAF_NOT_LISTED.get(self.base.split("/")[-2], ()):
                self.viaf[path.split("/")[0]].append((label, viaf))
            props = [*props, (VIAF_PROPERTY[path.split("/")[0]], lit(f"http://viaf.org/viaf/{viaf}"))]
        self.entities.append((cls, path, [("rdaxd:P00018", lit(self.iri(path))), *props]))

    def in_start(self, cls, path, props):
        """Whether an entity goes into the start file: agents and manifestations always, and in examples that
        give some works away (the works listed on the page), those works and their expressions."""
        if cls in START_CLASSES or self.start_all:
            return True
        given = self.start_works
        if cls == "rdac:C10001":
            return path in given
        work = next((o for p, o in props if p == "rdaeo:P20231"), None)
        return cls == "rdac:C10006" and work in {self.uri(w) for w in given}

    def dropped(self, path, p, o):
        """Whether a statement is left out of the start file."""
        if not self.start_all:
            return p in START_DROPPED
        # every relationship from a work or expression to another work or expression, but not the link from
        # an expression to its work
        we = {self.uri(q) for _, q, _ in self.entities if q.startswith(("work/", "exp/"))}
        targets = set(re.findall(r"<[^>]+>", o or ""))
        return path.startswith(("work/", "exp/")) and p != "rdaeo:P20231" and bool(targets) and targets <= we

    def turtle(self, start):
        """The example as Turtle: everything, or for a start file what in_start lets through."""
        out = list(self.out)
        if start and self.start_all:
            out[0] = (f"# Start file for the SWIB26 activity {PAGES[self.name]}: the publications (manifestations),\n"
                      "# the works and expressions they embody, and the people and publishers, described from\n"
                      "# library catalogue records. State the relationships between the works (and between\n"
                      "# expressions where RDA has them only there).\n")
        elif start:  # the comment of the complete model describes the answer
            given = "some of the works and their expressions, " if self.start_works else ""
            out[0] = (f"# Start file for the SWIB26 activity {PAGES[self.name]}: the publications (manifestations),\n"
                      f"# {given}and the people and publishers, described from library catalogue records. Link\n"
                      "# each manifestation to the expressions it embodies, and add the works and expressions\n"
                      "# that are missing.\n")
        for cls, path, props in self.entities:
            if start and not self.in_start(cls, path, props):
                continue
            body = [f"    {p} {o}" for p, o in props if o and not (start and self.dropped(path, p, o))]
            out.append(f"{self.uri(path)}\n    a {cls} ;\n" + " ;\n".join(body) + " .\n")
        return "\n".join(out)

    def uris(self, paths):
        return ",\n        ".join(self.uri(p) for p in paths)

    def agent(self, slug, name, dates=None, cls="rdac:C10004"):
        self.entity(f"agent/{slug}", cls, [("rdaad:P50413", lit(name)), ("rdfs:label", lit(name)),
                                           ("rdaad:P50339", dates and lit(dates))])

    def publisher(self, slug, name):
        self.agent(slug, name, cls="rdac:C10005")

    def work(self, slug, title, label, kind, genres, props=(), date=None, note=None):
        self.entity(f"work/{slug}", "rdac:C10001", [
            ("rdawd:P10223", lit(title)), ("rdfs:label", lit(label)), ("rdawd:P10219", date and lit(date)),
            ("rdawd:P10330", note and lit(note)), ("entedit:P01", f"vtp:{kind}"),
            ("entedit:P02", ", ".join(genres)), *props])

    def expression(self, slug, title, label, lang, work, types, props=(), date=None, note=None):
        self.entity(f"exp/{slug}", "rdac:C10006", [
            ("rdaed:P20315", lit(title)), ("rdfs:label", lit(label)), ("rdaed:P20214", date and lit(date)),
            ("rdaed:P20071", note and lit(note)), ("rdaeo:P20001", ", ".join(CT.format(t) for t in types)),
            ("rdaeo:P20006", f"<{LANG}{lang}>"), ("rdaeo:P20231", self.uri(f"work/{work}")), *props])

    def manifestation(self, slug, publisher, expressions, media=UNMEDIATED, carrier=VOLUME, note=None):
        d = description(self.records[slug])
        self.entity(f"manifestation/{slug}", "rdac:C10007", [
            ("rdfs:label", lit(f"{d['title']} ({d['publisher']}, {d['date']})")),
            ("rdamd:P30156", lit(d["title"])), ("rdamd:P30142", d["other"] and lit(d["other"])),
            ("rdamd:P30117", d["resp"] and lit(d["resp"])), ("rdamd:P30107", d["edition"] and lit(d["edition"])),
            ("rdamd:P30182", lit(d["extent"])), ("rdamd:P30169", d["dims"] and lit(d["dims"])),
            ("rdamd:P30176", lit(d["publisher"])), ("rdamd:P30088", d["place"] and lit(d["place"])),
            ("rdamd:P30011", lit(d["date"])), ("rdamd:P30106", ", ".join(lit(s) for s in d["series"])),
            ("rdamd:P30137", note and lit(note)), ("rdamd:P30004", d["isbn"] and lit(f"ISBN {d['isbn']}")),
            ("rdamo:P30001", CA.format(carrier)), ("rdamo:P30002", MT.format(media)),
            ("rdamo:P30420", publisher and self.uri(f"agent/{publisher}")), ("rdamo:P30139", self.uris(f"exp/{e}" for e in expressions))])

    def write(self, title, intro, notes):
        page = PAGES[self.name]
        if self.has_start:
            (ROOT / "start" / f"{page}.ttl").write_text(self.turtle(start=True), encoding="utf-8")
        (ROOT / "solutions" / f"{page}.ttl").write_text(self.turtle(start=False), encoding="utf-8")
        items = []
        for slug, rec in self.records.items():
            url, source = RECORD_LINKS.get(slug) or record_page(self.pubs[slug][0], rec)
            note = f'      <p>{html.escape(notes[slug], quote=False)}</p>\n' if notes.get(slug) else ""
            items.append(f'    <li>\n      <h2>{html.escape(self.headings[slug], quote=False)}</h2>\n'
                         f'      <p class="isbd">{html.escape(isbd(description(rec)), quote=False)}</p>\n{note}'
                         f'      <p class="record"><a href="{html.escape(url)}">Catalogue record</a> · {source}</p>\n'
                         f"    </li>")
        start = (f'  <p class="start">Start file to import: <a href="start/{page}.ttl">start/{page}.ttl</a></p>\n'
                 if self.has_start else "")
        (ROOT / f"{page}.html").write_text(
            f'<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n'
            f'  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f"  <title>{html.escape(title)}</title>\n{STYLE}</head>\n<body>\n<main>\n"
            f'  <p class="back"><a href="./">Learning entity-oriented metadata with EntEdit</a></p>\n'
            f"  <h1>{html.escape(title)}</h1>\n  <p class=\"intro\">{html.escape(intro, quote=False)}</p>\n"
            + start + '  <ol class="publications">\n' + "\n".join(items) + "\n  </ol>\n" + self.viaf_list()
            + "</main>\n</body>\n</html>\n", encoding="utf-8")

    def viaf_list(self):
        """The VIAF identifiers of the people and works in the example, as two lists."""
        out = ['  <section class="viaf">\n  <h2>VIAF identifiers</h2>\n'
               "  <p>Only people and works that have a VIAF record are listed. Those for which we found no VIAF\n"
               "  identifier are left out, so this is not a list of everyone and everything in the example.</p>\n"]
        for kind, heading in (("agent", "People"), ("work", "Works")):
            rows = sorted(self.viaf[kind], key=lambda r: r[0].lower())
            if not rows:
                continue
            out.append(f"  <h3>{heading}</h3>\n  <ul>\n")
            out += [f'    <li>{html.escape(label, quote=False)}: <a href="http://viaf.org/viaf/{viaf}">'
                    f"http://viaf.org/viaf/{viaf}</a></li>\n" for label, viaf in rows]
            out.append("  </ul>\n")
        out.append("  </section>\n")
        return "".join(out)


# --- Cataloguing: one publication per participant ------------------------------------------------
x = Example("Cataloguing", "cataloguing",
            "Cataloguing: thirty English-language novels, crime and other modern fiction, one per participant,\n"
            "# in editions after 2000 whose records name the author only. No two\n"
            "# share an author or a work, so participants can catalogue in the same repository at the same time.\n"
            "# Each has a work, an English expression, the manifestation and the author; the publisher is\n"
            "# recorded as text on the manifestation only, not as an agent.\n"
            "# Publication data from the MARC 21 records in swib26/marc/Cataloguing.xml.")
x.has_start = False
# slug: (work title, year first published)
FIRST = {
    "adichie": ("Purple hibiscus", "2003"),
    "atkinson": ("Case histories", "2004"),
    "barnes": ("The sense of an ending", "2011"),
    "child": ("The enemy", "2004"),
    "cleeves": ("Raven black", "2006"),
    "coben": ("Tell no one", "2001"),
    "connelly": ("The Lincoln lawyer", "2005"),
    "egan": ("A visit from the Goon Squad", "2010"),
    "flynn": ("Gone girl", "2012"),
    "french": ("In the woods", "2007"),
    "hawkins": ("The girl on the train", "2015"),
    "herron": ("Slow horses", "2010"),
    "hosseini": ("The kite runner", "2003"),
    "kingsolver": ("Demon Copperhead", "2022"),
    "lahiri": ("The namesake", "2003"),
    "lehane": ("Mystic river", "2001"),
    "levy": ("Small island", "2004"),
    "lippman": ("What the dead know", "2007"),
    "mantel": ("Wolf Hall", "2009"),
    "martel": ("Life of Pi", "2001"),
    "mcewan": ("Atonement", "2001"),
    "ng": ("Everything I never told you", "2014"),
    "osman": ("The Thursday murder club", "2020"),
    "owens": ("Where the crawdads sing", "2018"),
    "penny": ("Still life", "2005"),
    "rankin": ("Exit music", "2007"),
    "rooney": ("Normal people", "2018"),
    "slaughter": ("Blindsighted", "2001"),
    "smith": ("White teeth", "2000"),
    "strout": ("Olive Kitteridge", "2008"),
}
CRIME = {"atkinson", "child", "cleeves", "coben", "connelly", "flynn", "french", "hawkins", "herron", "lehane", "lippman", "osman", "penny", "rankin", "slaughter"}
x.headings = {}
for slug, rec in x.records.items():
    name = re.sub(r"[,.]$", "", first(rec, "100", "a") or "").strip()
    dates = (first(rec, "100", "d") or "").rstrip(".,") or None
    x.agent(slug, name, dates)
    title, year = FIRST[slug]
    genres = [NTSF.format(159), NTSF.format(258)] if slug in CRIME else [NTSF.format(258)]
    label = f"{title} ({name})"
    x.work(slug, title, label, "V1000", genres, [("rdawo:P10061", x.uri(f"agent/{slug}"))], date=year)
    x.expression(f"{slug}/eng", title, label, "eng", slug, [TEXT], date=year)
    x.manifestation(slug, None, [f"{slug}/eng"])
    surname = name.split(",")[0]
    x.headings[slug] = f"{surname}: {title[0].upper() + title[1:]} ({re.search(r"\d{4}", description(rec)['date']).group()})"
x.write("Activity: cataloguing a publication",
        "Each participant takes one of the thirty publications below, so that everyone can work in the same "
        "repository at the same time: no two of them share an author or a work. From the description and the "
        "catalogue record, create the work, the expression and the manifestation, and the person who wrote it, "
        "and relate them to each other. Record the publisher as text on the manifestation only. Then look at "
        "what the others have made, in the entity lists and in the search.",
        {})

# --- Translations -------------------------------------------------------------------------------
x = Example("TranslationsAckroyd", "ackroyd",
            "Translations: Agatha Christie's The Murder of Roger Ackroyd (1926). English original; a Norwegian\n"
            "# translation in an edition of its own, read aloud, and in a book with a second novel (A murder is announced,\n"
            "# also in English); three German translations, the later two under the same title. The two-novel\n"
            "# book has no collective title and no work for the whole.\n"
            "# Publication data from the MARC 21 records in swib26/marc/TranslationsAckroyd.xml.")
x.agent("christie", "Christie, Agatha", "1890-1976")
x.agent("arentz", "Arentz, Ronald Archer")
x.agent("frisch", "Frisch, Per", "1951-")
x.agent("puetsch", "Pütsch, Friedrich")
x.agent("mundhenk", "Mundhenk, Michael", "1954-")
x.agent("christensen", "Christensen, Jan")
x.agent("kafka", "Kafka, Irene")
for slug, name in [("harper", "Harper"), ("aschehoug", "Aschehoug"), ("lydbokforlaget", "Lydbokforlaget"),
                   ("fischer", "Fischer Taschenbuch Verlag"), ("atlantik", "Atlantik"),
                   ("doddmead", "Dodd, Mead"), ("dreimasken", "Drei Masken Verlag")]:
    x.publisher(slug, name)
x.work("novel", "The murder of Roger Ackroyd", "The murder of Roger Ackroyd (Christie, Agatha)", "V1000",
       [NTSF.format(159), NTSF.format(258)], [("rdawo:P10061", x.uri("agent/christie"))], date="1926")
A = "A murder is announced"
x.work("announced", A, f"{A} (Christie, Agatha)", "V1000", [NTSF.format(159), NTSF.format(258)],
       [("rdawo:P10061", x.uri("agent/christie"))], date="1950")
x.expression("announced/eng", A, f"{A} (Christie, Agatha)", "eng", "announced", [TEXT], date="1950")
x.expression("announced/nob-christensen", "Invitasjon til mord",
             "Invitasjon til mord (Christie, Agatha ; translated by Jan Christensen)", "nob", "announced", [TEXT],
             [("rdaeo:P20037", x.uri("agent/christensen")), ("rdaeo:P20141", x.uri("exp/announced/eng"))])
L = "The murder of Roger Ackroyd"
x.expression("novel/eng", L, f"{L} (Christie, Agatha)", "eng", "novel", [TEXT], date="1926")
x.expression("novel/nob-arentz", "Doktoren mister en pasient",
             "Doktoren mister en pasient (Christie, Agatha ; translated by R. A. Arentz)", "nob", "novel", [TEXT],
             [("rdaeo:P20037", x.uri("agent/arentz")), ("rdaeo:P20141", x.uri("exp/novel/eng"))], date="1938")
x.expression("novel/nob-frisch", "Doktoren mister en pasient",
             "Doktoren mister en pasient (Christie, Agatha ; read by Per Frisch)", "nob", "novel", [SPOKEN],
             [("rdaeo:P20037", x.uri("agent/arentz")), ("rdaeo:P20022", x.uri("agent/frisch"))], date="2006",
             note="Reading of R. A. Arentz's translation")
x.expression("novel/ger-kafka", "Roger Ackroyd und sein Mörder",
             "Roger Ackroyd und sein Mörder (Christie, Agatha ; translated by Irene Kafka)", "ger", "novel", [TEXT],
             [("rdaeo:P20037", x.uri("agent/kafka")), ("rdaeo:P20141", x.uri("exp/novel/eng"))], date="1928")
x.expression("novel/ger-puetsch", "Alibi", "Alibi (Christie, Agatha ; translated by Friedrich Pütsch)", "ger",
             "novel", [TEXT], [("rdaeo:P20037", x.uri("agent/puetsch")), ("rdaeo:P20141", x.uri("exp/novel/eng"))])
x.expression("novel/ger-mundhenk", "Alibi", "Alibi (Christie, Agatha ; translated by Michael Mundhenk)", "ger",
             "novel", [TEXT], [("rdaeo:P20037", x.uri("agent/mundhenk")), ("rdaeo:P20141", x.uri("exp/novel/eng"))],
             date="2014")
x.manifestation("eng-harper-2002", "harper", ["novel/eng"], note="First published London : Collins, 1926")
x.manifestation("nob-aschehoug-1991", "aschehoug", ["novel/nob-arentz"])
x.manifestation("nob-audio-2006", "lydbokforlaget", ["novel/nob-frisch"], AUDIO, AUDIODISC, note="Read by Per Frisch")
x.manifestation("eng-announced-dodd-1985", "doddmead", ["announced/eng"], note="Copyright 1950")
x.manifestation("nob-omnibus-2004", "aschehoug", ["novel/nob-arentz", "announced/nob-christensen"])
x.manifestation("ger-kafka-1928", "dreimasken", ["novel/ger-kafka"])
x.manifestation("ger-fischer-2005", "fischer", ["novel/ger-puetsch"])
x.manifestation("ger-atlantik-2014", "atlantik", ["novel/ger-mundhenk"])
x.headings = {
    "eng-harper-2002": "The Murder of Roger Ackroyd (2002)",
    "nob-aschehoug-1991": "Doktoren mister en pasient (1991)",
    "nob-audio-2006": "Doktoren mister en pasient, audiobook (2006)",
    "eng-announced-dodd-1985": "A Murder Is Announced (1985)",
    "nob-omnibus-2004": "Doktoren mister en pasient ; Invitasjon til mord (2004)",
    "ger-kafka-1928": "Roger Ackroyd und sein Mörder (1928)",
    "ger-fischer-2005": "Alibi (2005)",
    "ger-atlantik-2014": "Alibi (2014)",
}
x.write("Activity: translations (Agatha Christie)",
        "The publications below carry the same story by Agatha Christie, one of them together with a second novel. Which works and expressions can you "
        "identify? When is a publication a new expression and when is it only a new manifestation of one you "
        "already have? Draw or write out your model. Follow the links to the catalogue records, where you can also "
        "see what they state about the translation and, where the catalogue has one, the cover.",
        {"eng-harper-2002": "Paperback reissue of the English text of the Hercule Poirot novel first published in 1926.",
         "nob-aschehoug-1991": "A later Norwegian edition of the novel in R. A. Arentz's translation, which first "
                               "appeared in 1938.",
         "nob-audio-2006": "Norwegian audiobook on seven CDs: Per Frisch reads R. A. Arentz's translation.",
         "eng-announced-dodd-1985": "An American edition of a later Christie novel, a Miss Marple mystery first "
                                   "published in 1950.",
         "nob-omnibus-2004": "Two Christie novels in one volume, each with its own page numbering: R. A. Arentz's "
                             "translation of the Hercule Poirot novel above and Jan Christensen's translation of A "
                             "murder is announced. The book has no title of its own beyond the two titles.",
         "ger-kafka-1928": "The first German translation of the novel, by Irene Kafka, under a title close to the "
                           "English one.",
         "ger-fischer-2005": "German translation of the novel by Friedrich Pütsch, under the German title Alibi. "
                             "It first appeared in 1937.",
         "ger-atlantik-2014": "A new German translation of the novel by Michael Mundhenk. The title is still Alibi."})

# --- Relationships between works --------------------------------------------------------------------------------
x = Example("RelationshipsLittleWomen", "littlewomen-relationships",
            "Relationships between works: Louisa May Alcott's Little Women (1868-69) and four adaptations:\n"
            "# graphic novel, play, opera and film. The novel came out in two parts (1868, 1869), each a work of\n"
            "# its own and a part of the novel; the second is the sequel to the first. Each adaptation is a new\n"
            "# work, related to the novel at work level, or at expression level where RDA and the profile have\n"
            "# the relationship only there (the opera).\n"
            "# Publication data from the MARC 21 records in swib26/marc/RelationshipsLittleWomen.xml.")
for slug, name, dates in [("alcott", "Alcott, Louisa May", "1832-1888"), ("terciero", "Terciero, Rey", None),
                          ("indigo", "Indigo, Bre", None), ("asher", "Asher, Sandy", None),
                          ("adamo", "Adamo, Mark", None),
                          ("gerwig", "Gerwig, Greta", "1983-"), ("ronan", "Ronan, Saoirse", "1994-")]:
    x.agent(slug, name, dates)
for slug, name in [("roberts", "Roberts Brothers"), ("knopf", "Alfred A. Knopf"), ("littlebrown", "Little, Brown and Company"),
                   ("dramatic", "Dramatic Publishing"), ("schirmer", "G. Schirmer"),
                   ("columbia", "Columbia Pictures")]:
    x.publisher(slug, name)
NOVEL_W = x.uri("work/novel")
NOVEL_E = x.uri("exp/novel/eng")
PART2 = "Little women, part second"
x.work("part1", "Little women", "Little women, part 1 (Alcott, Louisa May)", "V1000", [NTSF.format(258)],
       [("rdawo:P10061", x.uri("agent/alcott")), ("rdawo:P10020", x.uri("work/part2"))], date="1868")
x.work("part2", PART2, f"{PART2} (Alcott, Louisa May)", "V1000", [NTSF.format(258)],
       [("rdawo:P10061", x.uri("agent/alcott"))], date="1869", note="Published in Britain as Good wives")
x.work("novel", "Little women", "Little women (Alcott, Louisa May)", "V1000", [NTSF.format(258)],
       [("rdawo:P10061", x.uri("agent/alcott")), ("rdawo:P10147", x.uris(["work/part1", "work/part2"]))],
       date="1868-1869")
x.work("graphic", "Meg, Jo, Beth, and Amy", "Meg, Jo, Beth, and Amy (Terciero, Rey ; Indigo, Bre)", "V1008",
       [NTSF.format(302)], [("rdawo:P10061", x.uri("agent/terciero")), ("rdawo:P10058", x.uri("agent/indigo")),
                            ("rdawo:P10252", NOVEL_W)], date="2019",
       note="A modern retelling of Little women")
x.work("play", "Little women : Meg, Jo, Beth, and Amy", "Little women (play, Asher, Sandy)", "V1009", [NTSF.format(583)],
       [("rdawo:P10061", x.uri("agent/asher")), ("rdawo:P10127", NOVEL_W)], date="2001")
x.work("opera", "Little women", "Little women (opera, Adamo, Mark)", "V1001", [],
       [("rdawo:P10053", x.uri("agent/adamo")), ("rdawo:P10205", x.uri("agent/adamo"))], date="1998")
x.work("film2019", "Little women", "Little women (film, Gerwig, 2019)", "V1002", [NTSF.format(1240)],
       [("rdawo:P10013", x.uri("agent/gerwig")), ("rdawo:P10203", x.uri("agent/gerwig")),
        ("rdawo:P10129", NOVEL_W)], date="2019", note="Production: USA, 2019")
x.expression("part1/eng", "Little women", "Little women, part 1 (Alcott, Louisa May)", "eng", "part1", [TEXT],
             date="1868")
x.expression("part2/eng", PART2, f"{PART2} (Alcott, Louisa May)", "eng", "part2", [TEXT], date="1869")
x.expression("novel/eng", "Little women", "Little women (Alcott, Louisa May)", "eng", "novel", [TEXT],
             [("rdaeo:P20145", x.uris(["exp/part1/eng", "exp/part2/eng"]))], date="1868-1869")
x.expression("graphic/eng", "Meg, Jo, Beth, and Amy", "Meg, Jo, Beth, and Amy (Terciero, Rey ; Indigo, Bre)", "eng",
             "graphic", [TEXT, STILL], date="2019")
x.expression("play/eng", "Little women : Meg, Jo, Beth, and Amy", "Little women (play, Asher, Sandy)", "eng", "play",
             [TEXT], date="2001")
x.expression("opera/score", "Little women", "Little women (opera, Adamo, Mark ; vocal score)", "eng", "opera",
             [NOTATED], [("rdaeo:P20240", NOVEL_E)], date="1998")
x.expression("film2019/eng", "Little women", "Little women (film, Gerwig, 2019)", "eng", "film2019", [MOVING],
             [("rdaeo:P20012", x.uri("agent/ronan"))], date="2019")
x.manifestation("part1-roberts-1868", "roberts", ["part1/eng"], note="First edition")
x.manifestation("part2-roberts-1869", "roberts", ["part2/eng"])
x.manifestation("novel-knopf-1994", "knopf", ["novel/eng", "part1/eng", "part2/eng"])
x.manifestation("graphic-2019", "littlebrown", ["graphic/eng"])
x.manifestation("play-asher-2001", "dramatic", ["play/eng"])
x.manifestation("opera-score-2001", "schirmer", ["opera/score"], note="Publisher's no.: Ed. 4130; HL50483808")
x.manifestation("film-dvd-2019", "columbia", ["film2019/eng"], VIDEO, VIDEODISC)
x.start_all = True
x.headings = {
    "part1-roberts-1868": "Little Women, first edition (1868)",
    "part2-roberts-1869": "Little Women, part second (1869)",
    "novel-knopf-1994": "Little Women, the complete novel (1994)",
    "graphic-2019": "Meg, Jo, Beth, and Amy, a graphic novel (2019)",
    "play-asher-2001": "Little Women, a play (2001)",
    "opera-score-2001": "Little Women, an opera in vocal score (2001)",
    "film-dvd-2019": "Little Women, the film on DVD (2019)",
}
x.write("Activity: relationships between works (Little Women)",
        "All the publications below go back to Louisa May Alcott's novel, which first came out in two parts. Which "
        "of them are works of their own, and which relationship would you state between each of them and the novel, "
        "and between the two parts? Look up the relationship elements "
        "in the RDA Registry. Then compare your answer with how each catalogue record expresses the link to the "
        "novel, if it does.",
        {"part1-roberts-1868": "The first edition of the story of the four March sisters, illustrated by the "
                               "author's sister May Alcott.",
         "part2-roberts-1869": "The continuation, published the following year by the same publisher as \"part "
                               "second\". British editions often published it on its own as Good wives.",
         "novel-knopf-1994": "Little women was first published as two separate books, in 1868 and 1869, and "
                             "later as one. This edition has the complete novel, both parts in a single volume, "
                             "in the Everyman's Library Children's Classics series.",
         "graphic-2019": "A graphic novel set in present-day New York, with a blended and diverse March family. "
                         "Written by Rey Terciero and drawn by Bre Indigo.",
         "play-asher-2001": "A two-act play for the stage, based on Alcott's writings, published as a script.",
         "opera-score-2001": "Vocal score of an opera in two acts. Mark Adamo wrote both words and music.",
         "film-dvd-2019": "Greta Gerwig's feature film on DVD, with Saoirse Ronan as Jo. It moves between "
                          "two periods in the sisters' lives instead of following the novel's order."})

# --- Collections --------------------------------------------------------------------------------
x = Example("CollectionsTolkien", "tolkien-collections",
            "Collections: J. R. R. Tolkien. Tree and leaf, The adventures of Tom Bombadil and Tales from the\n"
            "# perilous realm are named collections, modelled as works with parts (the last is a publisher's\n"
            "# selection, which is open to discussion); the poems of Tom Bombadil are in two of the publications. The two Unwin books of 1975\n"
            "# and HarperCollins' boxed sets of The hobbit and The lord of the rings (2011) and of The lord of the\n"
            "# rings with Hammond and Scull's Reader's companion (2005, 2014) have no work for the whole; the companion\n"
            "# is a work of its own, a commentary on The lord of the rings. The first two have no collective title:\n"
            "# the manifestation embodies the expressions, and there is no work for the whole. The lord of the\n"
            "# rings is one work with its three volumes as parts, and has expressions for the volumes only. A manifestation embodies the expression of a collection and of everything in it.\n"
            "# Publication data from the MARC 21 records in swib26/marc/CollectionsTolkien.xml.")
x.agent("tolkien", "Tolkien, J. R. R.", "1892-1973")
x.agent("hammond", "Hammond, Wayne G.", "1953-")
x.agent("scull", "Scull, Christina", "1942-")
for slug, name in [("allenunwin", "Allen & Unwin"),
                   ("harpercollins", "HarperCollins"), ("unwinbooks", "Unwin Books")]:
    x.publisher(slug, name)
POEMS = ["The adventures of Tom Bombadil", "Bombadil goes boating", "Errantry", "Princess Mee",
         "The man in the moon stayed up too late", "The man in the moon came down too soon", "The stone troll",
         "Perry-the-Winkle", "The mewlips", "Oliphaunt", "Fastitocalon", "Cat", "Shadow-bride", "The hoard",
         "The sea-bell", "The last ship"]
POEM_SLUGS = [f"poem{i:02d}" for i in range(1, len(POEMS) + 1)]
TALE, POEM, PLAY = NTSF.format(83), NTSF.format(580), NTSF.format(583)
SELECT = "entedit:T07"
# slug, title, genres, date, by
SINGLE = [("giles", "Farmer Giles of Ham", [TALE], "1949"), ("smith", "Smith of Wootton Major", [TALE], "1967"),
          ("niggle", "Leaf by Niggle", [TALE], "1945"), ("fairy", "On fairy-stories", [], "1947"),
          ("homecoming", "The homecoming of Beorhtnoth, Beorhthelm's son", [PLAY], "1953")]
SINGLE += [(s, t, [POEM], "1962") for s, t in zip(POEM_SLUGS, POEMS)]
AUTHOR = ("rdawo:P10061", x.uri("agent/tolkien"))
PARTS = {"treeleaf": ["fairy", "niggle"], "bombadil": POEM_SLUGS,
         "perilous": ["giles", "bombadil", "niggle", "smith"],
         "lotr": ["fellowship", "towers", "king"]}
COLL = {"treeleaf": ("Tree and leaf", [], "1964"),
        "bombadil": ("The adventures of Tom Bombadil and other verses from the Red book", [NTSF.format(59)], "1962"),
        "perilous": ("Tales from the perilous realm", [SELECT], "1997")}
for slug, title, genres, date in SINGLE:
    x.work(slug, title, f"{title} (Tolkien, J. R. R.)", "V1000", genres, [AUTHOR], date=date)
    x.expression(f"{slug}/eng", title, f"{title} (Tolkien, J. R. R.)", "eng", slug, [TEXT], date=date)
NOVEL = NTSF.format(258), NTSF.format(91)
x.work("hobbit", "The hobbit", "The hobbit (Tolkien, J. R. R.)", "V1000", NOVEL, [AUTHOR], date="1937")
x.expression("hobbit/eng", "The hobbit", "The hobbit (Tolkien, J. R. R.)", "eng", "hobbit", [TEXT], date="1937")
LOTR = [("fellowship", "The fellowship of the ring", "1954"), ("towers", "The two towers", "1954"),
        ("king", "The return of the king", "1955")]
for slug, title, date in LOTR:
    x.work(slug, title, f"{title} (Tolkien, J. R. R.)", "V1000", NOVEL, [AUTHOR], date=date)
    x.expression(f"{slug}/eng", title, f"{title} (Tolkien, J. R. R.)", "eng", slug, [TEXT], date=date)
x.work("lotr", "The lord of the rings", "The lord of the rings (Tolkien, J. R. R.)", "V1000", NOVEL,
       [AUTHOR, ("rdawo:P10147", x.uris(f"work/{s}" for s, _, _ in LOTR))], date="1954-1955")
RC = "The lord of the rings : a reader's companion"
x.work("companion", RC, f"{RC} (Hammond, Wayne G. ; Scull, Christina)", "V1000", [],
       [("rdawo:P10061", x.uris(["agent/hammond", "agent/scull"])), ("rdawo:P10187", x.uri("work/lotr"))], date="2005")
x.expression("companion/eng", RC, f"{RC} (Hammond, Wayne G. ; Scull, Christina)", "eng", "companion", [TEXT])
for slug, (title, genres, date) in COLL.items():
    x.work(slug, title, f"{title} (Tolkien, J. R. R.)", "V1000", genres,
           [AUTHOR, ("rdawo:P10147", x.uris(f"work/{p}" for p in PARTS[slug]))], date=date)
    x.expression(f"{slug}/eng", title, f"{title} (Tolkien, J. R. R.)", "eng", slug, [TEXT],
                 [("rdaeo:P20145", x.uris(f"exp/{p}/eng" for p in PARTS[slug]))], date=date)


# The lord of the rings has expressions only for its volumes, which is how it is published
NO_EXPRESSION = {"lotr"}


def contents(*slugs):
    """The expressions of the given works and, for a collection, of everything in it."""
    out = []
    for s in slugs:
        if s not in NO_EXPRESSION:
            out.append(f"{s}/eng")
        out += contents(*PARTS.get(s, []))
    return list(dict.fromkeys(out))


x.manifestation("treeleaf-1964", "allenunwin", contents("treeleaf"))
x.manifestation("perilous-1998", "harpercollins", contents("perilous"))
x.manifestation("giles-bombadil-1975", "unwinbooks", contents("giles", "bombadil"))
x.manifestation("hobbit-lotr-set-2011", "harpercollins", contents("hobbit", "lotr"),
                note="Four volumes in a slip case")
x.manifestation("lotr-companion-set-2005", "harpercollins", contents("lotr", "companion"),
                note="Four volumes in a slip case. Previous edition: 2002")
x.manifestation("lotr-companion-set-2014", "harpercollins", contents("lotr", "companion"),
                note="Four volumes in a slip case")
x.manifestation("companion-2008", "harpercollins", ["companion/eng"], note="Originally published: 2005")
x.manifestation("treeleaf-smith-1975", "unwinbooks", contents("treeleaf", "smith", "homecoming"))
x.start_works = {path for path in VIAF["tolkien-collections"]
                 if path.startswith("work/") and path not in VIAF_NOT_LISTED["tolkien-collections"]}
x.headings = {
    "lotr-companion-set-2005": "The Lord of the Rings, 50th anniversary set with the companion (2005)",
    "lotr-companion-set-2014": "The Lord of the Rings, 60th anniversary set with the companion (2014)",
    "companion-2008": "The Lord of the Rings: A Reader's Companion (2008)",
    "hobbit-lotr-set-2011": "The Hobbit ; The Lord of the Rings, boxed set (2011)",
    "treeleaf-1964": "Tree and Leaf (1964)",
    "perilous-1998": "Tales from the Perilous Realm (1998)",
    "giles-bombadil-1975": "Farmer Giles of Ham ; The Adventures of Tom Bombadil (1975)",
    "treeleaf-smith-1975": "Tree and Leaf – Smith of Wootton Major – The Homecoming of Beorhtnoth (1975)",
}
x.write("Activity: collections and aggregates (J. R. R. Tolkien)",
        "The publications below gather Tolkien's writings in different combinations. When does a collection "
        "form a work of its own with the stories or poems as parts, and when is a publication only a container for "
        "several expressions? Identify the works you would include, draw or write out how they relate, and look at "
        "how each catalogue record shows the contents.",
        {"treeleaf-1964": "Tolkien's essay On fairy-stories and his short story Leaf by Niggle, published together "
                          "under a title of their own.",
         "perilous-1998": "Farmer Giles of Ham, The adventures of Tom Bombadil, Leaf by Niggle and Smith of Wootton "
                          "Major under a title chosen for this selection.",
         "giles-bombadil-1975": "Paperback with the story Farmer Giles of Ham and the poems of The adventures of Tom "
                                "Bombadil. The book has no title of its own beyond the two titles.",
         "hobbit-lotr-set-2011": "Boxed set of four paperbacks in a slip case: The hobbit and the three volumes of "
                                 "The lord of the rings (The fellowship of the ring, The two towers, The return of "
                                 "the king), each with its own ISBN as well as one for the set.",
         "lotr-companion-set-2005": "Boxed set of four hardbacks for the 50th anniversary: the three volumes of The "
                                    "lord of the rings, with colour illustrations and maps, and The lord of the "
                                    "rings: a reader's companion by Wayne G. Hammond and Christina Scull, first "
                                    "published the same year.",
         "lotr-companion-set-2014": "Boxed set of four hardbacks for the 60th anniversary: the three volumes of The "
                                    "lord of the rings, with dust jackets after Tolkien's own unused designs, and "
                                    "The lord of the rings: a reader's companion by Wayne G. Hammond and Christina "
                                    "Scull. The catalogue record describes the set as one volume.",
         "companion-2008": "Paperback edition of Hammond and Scull's chapter-by-chapter commentary on The lord of "
                           "the rings, first published in 2005. The same companion is the fourth volume of the "
                           "2014 boxed set.",
         "treeleaf-smith-1975": "Paperback with the two parts of Tree and leaf, the story Smith of Wootton Major and "
                                "the verse play The homecoming of Beorhtnoth. The titles simply follow one another "
                                "on the book."})


# --- Main page ----------------------------------------------------------------------------------
EXERCISES = [
    ("cataloguing", "Cataloguing a publication",
     "A set of English-language novels, crime and other modern fiction, suitable as an introduction to the tool.",
     "No start file: catalogue your publication from scratch."),
    ("translations-christie", "Translations: Agatha Christie",
     "The murder of Roger Ackroyd in English, Norwegian and German: new translations, new editions and a "
     "reading of a translation, and a book that holds two novels.",
     "The publications only: add the works and expressions and link them."),
    ("relationships-little-women", "Relationships between works: Little Women",
     "Louisa May Alcott's novel, first published in two parts, and what has been made from it: a graphic novel, "
     "a play, an opera and a film.",
     "The publications, works and expressions, already linked: add the relationships between the works."),
    ("collections-tolkien", "Collections and aggregates: J. R. R. Tolkien",
     "The lord of the rings in boxed sets, alone or with other books, and Tolkien's shorter writings in "
     "collections with and without a title of their own.",
     "The publications and the distinct works with their expressions: link the publications to the expressions, "
     "and add the collections you consider works."),
    # planned; no page yet
    (None, "User tasks and data quality: search and exploration",
     "How well the data supports users' tasks, assessed by searching and exploring it.",
     "Details to come."),
]
items = "\n".join(
    "    <li>\n      <h3>" + (f'<a href="{page}.html">{html.escape(title)}</a>' if page else html.escape(title))
    + "</h3>\n"
    f"      <p>{html.escape(text, quote=False)}</p>\n"
    + (f'      <p class="record">Start file: <a href="start/{page}.ttl">start/{page}.ttl</a> · '
       if page and (ROOT / "start" / f"{page}.ttl").exists() else '      <p class="record">')
    + f"{html.escape(start, quote=False)}</p>\n    </li>"
    for page, title, text, start in EXERCISES)
WORKSHOP_TIME = "08:00–12:00 UTC"
ZOOM_LINK = "https://oslomet.zoom.us/j/61004023053?pwd=YZiyYrwprHLGIvqo6ZH3Uqq968aEEA.1"

zoom = (f'<a href="{html.escape(ZOOM_LINK)}">{html.escape(ZOOM_LINK)}</a>' if ZOOM_LINK
        else '<span class="todo">The Zoom link will be posted here before the workshop.</span>')
(ROOT / "index.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Learning entity-oriented metadata with EntEdit · SWIB26</title>
{STYLE}</head>
<body>
<main>
  <p class="eyebrow">SWIB26 workshop</p>
  <h1>Learning entity-oriented metadata with EntEdit</h1>
  <p class="intro">The future of library data is entity-based, and the new generation of librarians must be
  trained in the mindset, formats, vocabularies and identifiers that will be the core of library data. In
  education we lack convenient and pedagogically oriented tools that students can use to build knowledge of,
  reflect on and gain experience with bibliographic entities. This workshop presents EntEdit, an
  entity-oriented editor made for that purpose, and lets you try it out on a set of learning activities.</p>

  <section>
  <h2>Time and place</h2>
  <p><strong>When:</strong> {html.escape(WORKSHOP_TIME)}<br>
  <strong>Where:</strong> online, on Zoom: {zoom}</p>
  </section>

  <section>
  <h2>Agenda</h2>
  <ol class="steps">
    <li><strong>Introduction (45 minutes).</strong> The challenges of learning entity-oriented metadata. A
    presentation and demonstration of EntEdit: its design rationale and how it can be used in teaching.</li>
    <li><strong>Interactive hands-on sessions (2 hours).</strong> We will explore the use of the tool together
    in breakout rooms, with plenary sessions in between. You can use the online version or install it on your
    own machine. More information about the setup will be given during the session.</li>
    <li><strong>Discussion.</strong> The opportunities and challenges of experience-based learning of
    entity-oriented metadata.</li>
  </ol>
  </section>

  <section>
  <h2>EntEdit</h2>
  <p>EntEdit is an entity-oriented editor where students create entities, give them attributes and relate them
  to each other. They can explore the structures they build in visualizations, see how the data behaves in a
  bibliographic search, and download it as RDF (Turtle), for example to share their work or hand in an
  assignment. The editor can also log what users do, to learn how students build their set of entities.</p>
  <p>It is a web application with the GraphDB triple store as its backend, and uses a subset of the RDA Registry
  vocabulary for its classes and properties. It runs on your own computer with Docker Compose, without any
  licence, or as a shared web service. It is available under the CC BY-NC 4.0 licence.</p>
  <ul>
    <li><a href="https://app.entedit.org/entedit/">The running prototype</a> at app.entedit.org</li>
    <li><a href="https://github.com/trondaal/EntEdit">Source code and documentation</a> on GitHub</li>
    <li><a href="https://app.entedit.org/entedit/docs/en/index.html">Cataloguing startup</a> and
    <a href="https://app.entedit.org/entedit/docs/en/setup.html">setup guide</a></li>
  </ul>
  </section>

  <section>
  <h2>Preparing for the workshop</h2>
  <ul>
    <li><strong>Try EntEdit.</strong> Visit the <a href="https://app.entedit.org/entedit/?demo">demo
    prototype</a> and explore the tool yourself.</li>
    <li><strong>IFLA LRM.</strong> EntEdit follows the IFLA Library Reference Model. If it is new to you, read
    the description of the entities, above all Work, Expression, Manifestation, Item and Agent, and skim the
    relationships between them: <a href="https://repository.ifla.org/handle/20.500.14598/40">IFLA Library
    Reference Model: A Conceptual Model for Bibliographic Information</a>.</li>
    <li><strong>RDA.</strong> The elements and relationships come from the <a
    href="https://www.rdaregistry.info/">RDA Registry</a>; you will look up relationship types there during the
    activities.</li>
    <li><strong>Running EntEdit yourself (optional).</strong> To run EntEdit on your own computer, install
    Docker and follow the <a href="https://app.entedit.org/entedit/docs/en/setup.html">setup guide</a> before
    the workshop. Otherwise you can use the online version.</li>
  </ul>
  </section>

  <section>
  <h2>Activities</h2>
  <p>We will explore the tool, and discuss its use in teaching, with a selection of example datasets. In some
  activities you start from bibliographic descriptions only and use the tool to create the entities and add
  their attributes and relationships. In others we also provide a start file with basic descriptions that you
  can import and build on. Each activity has its own page.</p>
  <ol class="exercises">
{items}
  </ol>
  <p class="record">People and works carry their VIAF identifiers (http://viaf.org/viaf/…) as IRIs, so the same
  person or work is the same resource in every file. The activities and their sources are kept on
  <a href="https://github.com/trondaal/EntEdit/tree/main/swib26">GitHub</a>.</p>
  </section>
</main>
</body>
</html>
""", encoding="utf-8")

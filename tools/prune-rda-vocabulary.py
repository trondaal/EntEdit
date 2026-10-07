#!/usr/bin/env python3
"""Make a pruned copy of the vocabularies for large repositories.

With the rdfsplus-optimized ruleset every statement with an RDA property also
entails all of that property's super-properties and inverses. The registry
gives each property a constrained and an unconstrained version and a deep
hierarchy above it (up to the RDA Entity elements), so one title or link
entails 10-25 further statements. For a few thousand records that does not
matter; for millions (e.g. a full ISFDB conversion, ~50 million statements) it
adds about ten times as many inferred statements.

This script writes a copy of database/types in which only the RDA registry's
*property hierarchy* is reduced to the properties EntEdit actually uses:

  kept properties  = every RDA or EntEdit property named in the profile
                     (entedit_profile/), in the app's queries (app/src), in the
                     search connectors (database/lucene_connectors) and in
                     database/sparql, plus the inverses of these;
  rdfs:subPropertyOf / owl:equivalentProperty
                   = replaced by direct links from each kept property to every
                     kept property it reaches in the registry (so e.g. "has
                     author agent" still entails "has related agent of RDA
                     entity", which the connectors use);
  owl:inverseOf    = kept between kept properties;
  documentation    = predicates marked 'remove' in tools/prune-rda-predicates.csv
                     (RDA Toolkit labels and definitions, registry bookkeeping,
                     lexical aliases, scope notes, …) are left out;
  languages        = language-tagged literals (labels, definitions, …) only in
                     the languages in LANGUAGES below or --languages (en, no);
  everything else  = kept unchanged: labels, definitions, domains, ranges,
                     classes, the term vocabularies and the profile.

The pruned registry is written as rda_vocabulary/hierarchy.nt (the property
hierarchy) and one file per RDA element set (c.nt, w.nt, e.nt, m.nt, …: every
other statement whose subject is in that set) and registry.nt (the registry's
registration statuses), without duplicates.

Properties outside the kept set lose their super-properties and inverses, so
data using them gets no property inference. database/types itself is never
changed; the registry stays as published (VOCABULARY.md, section 2).

Usage:
  tools/prune-rda-vocabulary.py                 # writes build/types-pruned/
  tools/prune-rda-vocabulary.py --check         # also verifies the entailments
  tools/prune-rda-vocabulary.py --out DIR
  tools/prune-rda-vocabulary.py --languages en,no,sv   # also keep Swedish
  tools/prune-rda-vocabulary.py --nquads              # also build/types-pruned.nq

Install the result like the normal vocabularies, into a repository whose
rda_vocabulary graph is empty:
  tools/install-vocabularies.sh -e <endpoint> -U <user> --types build/types-pruned

or, for a first bulk load together with large data (GraphDB stopped), write it
as N-Quads with each folder in its named graph and load both in one run:
  tools/prune-rda-vocabulary.py --nquads
  importrdf preload -c <repository config> build/types-pruned.nq <data files>
"""
import argparse
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Languages of the labels, definitions and other language-tagged literals kept in the pruned copy
# (primary language subtag: "en" also keeps "en-GB"). Add a language here, or use --languages.
LANGUAGES = ("en", "no")
# Predicates to drop from the pruned copy: the rows marked "remove"
PREDICATES = Path(__file__).resolve().parent / "prune-rda-predicates.csv"
# Named graph of each folder: the same names as tools/install-vocabularies.sh and the Docker init
GRAPH_PREFIX = "http://oslomet.no/abi/graph/"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"
SUB, INV, EQ = RDFS + "subPropertyOf", OWL + "inverseOf", OWL + "equivalentProperty"
RDA = "http://rdaregistry.info/Elements/"
ENTEDIT = "http://oslomet.no/abi/vocab#"

# Prefixes used for RDA properties in the app's code (and conventionally elsewhere)
RDA_PREFIXES = {
    f"rda{e}{v}": f"{RDA}{e}/{path}"
    for e in "cwemiapntxu"
    for v, path in (("", ""), ("o", "object/"), ("d", "datatype/"))
}
TRIPLE = re.compile(r'^\s*(<[^>]*>|_:\S+)\s+<([^>]*)>\s+(.*?)\s*\.\s*$')
IRI_IN_TEXT = re.compile(r"https?://rdaregistry\.info/Elements/[a-z]+(?:/(?:object|datatype))?/P\d+"
                         r"|http://oslomet\.no/abi/vocab#P\d+")
PREFIXED = re.compile(r"\b([A-Za-z][\w-]*):(P\d+)\b")
TTL_PREFIX = re.compile(r"@prefix\s+([\w-]*):\s*<([^>]+)>", re.I)
LANGUAGE_TAG = re.compile(r'"@([A-Za-z]+)(?:-[\w-]+)?$')


def removed_predicates(path: Path) -> set[str]:
    """Predicates marked 'remove' in prune-rda-predicates.csv (lines starting with # are comments)."""
    import csv
    with open(path, encoding="utf-8") as f:
        rows = csv.DictReader(line for line in f if not line.startswith("#"))
        return {r["predicate"].strip() for r in rows if r["proposal"].strip().lower() == "remove"}


def used_properties(sources: list[Path]) -> set[str]:
    """RDA and EntEdit property IRIs named in the given files, as full IRIs or with prefixes
    (the file's own @prefix declarations, or the conventional rdaXo/rdaXd/rdaX prefixes)."""
    found: set[str] = set()
    for path in sources:
        text = path.read_text(encoding="utf-8", errors="replace")
        prefixes = dict(RDA_PREFIXES, entedit=ENTEDIT)
        prefixes.update({p: iri for p, iri in TTL_PREFIX.findall(text)})
        found.update(m.group(0).replace("https://", "http://") for m in IRI_IN_TEXT.finditer(text))
        for prefix, local in PREFIXED.findall(text):
            ns = prefixes.get(prefix)
            if ns and (ns.startswith(RDA) or ns == ENTEDIT):
                found.add(ns + local)
    return found


def source_files() -> list[Path]:
    files = sorted((ROOT / "database/types/entedit_profile").glob("*.ttl"))
    for folder, patterns in (("app/src", ("*.ts", "*.tsx")),
                             ("database/lucene_connectors", ("*.sparql",)),
                             ("database/sparql", ("*.sparql",))):
        for pattern in patterns:
            files += [f for f in sorted((ROOT / folder).rglob(pattern)) if ".test." not in f.name]
    return files


def read_registry(rda_dir: Path):
    """All N-Triples lines per file, and the property hierarchy and inverses of the whole registry."""
    files: dict[Path, list[str]] = {}
    sup: dict[str, set[str]] = defaultdict(set)
    inv: dict[str, set[str]] = defaultdict(set)
    for path in sorted(rda_dir.rglob("*.nt")):
        lines = path.read_text(encoding="utf-8").splitlines()
        files[path] = lines
        for line in lines:
            m = TRIPLE.match(line)
            if not m or not m.group(1).startswith("<") or not m.group(3).startswith("<"):
                continue
            s, p, o = m.group(1)[1:-1], m.group(2), m.group(3)[1:-1]
            if p == SUB:
                sup[s].add(o)
            elif p == EQ:
                sup[s].add(o)
                sup[o].add(s)
            elif p == INV:
                inv[s].add(o)
                inv[o].add(s)
    return files, sup, inv


def ancestors(p: str, sup: dict[str, set[str]]) -> set[str]:
    seen, todo = set(), [p]
    while todo:
        for q in sup.get(todo.pop(), ()):
            if q not in seen:
                seen.add(q)
                todo.append(q)
    seen.discard(p)
    return seen


def entailed(p: str, sup, inv, within: set[str]) -> set[tuple[str, int]]:
    """Properties (and direction: 1 same, -1 reversed) that a statement with p entails through
    subPropertyOf and inverseOf, restricted to the properties in `within`."""
    seen, todo = {(p, 1)}, [(p, 1)]
    while todo:
        q, d = todo.pop()
        for r in sup.get(q, ()):
            if (r, d) not in seen:
                seen.add((r, d))
                todo.append((r, d))
        for r in inv.get(q, ()):
            if (r, -d) not in seen:
                seen.add((r, -d))
                todo.append((r, -d))
    return {(q, d) for q, d in seen if q in within and q != p} | set()


def write_nquads(types_dir: Path, target: Path, graph_prefix: str) -> None:
    """Write every file under `types_dir` as N-Quads into one file, each folder in the named graph
    <graph_prefix><folder>, so that vocabularies and data can be loaded in one importrdf run.
    N-Triples files are converted line by line; Turtle and RDF/XML files are parsed with rdflib."""
    blank = re.compile(r"_:([A-Za-z0-9_.-]+)")
    statements = 0
    with open(target, "w", encoding="utf-8") as out:
        for n, path in enumerate(sorted(p for p in types_dir.rglob("*") if p.suffix in (".nt", ".ttl", ".rdf"))):
            folder = path.relative_to(types_dir).parts[0]
            graph = f"<{graph_prefix}{folder}>"
            if path.suffix == ".nt":
                lines = (line for line in open(path, encoding="utf-8") if TRIPLE.match(line))
            else:
                try:
                    import rdflib
                except ImportError:
                    sys.exit("--nquads needs rdflib for Turtle and RDF/XML files: pip install rdflib")
                g = rdflib.Graph().parse(path, format="turtle" if path.suffix == ".ttl" else "xml")
                lines = g.serialize(format="nt").splitlines()
            for line in lines:
                m = TRIPLE.match(line)
                if not m:
                    continue
                # blank node labels are only unique within a file: make them unique in the combined file
                triple = blank.sub(lambda b: f"_:f{n}x{b.group(1)}", line.strip()[:-1].rstrip())
                out.write(f"{triple} {graph} .\n")
                statements += 1
    print(f"N-Quads: {statements:,} statements in {target}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--types", type=Path, default=ROOT / "database/types", help="source vocabularies")
    ap.add_argument("--out", type=Path, default=ROOT / "build/types-pruned", help="where to write the copy")
    ap.add_argument("--languages", default=",".join(LANGUAGES),
                    help=f"comma-separated languages of literals to keep (default: {','.join(LANGUAGES)})")
    ap.add_argument("--predicates", type=Path, default=PREDICATES,
                    help="CSV of predicates; those marked 'remove' are dropped (default: tools/prune-rda-predicates.csv)")
    ap.add_argument("--nquads", nargs="?", type=Path, const=ROOT / "build/types-pruned.nq", metavar="FILE",
                    help="also write the pruned copy as one N-Quads file, each folder in its named graph "
                         "(default: build/types-pruned.nq), to load together with data in one importrdf run; "
                         "needs rdflib for the Turtle and RDF/XML files")
    ap.add_argument("--graph-prefix", default=GRAPH_PREFIX,
                    help=f"prefix of the named graphs, as in install-vocabularies.sh (default: {GRAPH_PREFIX})")
    ap.add_argument("--check", action="store_true",
                    help="verify that every kept property entails the same kept properties as before")
    args = ap.parse_args()

    rda_dir = args.types / "rda_vocabulary"
    if not rda_dir.is_dir():
        print(f"Not found: {rda_dir}", file=sys.stderr)
        return 1
    files, sup, inv = read_registry(rda_dir)
    named = used_properties(source_files())
    kept = named | {q for p in named for q in inv.get(p, ())}
    print(f"Properties named in the profile and the app: {len(named)}; kept with their inverses: {len(kept)}")

    # The pruned hierarchy: direct links from kept properties to the kept properties they reach.
    new_sup: dict[str, set[str]] = {p: ancestors(p, sup) & kept for p in kept}
    new_inv: dict[str, set[str]] = defaultdict(set)
    for p in kept:
        for q in inv.get(p, ()):
            if q in kept:
                new_inv[p].add(q)

    if args.out.exists():
        shutil.rmtree(args.out)
    # The term vocabularies and the profile are copied as they are; the registry is rewritten below.
    shutil.copytree(args.types, args.out, ignore=shutil.ignore_patterns(".DS_Store", "rda_vocabulary"))
    out_rda = args.out / "rda_vocabulary"
    out_rda.mkdir()

    # Everything except the property hierarchy, one file per RDA element set (by the subject's namespace:
    # c.nt classes, w.nt Work, e.nt Expression, …), without the duplicates between the registry's
    # combined and split files.
    by_set: dict[str, dict[str, None]] = defaultdict(dict)
    drop = removed_predicates(args.predicates) if args.predicates.exists() else set()
    languages = {lang.strip().lower() for lang in args.languages.split(",") if lang.strip()}
    before = dropped_predicate = dropped_language = 0
    for path, lines in files.items():
        for line in lines:
            m = TRIPLE.match(line)
            if not m:
                continue
            before += 1
            s, p = m.group(1).strip("<>"), m.group(2)
            if p in (SUB, EQ, INV):
                continue  # the hierarchy is written separately
            if p in drop:
                dropped_predicate += 1
                continue
            tag = LANGUAGE_TAG.search(m.group(3))
            if tag and tag.group(1).lower() not in languages:
                dropped_language += 1
                continue
            element_set = s[len(RDA):].split("/", 1)[0] if s.startswith(RDA) else ""
            # statements about the registry itself (its registration statuses) go to registry.nt
            by_set[element_set or "registry"][line.strip()] = None
    after = 0
    for element_set, lines in sorted(by_set.items()):
        heading = ("# Statements about the RDA Registry itself, e.g. the registration statuses Published and\n"
                   "# Deprecated (EntEdit leaves out deprecated properties)." if element_set == "registry" else
                   f"# RDA Registry element set '{element_set}' without its property hierarchy (see hierarchy.nt).")
        (out_rda / f"{element_set}.nt").write_text(
            heading + "\n# Generated by tools/prune-rda-vocabulary.py from database/types/rda_vocabulary.\n"
            + "\n".join(lines) + "\n", encoding="utf-8")
        after += len(lines)

    # The property hierarchy: direct links from each kept property to the kept properties it reaches,
    # and the inverses between kept properties.
    shortcuts = sorted((p, q) for p, qs in new_sup.items() for q in qs)
    inverses = sorted((p, q) for p, qs in new_inv.items() for q in qs)
    (out_rda / "hierarchy.nt").write_text(
        "# Generated by tools/prune-rda-vocabulary.py: the property hierarchy of the RDA Registry, reduced to\n"
        "# the properties EntEdit uses. rdfs:subPropertyOf links each kept property directly to every kept\n"
        "# property it reaches in the registry; owl:inverseOf as in the registry, between kept properties.\n"
        + "".join(f"<{p}> <{SUB}> <{q}> .\n" for p, q in shortcuts)
        + "".join(f"<{p}> <{INV}> <{q}> .\n" for p, q in inverses), encoding="utf-8")
    after += len(shortcuts) + len(inverses)
    print(f"RDA registry: {before:,} statements in {len(files)} files -> {after:,} in {len(by_set) + 1} files "
          f"(hierarchy: {len(shortcuts):,} subPropertyOf, {len(inverses):,} inverseOf)")
    print(f"Left out: {dropped_predicate:,} statements with {len(drop)} predicates marked 'remove' in "
          f"{args.predicates.name}, {dropped_language:,} literals in languages other than {', '.join(sorted(languages))}")
    print(f"Written to {args.out}")

    if args.nquads:
        write_nquads(args.out, args.nquads, args.graph_prefix)

    if args.check:
        problems = 0
        _, out_sup, out_inv = read_registry(out_rda)  # what was actually written
        for p in sorted(kept):
            full = entailed(p, sup, inv, kept)
            pruned = entailed(p, out_sup, out_inv, kept)
            if full != pruned:
                problems += 1
                if problems <= 10:
                    print(f"  differs for {p}: missing {sorted(full - pruned)[:3]}, extra {sorted(pruned - full)[:3]}")
        print(f"Check: {len(kept) - problems} of {len(kept)} kept properties entail the same kept properties"
              + ("" if not problems else f"; {problems} differ"))
        return 1 if problems else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())

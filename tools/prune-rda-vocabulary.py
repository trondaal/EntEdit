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
  everything else  = kept unchanged: labels, definitions, domains, ranges,
                     classes, the term vocabularies and the profile.

Properties outside the kept set lose their super-properties and inverses, so
data using them gets no property inference. database/types itself is never
changed; the registry stays as published (VOCABULARY.md, section 2).

Usage:
  tools/prune-rda-vocabulary.py                 # writes build/types-pruned/
  tools/prune-rda-vocabulary.py --check         # also verifies the entailments
  tools/prune-rda-vocabulary.py --out DIR

Install the result like the normal vocabularies, into a repository whose
rda_vocabulary graph is empty:
  tools/install-vocabularies.sh -e <endpoint> -U <user> --types build/types-pruned
"""
import argparse
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--types", type=Path, default=ROOT / "database/types", help="source vocabularies")
    ap.add_argument("--out", type=Path, default=ROOT / "build/types-pruned", help="where to write the copy")
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
    shutil.copytree(args.types, args.out, ignore=shutil.ignore_patterns(".DS_Store"))
    before = after = 0
    for path, lines in files.items():
        out_lines = []
        for line in lines:
            m = TRIPLE.match(line)
            if m:
                before += 1
                s, p, o = m.group(1).strip("<>"), m.group(2), m.group(3).strip("<>")
                if p in (SUB, EQ):
                    continue  # replaced by the pruned hierarchy below
                if p == INV and not (s in kept and o in kept):
                    continue
                after += 1
            out_lines.append(line)
        target = args.out / path.relative_to(args.types)
        target.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    shortcuts = sorted((p, q) for p, qs in new_sup.items() for q in qs)
    hierarchy = args.out / "rda_vocabulary/Elements/entedit-pruned-hierarchy.nt"
    hierarchy.write_text(
        "# Generated by tools/prune-rda-vocabulary.py: rdfs:subPropertyOf between the RDA and EntEdit\n"
        "# properties EntEdit uses, each linked directly to every such property it reaches in the\n"
        "# RDA Registry. Replaces the registry's own rdfs:subPropertyOf and owl:equivalentProperty.\n"
        + "".join(f"<{p}> <{SUB}> <{q}> .\n" for p, q in shortcuts), encoding="utf-8")
    after += len(shortcuts)
    print(f"RDA registry: {before:,} statements -> {after:,} "
          f"({len(shortcuts):,} direct subPropertyOf links between kept properties)")
    print(f"Written to {args.out}")

    if args.check:
        problems = 0
        for p in sorted(kept):
            full = entailed(p, sup, inv, kept)
            pruned = entailed(p, new_sup, new_inv, kept)
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

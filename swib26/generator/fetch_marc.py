"""Fetch the selected MARC 21 records into swib26/marc/<Example>.xml."""
import pathlib, xml.etree.ElementTree as ET
from sru import search, M
from selection import SELECTION
out = pathlib.Path(__file__).parents[1] / "marc"; out.mkdir(parents=True, exist_ok=True)
ET.register_namespace("", M[1:-1])
for example, pubs in SELECTION.items():
    coll = ET.Element(f"{M}collection")
    for slug, cat, query, rid, _ in pubs:
        hit = [r for r in search(cat, query) if r.findtext(f"{M}controlfield[@tag='001']") == rid]
        print(example, slug, "OK" if hit else "MISSING")
        if hit:
            coll.append(hit[0])
    ET.ElementTree(coll).write(out / f"{example}.xml", encoding="utf-8", xml_declaration=True)

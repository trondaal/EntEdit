"""Search library catalogues over SRU and list MARC 21 records briefly."""
import sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
M = "{http://www.loc.gov/MARC21/slim}"
BASES = {
    "bibsys": ("https://bibsys.alma.exlibrisgroup.com/view/sru/47BIBSYS_NETWORK", "1.2", "marcxml"),
    "loc": ("https://lx2.loc.gov/sru/voyager", "1.1", "marcxml"),
    "dnb": ("https://services.dnb.de/sru/dnb", "1.1", "MARC21-xml"),
    "bl": ("https://bl.alma.exlibrisgroup.com/view/sru/44BL_MAIN", "1.2", "marcxml"),
}
def search(cat, query, n=50):
    base, ver, schema = BASES[cat]
    url = base + "?" + urllib.parse.urlencode({"version": ver, "operation": "searchRetrieve",
          "recordSchema": schema, "maximumRecords": n, "query": query})
    req = urllib.request.Request(url, headers={"User-Agent": "EntEdit-examples/1.0"})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=60).read())
    return root.findall(f".//{M}record")
def sf(r, tag, codes):
    out = []
    for d in r.findall(f"{M}datafield[@tag='{tag}']"):
        out.append(" ".join(s.text or "" for s in d if s.get("code") in codes))
    return out
def brief(r):
    id_ = r.findtext(f"{M}controlfield[@tag='001']")
    pub = (sf(r, "260", "abc") + sf(r, "264", "abc") + [""])[0]
    return f"{id_} | {(sf(r,'245','abcnp') or [''])[0]} | {pub} | {(sf(r,'300','ac') or [''])[0]} | ISBN {sf(r,'020','a')[:2]} | 240:{sf(r,'240','al')} 505:{[x[:150] for x in sf(r,'505','a')]} 7xx:{[x[:50] for x in sf(r,'700','at')[:4]]}"
if __name__ == "__main__":
    for r in search(sys.argv[1], sys.argv[2]):
        print(brief(r))

"""Find VIAF identifiers through Wikidata (VIAF itself refuses scripted requests)."""
import json, sys, urllib.parse, urllib.request
UA = {"User-Agent": "EntEdit-examples/1.0 (teaching data)"}
def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
def search(text, n=4):
    q = urllib.parse.urlencode({"action": "wbsearchentities", "search": text, "language": "en", "limit": n, "format": "json"})
    return get("https://www.wikidata.org/w/api.php?" + q)["search"]
def claims(qids):
    q = urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(qids), "props": "claims", "format": "json"})
    out = {}
    for qid, e in get("https://www.wikidata.org/w/api.php?" + q)["entities"].items():
        c = e.get("claims", {})
        val = lambda p: [x["mainsnak"].get("datavalue", {}).get("value") for x in c.get(p, [])]
        out[qid] = {"viaf": val("P214"), "gnd": val("P227")}
    return out
if __name__ == "__main__":
    for text in sys.argv[1:]:
        hits = search(text)
        info = claims([h["id"] for h in hits]) if hits else {}
        for h in hits:
            print(f"{text!r:42} {h['id']:11} {h.get('label','')[:40]:40} | {h.get('description','')[:55]:55} | VIAF {info[h['id']]['viaf']}")

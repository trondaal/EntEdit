# SWIB26 tutorial exercises

Exercises for the EntEdit tutorial at SWIB26, published at <https://app.entedit.org/swib26/>.
This folder documents them as they were used; it is not part of the EntEdit application or of
its Docker images.

| File | |
|---|---|
| `index.html` | The task and the list of exercises |
| `cataloguing.html`, `translations-christie.html`, `relationships-little-women.html`, `collections-tolkien.html`, `user-tasks.html` | One page per exercise: the publications with a description, a content note and a link to a catalogue record, and the VIAF identifiers involved |
| `start/*.ttl` | What participants import (the cataloguing activity has none: each participant catalogues one of thirty novels from scratch, with no shared authors or works). Always the manifestations, people and publishers; beyond that it differs per exercise. Christie: nothing more. Little Women: also the works and expressions, linked to each other and to the manifestations, but no relationships between works or between expressions. Tolkien: also the distinct works listed on its page with their expressions (none for The Lord of the Rings as a whole), but no manifestation-to-expression links and no relationships between works or expressions |
| `solutions/*.ttl` | The complete models: works, expressions and their relationships. Not linked from the pages, but reachable by URL once published |
| `marc/*.xml` | The MARC 21 records the publication descriptions are taken from (BIBSYS, Library of Congress, Deutsche Nationalbibliothek, British Library) |
| `generator/` | The scripts that made all of the above |

People and works use their VIAF permalinks (`http://viaf.org/viaf/<number>`) as IRIs; everything
else has an ad hoc `http://example.org/...` IRI.

## Rebuilding

From `swib26/generator/` (Python 3 with no extra packages):

```bash
python3 fetch_marc.py   # fetch the MARC 21 records listed in selection.py into ../marc/
python3 build.py        # write the pages, start files and solutions
```

`selection.py` lists the publications and the catalogue record each comes from. `build.py` states
the works, expressions, agents and relationships, the content notes and headings, and the VIAF
identifiers. `sru.py` searches the catalogues, and `viaf_lookup.py` looks up VIAF identifiers
through Wikidata (VIAF itself refuses scripted requests).

## Publishing on app.entedit.org

Caddy on the server serves the folder directly from a checkout of this repository, so nothing in
the application's containers changes. On the server, check out only this folder:

```bash
git clone --filter=blob:none --sparse https://github.com/trondaal/EntEdit.git ~/entedit-swib26
cd ~/entedit-swib26 && git sparse-checkout set swib26
```

Mount it in the Caddy container (`docker-compose.override.yml`, under `caddy` → `volumes`):

```yaml
      - /root/entedit-swib26/swib26:/srv/swib26:ro
```

and serve it in the Caddyfile, before the final `handle`:

```
redir /swib26 /swib26/
handle_path /swib26/* {
	root * /srv/swib26
	@ttl path *.ttl
	header @ttl Content-Type "text/turtle; charset=utf-8"
	file_server
}
```

Then `docker compose up -d caddy`. Later changes are published with `git pull` in
`~/entedit-swib26`; Caddy picks up new files without a restart.

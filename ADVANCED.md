# Advanced setup and development

Building the images, developing the app, hosting it on your own server, and
administering many repositories. For ordinary installation see
[README.md](README.md).

## Contents

- [What the running system is made of](#what-the-running-system-is-made-of)
- [Running from a source checkout](#running-from-a-source-checkout)
- [Development](#development)
- [Self-hosting EntEdit and GraphDB](#self-hosting-entedit-and-graphdb)
- [Publishing to Docker Hub](#publishing-to-docker-hub)
- [Provisioning many repositories](#provisioning-many-repositories)
- [Repository structure](#repository-structure)
- [Tech stack](#tech-stack)

## What the running system is made of

The Docker installation starts three services:

| Service | URL | Description |
|---|---|---|
| Web app | http://localhost/entedit/ | EntEdit interface, served by nginx |
| GraphDB | http://localhost:7200 | The database, with its Workbench for administration |
| `graphdb-init` | — | Runs once, then exits |

The host ports are set by `ENTEDIT_PORT` (default 80) and `GRAPHDB_PORT`
(default 7200), for machines where either is already taken. Nothing else needs
changing: the app derives its default endpoint and the Workbench link from its
own origin.

`graphdb-init` creates the `EntEdit` repository with RDFS-Plus reasoning, imports
the vocabulary and the example entities (the examples go into the named graph
`http://oslomet.no/abi/examples`, so they can be managed independently of the
vocabulary), and creates the Lucene full-text indexes. It then writes a marker
triple, so later restarts skip the import. To wipe the data and import again,
restart that service with `FORCE_REINIT=1`.

If full-text search ever misses entities that clearly match — or returns them
inconsistently between identical searches — the Lucene index is out of step with
the data rather than the query being wrong. Rebuild it from the Workbench's
SPARQL editor, without touching the data:

```sparql
PREFIX : <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>
INSERT DATA { inst:expressionsIndex :repairConnector "" }
```

The same works for `inst:manifestationsIndex` and `inst:worksIndex`. GraphDB logs how many entities it
reindexed.

GraphDB Workbench on port 7200 is for database administration; it is not the
address EntEdit uses. The endpoint stays
`http://localhost/graphdb/repositories/EntEdit`, because a browser treats port
7200 as a different site from EntEdit itself and blocks the requests with a CORS
error. Port 80 goes through nginx, which forwards the request server-side, so the
problem never arises.

## Running from a source checkout

Useful when changing the vocabulary, the example data or the connector
definitions. Clone the repository and start Compose from the project root:

```bash
git clone https://github.com/trondaal/EntEdit.git
cd EntEdit
docker compose up -d
```

This still pulls the published images. To make Compose use your local `database/`
and `docker/graphdb/` files instead of the copies baked into
`trondaal/entedit-init`, add the development override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

To build the web image from source rather than pulling it (the `build`
sections live in the development override too):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml build web
```

## Development

Requires Node.js 20+ for the app, and Node 22+ to run the test suite. You also
need a GraphDB instance with an initialised repository.

```bash
cd app
npm install
npm run dev
```

Use the endpoint URL `http://localhost:7200/repositories/EntEdit`, pointing
straight at your own GraphDB. The dev server also proxies `/graphdb` to
`http://localhost:7200`, but prefer the direct URL: the graph visualisation opens
GraphDB Workbench, which renders correctly only when reached at the root of its
own origin. Going direct also leaves your GraphDB installation untouched — the app
never writes to Workbench settings across origins.

Other commands, from `app/`:

```bash
npm run build    # Production build
npm run preview  # Serve the production build at http://localhost:4173/entedit/
npm run lint     # ESLint
npm test         # Vitest suite
```

## Self-hosting EntEdit and GraphDB

### Before putting it on a shared server

The Docker setup is meant for a personal computer, where reaching the GraphDB
Workbench directly is part of the point. It has no authentication: anyone who can
reach the machine's port 80 or 7200 can read, edit and delete the data, including
dropping repositories from the Workbench.

For a shared server, run GraphDB separately with its own security enabled and
point EntEdit at it. [tools/create-repos.sh](tools/create-repos.sh)
sets up one repository per group and merges the matching read/write authorities
into the free-access list, so users need no login while the administrative
endpoints stay protected.

Two topologies work, and the choice decides what has to be configured.

### GraphDB proxied under the app's origin

For example the app at `https://example.org/entedit/` and the database at
`https://example.org/graphdb/repositories/EntEdit`. This is the better option: no
CORS, no port number in the endpoint, and it keeps working under HTTPS. It also
lets EntEdit pre-select the repository when opening the graph visualisation, so
users never meet the Workbench's repository chooser.

Two things need attention:

- The Workbench serves `<base href="/">` unless it knows better, so under a
  sub-path its assets resolve against the site root and fail to load. GraphDB
  rewrites the tag when the request's `Referer` matches a configured
  `graphdb.vhosts` entry, so setting that on the GraphDB server is the cleanest
  fix:

  ```
  graphdb.vhosts = https://example.org/graphdb/
  graphdb.external-url = https://example.org/graphdb/
  ```

  Where GraphDB cannot be configured — as in the Docker image, which must work on
  any hostname — rewrite the tag in the proxy instead. [app/nginx.conf](app/nginx.conf)
  does this with `sub_filter`; Apache's equivalent is `Substitute`.

- Keep the SPARQL path out of any such filter. Rewriting requires disabling
  upstream compression, which you do not want for query results: match
  `/graphdb/repositories/` in its own rule and proxy it untouched.

### GraphDB on its own host or port

Needs no proxy configuration at all, provided CORS is enabled on the GraphDB
server. The Workbench sits at the root of its own origin, so the visualisation is
correct as-is. The only difference is that each user has to select their
repository once in the Workbench, because the app can pre-select it only when both
are served from the same origin.

### GraphDB memory

GraphDB's start script sets a minimum heap of 1 GB and no maximum, so the JVM uses
its default: a quarter of the memory it can see. In the Docker setup that is a
quarter of what Docker may use, about 1.9 GB on 8 GB. Raise it with
`GDB_HEAP_SIZE` (minimum and maximum together; `GDB_MIN_MEM` and `GDB_MAX_MEM`
set them separately). `docker-compose.yml` passes the variable on, empty by
default, so `GDB_HEAP_SIZE=4g docker compose … up -d` is all a user needs (the
setup guide has the PowerShell and Command Prompt forms). It must be set on every
`up`, since leaving it out recreates the container with the default.

For a GraphDB you run yourself, set the same variable in its environment, or pass
`-Xmx4g` through `GDB_JAVA_OPTS`. Keep the heap below about half of the machine's
memory: GraphDB also needs memory outside the heap (its entity pool and caches) and
the operating system needs some for file caching. On a cloud VM, size the machine
for this: start with a heap of about a third to a half of its memory and raise it if
the GraphDB log shows an `OutOfMemoryError`.

## Publishing to Docker Hub

Maintainers only. Three artifacts make up a release, and together they are what
lets users start the system without downloading anything from GitHub:

| Artifact | Contents | Rebuild when |
|---|---|---|
| `trondaal/entedit` | Web app: nginx, the built bundle and the documentation | `app/` changes |
| `trondaal/entedit-init` | Vocabulary, example data, repository config, import script | `database/` or `docker/graphdb/` changes |
| `trondaal/entedit-compose` | The Compose file itself, as an OCI artifact | `docker-compose.yml` changes |

Note that `data/` (the full author example datasets used for manual testing) is
*not* part of `trondaal/entedit-init` — only `database/testdata/` is baked into
the image. A fix to a query or component under `app/` only needs the web app
image rebuilt and pushed; a change under `data/` needs no image rebuild at all
unless it is also copied into `database/testdata/`.

```bash
docker login                          # use a Personal Access Token
docker buildx create --use            # once, creates a multi-arch builder
```

The version tag matches `"version"` in [app/package.json](app/package.json) — bump
that first, so the two never drift apart, then use the same number below.

**Web app image** — built from `app/`:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t trondaal/entedit:1.0.23 -t trondaal/entedit:latest \
  --push ./app
```

**Init image** — the build context is the project root, so that `database/` and
`docker/graphdb/` can be copied in:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f docker/init/Dockerfile \
  -t trondaal/entedit-init:1.0.0 -t trondaal/entedit-init:latest \
  --push .
```

Both build for `amd64` (Intel/AMD) and `arm64` (Apple Silicon / ARM servers) and
push in one step. Multi-arch images cannot be loaded into the local Docker engine,
so they go straight to the registry via `--push`. Always publish a versioned tag
alongside `latest`.

Always push both platforms, even for a one-line fix pushed straight to `latest`.
A plain `docker build`/`docker push` only publishes an image for the machine's
own architecture — pushing that as `:latest` silently drops the other platform
from the tag until someone rebuilds multi-arch, breaking every user on the
architecture that got dropped. Use `docker buildx build --platform
linux/amd64,linux/arm64 --push` unconditionally, exactly as above.

**Compose file** — published as an OCI artifact, *after* the images above:

```bash
docker compose publish trondaal/entedit-compose:latest
```

Publishing requires the Compose file to be free of bind mounts, which is why
`graphdb-init` takes its data from the init image rather than from mounted
folders; the mounts live in `docker-compose.dev.yml`, which is not published.

`publish` also pushes the local image of every service that has a `build`
section, with no option to skip it. That is why `docker-compose.yml` has none
(they are in `docker-compose.dev.yml` as well): a local build is
single-platform, and pushing it as `latest` drops the other architecture.
Publish from `docker-compose.yml` alone, never with the dev override.

Users who already have an installation keep their existing data: `graphdb-init`
finds its marker triple and skips the import, so a new vocabulary reaches them
only if they re-initialise with `FORCE_REINIT=1`, which clears the repository.

## Provisioning many repositories

`tools/create-repos.sh` creates and initialises one repository per group
on any GraphDB server — the same procedure as the Docker init, parameterised:

```bash
./tools/create-repos.sh -e http://host:7200 -p VBINF6000-H26-G -n 12
```

Repositories are named `<prefix><zero-padded number>`. Each is created from
`docker/graphdb/repositories/EntEdit/config.ttl`, loaded with `database/types`,
and given the Lucene connectors; example data is imported only with `--testdata`.
Repositories already carrying the init marker are skipped unless `--force`. When
GraphDB security is enabled, the script merges read and write authorities for the
new repositories into the server's free-access list, so users need no login. Run
`--help` for all options.

The tools in `tools/` that talk to GraphDB take the admin login with `-U`. Leave out
`-P` and they ask for the password without echoing it, which avoids the shell
trouble with characters such as `!` and `*` on the command line. In scripts, put the
password in `GRAPHDB_PASSWORD` instead, in single quotes: `export
GRAPHDB_PASSWORD='p!ss*word'`.

### Giving each group a login

Where free access is not wanted, `tools/create-users.sh` creates one
GraphDB user per group, with access to that group's repository only:

```bash
./tools/create-users.sh -e http://host:7200 -p kurs- \
    -r VBINF6000-H26-G -n 12 -U admin -P secret -o users.csv
```

Usernames are the prefix plus an animal (`kurs-ulv`), and passwords are random
words plus four digits (`hatt-brun-gitar-1569`), so users can remember and
type them. The animal for a group is fixed by the prefix, which makes the script
safe to rerun: existing users are left alone and never get a new password. The
three words give about 34 bits of strength, enough for a course server but not for
anything valuable, since GraphDB does not lock an account after failed attempts.
The credentials are printed and, with `-o`, written to a file readable only by you;
hand each group its own line. `--per-repo 4` creates four users per repository,
each with an animal and password of their own, for individual logins within a
group. The first user of every group keeps the same name whatever `--per-repo` is,
so raising it later adds users without renaming anyone; plan for the final number
of groups from the start, because adding groups afterwards (with `--per-repo` above
1) moves animals around, which the script reports instead of skipping silently.
`--lang en` switches the word lists to English, `--access read` gives read-only
users. Do not combine it with free access on the
same repositories. Run `--help` for all options.

### Backing up repositories

`tools/backup-repos.sh` exports a set of repositories (`<prefix><number>`, like
`create-repos.sh`) to compressed TriG-star files, one per repository, with the
repository's configuration and a `manifest.tsv` of counts and sizes. The export is
complete — all named graphs and the RDF-star value-order annotations, no inferred
statements:

```bash
./tools/backup-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12 -U admin
```

Where things live decides what a backup contains, so it is worth knowing:

| Graph | What is in it |
|---|---|
| default graph | entities created in the editor, and anything imported without a graph |
| `http://oslomet.no/abi/graph/<folder>` | the vocabularies and the profile (reinstallable) |
| `http://oslomet.no/abi/examples` | the example data, and edits to those entities |

An entity created in the editor is written to the default graph; an entity that
already exists is saved back to the graph it was loaded from. To back up only what
people wrote, name the graphs you want with `--graph` (repeatable; `default` means
the default graph):

```bash
./tools/backup-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12 --graph default
```

The file is then called `<repo>.partial.trigs.gz` and the manifest has a `graphs`
column, so it is not mistaken for a full backup. A repository with nothing in the
chosen graph gets no file and is reported as "no data". To restore into a new
repository, create it, run `tools/install-vocabularies.sh`, and POST the
decompressed file to `<endpoint>/repositories/<repo>/statements` with
`Content-Type: application/x-trigstar`; every statement returns to the graph it came
from. On a repository installed before the vocabularies had graphs of their own, the
default graph still holds the vocabulary as well, and `--graph default` then backs
up that too.

## Installing or updating the vocabulary on an existing repository

`tools/install-vocabularies.sh` installs the vocabularies and the profile into any
repository you can reach, and runs the search connector queries. Give it the
repository's SPARQL endpoint and a login:

```bash
./tools/install-vocabularies.sh -e http://localhost:7200/repositories/EntEdit -U admin
```

The password is asked for (or taken from `GRAPHDB_PASSWORD`). The endpoint can be
GraphDB's own address or the app's proxy, `http://host/graphdb/repositories/<id>`; a
base URL plus `--repository <id>` works too.

Each folder of `database/types/` goes into a named graph of its own,
`http://oslomet.no/abi/graph/rda_vocabulary`, `…/term_vocabularies` and
`…/entedit_profile` (the example data keeps `http://oslomet.no/abi/examples`). That
is what makes an upgrade simple: **drop the graph you want replaced, run the script
again.** The script itself never deletes anything. A layer whose graph already has
content is skipped, and `--merge` adds to it anyway (blank-node statements are then
loaded a second time, so prefer dropping the graph). The connector queries drop and
recreate the three search indexes, which take a while to rebuild on a large
repository. `--skip-vocabularies` and `--skip-connectors` run one half only, and
`--dry-run` shows the plan.

```sparql
DROP GRAPH <http://oslomet.no/abi/graph/rda_vocabulary>
```

A repository installed before the vocabularies had graphs of their own holds them
in the default graph. The script adds the named graphs and prints, for each layer, a
`DELETE` that removes the old copy from the default graph once you are ready. Until
then nothing is wrong: GraphDB shows a statement that is in two graphs only once.

Through the app's proxy the files can be large, which the proxy allows in web images after
`1.0.21`; an older one answers 413, and the script then says to use GraphDB's
own address instead. `docker/graphdb/import-types.sh` (the Docker initialisation)
and `tools/create-repos.sh` use the same graph names.

## Repository structure

```
EntEdit/
├── app/                   # Web application (React 19 + TypeScript + Vite)
│   ├── public/docs/       # User documentation, served with the app
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # TanStack Query data fetching hooks
│   │   ├── utils/         # SPARQL client, label utilities, etc.
│   │   ├── locales/       # i18n strings (en/, no/)
│   │   └── types/         # TypeScript type definitions
│   ├── nginx.conf         # SPA + GraphDB proxy, used by the Docker image
│   ├── Dockerfile
│   └── package.json
├── database/              # RDF data and GraphDB configuration
│   ├── types/             # Vocabulary files loaded on first startup (see VOCABULARY.md)
│   ├── testdata/          # Example entities loaded on first startup
│   └── lucene_connectors/ # Lucene full-text index definitions
├── docker/                # Docker deployment configuration
│   ├── graphdb/           # Repository definition and init script
│   └── init/              # Dockerfile for the trondaal/entedit-init image
├── tools/                 # Admin scripts (bulk repository provisioning)
├── docker-compose.yml     # Published to Docker Hub as an OCI artifact
└── docker-compose.dev.yml # Override: mounts database/ into the init service
```

## Tech stack

- **Frontend**: React 19, TypeScript, Vite with SWC
- **UI**: Material-UI v7
- **State / caching**: TanStack Query
- **i18n**: i18next
- **Database**: GraphDB 10 (SPARQL 1.1, Lucene full-text connector)

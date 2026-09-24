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

The same works for `inst:manifestationsIndex`. GraphDB logs how many entities it
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

To build the web image from source rather than pulling it:

```bash
docker compose build web
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
point EntEdit at it. [tools/create-student-repos.sh](tools/create-student-repos.sh)
sets up one repository per group and merges the matching read/write authorities
into the free-access list, so students need no login while the administrative
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

**Web app image** — built from `app/`:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t trondaal/entedit:1.0.0 -t trondaal/entedit:latest \
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

For a quick single-platform fix (e.g. pushing `:latest` right after a bug fix,
to be followed later by a proper versioned multi-arch release), a plain
`docker build`/`docker push` also works, but only publishes an image for the
machine's own architecture:

```bash
docker build -t trondaal/entedit:latest ./app
docker push trondaal/entedit:latest
```

**Compose file** — published as an OCI artifact, *after* the images above:

```bash
docker compose publish trondaal/entedit-compose:latest
```

Publishing requires the Compose file to be free of bind mounts, which is why
`graphdb-init` takes its data from the init image rather than from mounted
folders; the mounts live in `docker-compose.dev.yml`, which is not published.

Users who already have an installation keep their existing data: `graphdb-init`
finds its marker triple and skips the import, so a new vocabulary reaches them
only if they re-initialise with `FORCE_REINIT=1`, which clears the repository.

## Provisioning many repositories

`tools/create-student-repos.sh` creates and initialises one repository per group
on any GraphDB server — the same procedure as the Docker init, parameterised:

```bash
./tools/create-student-repos.sh -e http://host:7200 -p VBINF6000-H26-G -n 12
```

Repositories are named `<prefix><zero-padded number>`. Each is created from
`docker/graphdb/repositories/EntEdit/config.ttl`, loaded with `database/types`,
and given the Lucene connectors; example data is imported only with `--testdata`.
Repositories already carrying the init marker are skipped unless `--force`. When
GraphDB security is enabled, the script merges read and write authorities for the
new repositories into the server's free-access list, so users need no login. Run
`--help` for all options.

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
│   ├── types/             # Vocabulary files loaded on first startup
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

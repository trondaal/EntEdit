# EntEdit

[![License: CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/80x15.png)](https://creativecommons.org/licenses/by-nc/4.0/)

A web-based editor for RDF entities, designed for cataloguing bibliographic resources using the IFLA-LRM/RDA vocabulary. EntEdit connects to a GraphDB triple store and provides a structured interface for browsing, searching, and editing Works, Expressions, Manifestations, Items, and related agents.

## Live demo

A read-only online demo is available at **[entedit.org/?demo](http://entedit.org/?demo)** — no installation required. Explore the interface with sample bibliographic data; editing is disabled in the demo. To run your own editable instance, see [Getting started](#getting-started) below.

## Features

- Browse RDF entities by class
- Full-text search via GraphDB Lucene connectors
- Edit datatype properties and object properties
- Manage multilingual labels (rdfs:label)
- Navigate WEMI relationships (Work → Expression → Manifestation → Item)
- Link entities to agents (creators, contributors, etc.)
- English and Norwegian interface

## Getting started

### Quick start — nothing to download (recommended)

Everything comes from Docker Hub: the web app, the GraphDB database, and a
one-shot initialiser image that carries the vocabulary, sample data and
repository definition. There is no source code to download, nothing to build,
and no Node.js or Git needed — just Docker.

**1. Install Docker.** If you don't already have it, install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS,
Linux) — it includes Docker Engine and Compose. See the
[official installation guide](https://docs.docker.com/get-docker/) for details.

**2. Start the system** with a single command, from any folder:

```bash
docker compose -f oci://docker.io/trondaal/entedit-compose:latest up -d
```

> **Where do I type this?** In a terminal — Terminal on macOS/Linux, Command
> Prompt or PowerShell on Windows. If you would rather not leave Docker Desktop,
> it has a terminal built in: click the **Terminal** button in the bottom-right
> corner of the window, next to the version number, and paste the command there.

**3. Open the app** at **http://localhost/entedit/** and enter this SPARQL
endpoint in the configuration wizard:

```
http://localhost/graphdb/repositories/EntEdit
```

That's it. Three images are pulled the first time —
[`trondaal/entedit`](https://hub.docker.com/r/trondaal/entedit) (web app),
[`ontotext/graphdb`](https://hub.docker.com/r/ontotext/graphdb) (database) and
[`trondaal/entedit-init`](https://hub.docker.com/r/trondaal/entedit-init)
(first-run data import).

### What happens on first startup

Three services are started:

| Service | URL | Description |
|---|---|---|
| Web app | http://localhost/entedit/ | EntEdit interface (served by nginx) |
| GraphDB Workbench | http://localhost:7200 | Database administration |
| `graphdb-init` | — | One-time service that creates the repository and imports data |

GraphDB Workbench on port 7200 is for database administration; it is not the
address EntEdit uses. The endpoint stays
`http://localhost/graphdb/repositories/EntEdit`, because a browser treats port
7200 as a different site from EntEdit itself and blocks the requests with a CORS
error. Port 80 goes through nginx, which forwards the request server-side, so the
problem never arises.

The `graphdb-init` service runs once and then exits, after it has:
1. Created the `EntEdit` repository with RDFS-Plus reasoning enabled
2. Imported the vocabulary files and the sample data (the samples go into a
   separate named graph, `http://oslomet.no/abi/examples`, so they can be managed
   independently)
3. Created the Lucene full-text search indexes

It marks the repository as initialised, so later restarts skip the import.
GraphDB data is persisted in a Docker volume and survives restarts. To wipe the
data and re-import from scratch, restart the init service with `FORCE_REINIT=1`.

For more detail — loading your own data, setting up a database without Docker,
ontology requirements — see the **Database Setup Guide** in the app documentation
([app/public/docs/en/setup.html](app/public/docs/en/setup.html), served at
`http://localhost/entedit/docs/en/setup.html` when the app is running).

### Stopping, updating and other commands

Everything came from Docker Hub, including the Compose file itself, which is
published there as an
[OCI artifact](https://docs.docker.com/compose/how-tos/oci-artifact/). That is why
nothing had to be downloaded — and it also means there is no compose file in your
folder for later commands to read. Repeat the same `-f oci://...` reference each
time:

```bash
docker compose -f oci://docker.io/trondaal/entedit-compose:latest down     # stop
docker compose -f oci://docker.io/trondaal/entedit-compose:latest pull     # update
docker compose -f oci://docker.io/trondaal/entedit-compose:latest logs -f  # inspect
```

If you would rather have a file on disk — or if your version of Docker Compose
does not understand `oci://` — download the one compose file into a folder of its
own and leave the `-f oci://...` part out of every command:

```bash
curl -O https://raw.githubusercontent.com/trondaal/EntEdit/main/docker-compose.yml
docker compose up -d
```

### Running from a source checkout

Useful if you want to change the vocabulary, sample data or connector
definitions. Clone the repository and start Compose from the project root:

```bash
git clone https://github.com/trondaal/EntEdit.git
cd EntEdit
docker compose up -d
```

This still pulls the published images. To make Compose use your local
`database/` and `docker/graphdb/` files instead of the ones baked into
`trondaal/entedit-init`, add the development override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

To build the web app image from source instead of pulling it:

```bash
docker compose build web
```

### Local development

Requires Node.js 20+ and a running GraphDB instance at `http://localhost:7200` with an `EntEdit` repository.

```bash
cd app
npm install
npm run dev
```

The dev server proxies `/graphdb` to `http://localhost:7200`. Use the endpoint URL `http://localhost:7200/repositories/EntEdit`, or let the proxy handle it.

Other commands (run from `app/`):

```bash
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
```

## Publishing to Docker Hub

Maintainers only. Three artifacts make up a release, and together they are what
lets users start the system without downloading anything from GitHub:

| Artifact | Contents | Rebuild when |
|---|---|---|
| `trondaal/entedit` | Web app (nginx + built React bundle) | `app/` changes |
| `trondaal/entedit-init` | Vocabulary, sample data, repository config, import script | `database/` or `docker/graphdb/` changes |
| `trondaal/entedit-compose` | The Compose file itself, as an OCI artifact | `docker-compose.yml` changes |

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

**Init image** — build context is the project root, so that `database/` and
`docker/graphdb/` can be copied in:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f docker/init/Dockerfile \
  -t trondaal/entedit-init:1.0.0 -t trondaal/entedit-init:latest \
  --push .
```

Both build for `amd64` (Intel/AMD) and `arm64` (Apple Silicon / ARM servers) and
push in one step. Multi-arch images cannot be loaded into the local Docker
engine, so they go straight to the registry via `--push`. Always publish a
versioned tag (e.g. `1.0.0`) alongside `latest`.

**Compose file** — published as an OCI artifact so users can run the project
straight from Docker Hub. Publish it *after* the images above, from the project
root:

```bash
docker compose publish trondaal/entedit-compose:latest
```

Publishing requires the Compose file to be free of bind mounts, which is why
`graphdb-init` gets its data from the init image rather than from mounted
folders; the mounts live in `docker-compose.dev.yml` instead, which is not
published. Verify a release with:

```bash
docker compose -f oci://docker.io/trondaal/entedit-compose:latest up -d
```

## Repository structure

```
EntEdit/
├── app/                   # Web application (React 19 + TypeScript + Vite)
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # TanStack Query data fetching hooks
│   │   ├── utils/         # SPARQL client, label utilities, etc.
│   │   ├── locales/       # i18n strings (en/, no/)
│   │   └── types/         # TypeScript type definitions
│   ├── Dockerfile
│   └── package.json
├── database/              # RDF data and GraphDB configuration
│   ├── types/             # Vocabulary files loaded on first startup
│   ├── testdata/          # Sample RDF entities loaded on first startup
│   └── lucene_connectors/ # Lucene full-text index definitions
├── docker/                # Docker deployment configuration
│   ├── graphdb/           # Repository definition and init script
│   └── init/              # Dockerfile for the trondaal/entedit-init image
├── tools/                 # Admin scripts (bulk repository provisioning)
├── docker-compose.yml     # Published to Docker Hub as an OCI artifact
└── docker-compose.dev.yml # Maintainer override: mount database/ into the init service
```

## Configuration

The app stores its configuration in browser localStorage. On first run a configuration wizard appears. Settings can be changed at any time via the gear icon in the header.

| Setting | Description |
|---|---|
| SPARQL endpoint | URL of the GraphDB repository |
| Username / password | Optional, for authenticated repositories |
| Language | Interface language (English / Norwegian) |

## Tech stack

- **Frontend**: React 19, TypeScript, Vite with SWC
- **UI**: Material-UI v7
- **State / caching**: TanStack Query
- **i18n**: i18next
- **Database**: GraphDB 10 (SPARQL 1.1, Lucene full-text connector)

## Licence

Copyright (c) 2025 Trond Aalberg

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) licence. You are free to use, share, and adapt the code for non-commercial purposes, provided you give appropriate credit. Commercial use is not permitted without explicit permission from the author.

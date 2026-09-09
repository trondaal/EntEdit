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

### Quick start from Docker Hub (recommended)

Both parts of the system run from **pre-built images on Docker Hub** — the web app
([`trondaal/entedit`](https://hub.docker.com/r/trondaal/entedit)) and the database
([`ontotext/graphdb`](https://hub.docker.com/r/ontotext/graphdb)). Nothing is
compiled on your machine: no Node.js, no `npm install`, no image build.

You do still need this repository's *configuration* files, because Docker Compose
reads `docker-compose.yml`, and the `database/` and `docker/` folders hold the
vocabulary, sample data and repository definition that are loaded into GraphDB the
first time it starts. Fetching them needs neither Git nor a build:

```bash
curl -L https://github.com/trondaal/EntEdit/archive/refs/heads/main.tar.gz | tar xz
cd EntEdit-main
```

(On Windows, or without `curl`, use the green **Code → Download ZIP** button on the
[GitHub page](https://github.com/trondaal/EntEdit) and unzip it instead.)

Then pull the images and start everything:

```bash
docker compose pull
docker compose up -d
```

Open **http://localhost/entedit/** and, in the configuration wizard, enter the
SPARQL endpoint:

```
http://localhost/graphdb/repositories/EntEdit
```

That is the whole setup — the rest of this section explains the same steps in more
detail, and what to do if you would rather build the app from source.

### Docker setup in detail

Docker Compose starts the web app and a pre-configured GraphDB database together.
The web app runs from the **pre-built image on
[Docker Hub](https://hub.docker.com/r/trondaal/entedit)** — you do **not** need to
build anything yourself or have Node.js installed.

> The commands below are run from a **terminal** (Command Prompt or PowerShell on
> Windows, Terminal on macOS/Linux), from inside the project folder.

**1. Install Docker.** If you don't already have it, install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS,
Linux) — it includes Docker Engine and Compose. See the
[official installation guide](https://docs.docker.com/get-docker/) for details.

**2. Get the configuration files.** Download this repository — not to build the
app, but because Compose needs the `docker-compose.yml` plus the `database/` and
`docker/` files that initialise the GraphDB database on first run:

```bash
git clone https://github.com/trondaal/EntEdit.git
cd EntEdit
```

(No Git? Use the green **Code → Download ZIP** button on the
[GitHub page](https://github.com/trondaal/EntEdit) and unzip it instead.)

**3. Get the images from Docker Hub.** This pulls `trondaal/entedit` and the
GraphDB image, and is also how you update to the latest published versions later:

```bash
docker compose pull
```

**4. Start it.** From the project root:

```bash
docker compose up -d
```

Compose uses the images pulled in the previous step — no local build. (The
`build:` entry in `docker-compose.yml` exists so maintainers can run
`docker compose build`; with an image available, Compose prefers pulling over
building.) To build the app from source yourself instead, see
[Local development](#local-development).

This starts three services:

| Service | URL | Description |
|---|---|---|
| Web app | http://localhost/entedit/ | EntEdit interface (served by nginx) |
| GraphDB Workbench | http://localhost:7200 | Database administration |
| `graphdb-init` | — | One-time service that creates the repository and imports data |

On first startup, the `graphdb-init` service automatically:
1. Creates the `EntEdit` repository with RDFS-Plus reasoning enabled
2. Imports the vocabulary files from `database/types/` and the sample data from
   `database/testdata/` (the samples go into a separate named graph,
   `http://oslomet.no/abi/examples`, so they can be managed independently)
3. Creates the Lucene full-text search indexes defined in `database/lucene_connectors/`

For more detail — loading your own data, setting up a database without Docker,
ontology requirements — see the **Database Setup Guide** in the app documentation
([app/public/docs/en/setup.html](app/public/docs/en/setup.html), served at
`http://localhost/entedit/docs/en/setup.html` when the app is running).

When the app loads, open the configuration wizard and enter the SPARQL endpoint:

```
http://localhost/graphdb/repositories/EntEdit
```

> **Note:** Use the proxied URL above (via nginx on port 80), not `http://localhost:7200/...` directly.
> Accessing GraphDB on port 7200 from the browser causes a CORS error because it is a different origin.
> The nginx proxy forwards the request server-side, avoiding this entirely.

GraphDB data is persisted in a Docker volume and survives restarts. To stop:

```bash
docker compose down
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

The web app image is published as `trondaal/entedit`. To build and push a new
release (maintainers only):

```bash
docker login                          # use a Personal Access Token

docker buildx create --use            # once, creates a multi-arch builder
docker buildx build --platform linux/amd64,linux/arm64 \
  -t trondaal/entedit:1.0.0 -t trondaal/entedit:latest \
  --push ./app
```

This builds for both `amd64` (Intel/AMD) and `arm64` (Apple Silicon / ARM
servers) and pushes in one step. Multi-arch images cannot be loaded into the
local Docker engine, so they go straight to the registry via `--push`. Always
publish a versioned tag (e.g. `1.0.0`) alongside `latest`.

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
│   └── graphdb/           # Repository definition and init script
└── docker-compose.yml
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

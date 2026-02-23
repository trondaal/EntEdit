# EntEdit

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

A web-based editor for RDF entities, designed for cataloguing bibliographic resources using the IFLA-LRM/RDA vocabulary. EntEdit connects to a GraphDB triple store and provides a structured interface for browsing, searching, and editing Works, Expressions, Manifestations, Items, and related agents.

## Features

- Browse RDF entities by class
- Full-text search via GraphDB Lucene connectors
- Edit datatype properties and object properties
- Manage multilingual labels (rdfs:label)
- Navigate WEMI relationships (Work → Expression → Manifestation → Item)
- Link entities to agents (creators, contributors, etc.)
- English and Norwegian interface

## Getting started

### With Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Compose.

```bash
docker compose up -d
```

This starts two services:

| Service | URL | Description |
|---|---|---|
| Web app | http://localhost/entedit/ | EntEdit interface |
| GraphDB Workbench | http://localhost:7200 | Database administration |

On first startup, the `graphdb-init` service automatically:
1. Imports all RDF vocabulary files from `database/types/` into the `EntEdit` repository
2. Creates the Lucene full-text indexes

When the app loads, open the configuration wizard and enter the SPARQL endpoint:

```
http://localhost:7200/repositories/EntEdit
```

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

The dev server proxies `/graphdb` to `http://localhost:7200`, so the same endpoint URL works as above.

Other commands (run from `app/`):

```bash
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
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
│   ├── graphdb/           # SPARQL connector query definitions
│   ├── lucene connectors/ # Full-text index definitions
│   └── inference rules/   # GraphDB inference rule sets
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

The URL parameter `?nosearch` hides the search tab if the Lucene connector is not available.

## Tech stack

- **Frontend**: React 19, TypeScript, Vite with SWC
- **UI**: Material-UI v7
- **State / caching**: TanStack Query
- **i18n**: i18next
- **Database**: GraphDB 10 (SPARQL 1.1, Lucene full-text connector)

## Licence

Copyright (c) 2025 Trond Aalberg

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) licence. You are free to use, share, and adapt the code for non-commercial purposes, provided you give appropriate credit. Commercial use is not permitted without explicit permission from the author.

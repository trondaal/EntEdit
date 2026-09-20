# EntEdit

[![License: CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/80x15.png)](https://creativecommons.org/licenses/by-nc/4.0/)

A web-based editor for RDF entities, designed for cataloguing bibliographic
resources using the IFLA-LRM/RDA vocabulary. EntEdit connects to a GraphDB triple
store and provides a structured interface for browsing, searching, and editing
Works, Expressions, Manifestations, Items, and related agents.

## Live demo

A read-only online demo is available at
**[entedit.org/?demo](http://entedit.org/?demo)** — no installation required.
Explore the interface with sample bibliographic data; editing is disabled in the
demo.

## Features

- Browse RDF entities by class
- Full-text search via GraphDB Lucene connectors
- Edit datatype properties and object properties
- Manage multilingual labels (rdfs:label)
- Navigate WEMI relationships (Work → Expression → Manifestation → Item)
- Link entities to agents (creators, contributors, etc.)
- English and Norwegian interface

## Getting started

There are two ways to run your own instance. **Option A is the one to choose**
unless you already run GraphDB yourself or would rather not use Docker.

### Option A — Everything with Docker

The app, the database and the initial vocabulary all come from Docker Hub.
Nothing to download, nothing to build.

**1. Install Docker.** If you don't have it, install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS,
Linux) — it includes everything needed.

**2. Start it** with a single command:

```bash
docker compose -f oci://docker.io/trondaal/entedit-compose:latest up -d
```

> **Where do I type this?** In a terminal — Terminal on macOS/Linux, Command
> Prompt or PowerShell on Windows. If you would rather not leave Docker Desktop,
> it has a terminal built in: click the **Terminal** button in the bottom-right
> corner of the window, next to the version number, and paste the command there.

Compose lists the variables the project uses and asks *"Do you want to proceed
with these variables? [Y/n]"* — press Enter.

**3. Open** **http://localhost/entedit/** and enter this SPARQL endpoint in the
configuration wizard:

```
http://localhost/graphdb/repositories/EntEdit
```

That's the whole installation. The first start creates the `EntEdit` repository,
loads the RDA vocabulary and a small set of example entities, and builds the
full-text search indexes — a minute or two, once.

**Stopping, updating, and looking at logs.** The Compose file itself lives on
Docker Hub rather than on your disk, so later commands need the same
`-f oci://...` reference:

```bash
docker compose -f oci://docker.io/trondaal/entedit-compose:latest down     # stop
docker compose -f oci://docker.io/trondaal/entedit-compose:latest pull     # update
docker compose -f oci://docker.io/trondaal/entedit-compose:latest logs -f  # inspect
```

Your data lives in a Docker volume and survives stops, restarts and updates.

> If your version of Docker Compose does not understand `oci://`, download the
> single Compose file into a folder of its own and run the commands there without
> the `-f oci://...` part:
> `curl -O https://raw.githubusercontent.com/trondaal/EntEdit/main/docker-compose.yml`

### Option B — The app from source, with your own GraphDB

For those who already run GraphDB, or would rather not use Docker. You will set
up the database yourself.

**1. Install Node.js.** Version 20 or newer, from
[nodejs.org](https://nodejs.org/) — it includes `npm`, which the commands below
use. Check what you have with `node --version`.

**2. Set up a GraphDB repository.** Install
[GraphDB](https://www.ontotext.com/products/graphdb/), create a repository, load
the vocabulary files from `database/types/`, and create the Lucene full-text
indexes by running the SPARQL queries in `database/lucene_connectors/`. The
**[Database Setup Guide](http://entedit.org/docs/en/setup.html)** walks through
each step under *Setting up your own database from scratch*.

**3. Build and run the app:**

```bash
git clone https://github.com/trondaal/EntEdit.git
cd EntEdit/app
npm install
npm run build
npm run preview
```

**4. Open** **http://localhost:4173/entedit/** and enter the endpoint for your own
repository, for example:

```
http://localhost:7200/repositories/EntEdit
```

## Configuration

The app stores its configuration in the browser. A configuration wizard appears on
first run, and the settings can be changed at any time from the gear icon in the
header.

| Setting | Description |
|---|---|
| SPARQL endpoint | URL of the GraphDB repository |
| Username / password | Optional, for repositories that require a login |
| Language | Interface language (English / Norwegian) |
| Cataloguing style | How visible RDF identifiers and labels are while editing |

**Cataloguing style** covers two ways of working. *Classic cataloguing* keeps
identifiers and labels off the form and generates them silently — they stay
available in the editor's ⋮ menu. *Semantic web cataloguing* shows both and
requires them on new entities. Identifier and labels are configured
independently, so you can show one and not the other. Adding `?style=classic` or
`?style=semantic` to the app's address sets the style for that session only,
which is handy for handing a class a single link.

## Documentation

- **[Cataloguing Guide](http://entedit.org/docs/en/index.html)** — the WEMI model,
  worked examples and exercises
- **[Database Setup Guide](http://entedit.org/docs/en/setup.html)** — loading your
  own data, setting up a database from scratch, ontology requirements

Both are also served by your own installation, under `/entedit/docs/`, and are
available in Norwegian.

## For developers and administrators

Building the images, running a development server, hosting EntEdit and GraphDB on
your own server, and provisioning repositories in bulk are covered separately in
**[ADVANCED.md](ADVANCED.md)**.

## Licence

Copyright (c) 2025 Trond Aalberg

This project is licensed under the
[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)
licence. You are free to use, share, and adapt the code for non-commercial
purposes, provided you give appropriate credit. Commercial use is not permitted
without explicit permission from the author.

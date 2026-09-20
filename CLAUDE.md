# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Run from the `app/` directory:

- `npm run dev` - Start development server with Vite (proxies /graphdb to localhost:7200)
- `npm run build` - Build for production (runs TypeScript check first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture Overview

EntEdit is a React-based RDF/SPARQL entity editor for browsing and editing semantic web data, with particular support for bibliographic entities using IFLA-LRM/RDA vocabulary (Work, Expression, Manifestation, Item relationships).

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite with SWC
- **UI Framework**: Material-UI v7 (Emotion CSS-in-JS)
- **State Management**: TanStack Query for server state caching
- **Virtual Scrolling**: @tanstack/react-virtual for large lists
- **Notifications**: notistack for snackbar messages
- **Internationalization**: i18next with English and Norwegian locales
- **SPARQL Integration**: Custom `SparqlClient` class for GraphDB

### Repository Layout

```
EntEdit/
├── app/                   # Web application (React/Vite)
│   ├── src/
│   │   ├── components/    # React components (see below)
│   │   ├── hooks/         # Data fetching hooks (TanStack Query)
│   │   ├── utils/         # Utilities (SparqlClient, labelUtils, etc.)
│   │   ├── types/         # TypeScript type definitions
│   │   ├── i18n/          # i18next configuration
│   │   ├── locales/       # Translation files (en/, no/)
│   │   └── App.tsx        # Root component with theme and query client
│   ├── Dockerfile
│   ├── nginx.conf         # nginx SPA + proxy config (used by the Docker image)
│   └── package.json
├── database/              # RDF data and GraphDB config
│   ├── types/             # Vocabulary files loaded into GraphDB on init
│   ├── sparql/            # SPARQL query definitions
│   ├── lucene_connectors/ # Lucene index configurations
│   └── testdata/          # Sample RDF entities for testing
├── docker/                # Docker deployment configs
│   ├── graphdb/           # Repository definition + init script
│   └── init/              # Dockerfile for trondaal/entedit-init (bakes in
│                          #   database/ + docker/graphdb/ so users need no checkout)
├── docs/                   # → served from app/public/docs/
│   ├── en/                 # English docs (primary/canonical)
│   ├── no/                 # Norwegian docs (translation)
│   ├── index.html          # Language redirector (reads localStorage)
│   └── setup.html          # Language redirector
├── tools/                 # Shared admin scripts (create-student-repos.sh)
├── scripts/               # Ad hoc scripts (gitignored, not for sharing)
├── docker-compose.yml     # No bind mounts — published to Docker Hub as an OCI artifact
├── docker-compose.dev.yml # Maintainer override: mounts database/ into graphdb-init
├── README.md              # User-facing: the two install paths only
├── ADVANCED.md            # Developers/admins: builds, dev setup, self-hosting, tools/
└── CLAUDE.md
```

### Key Components

**Core Layout:**
- `App.tsx` - Root with tab navigation, configuration state, theme provider
- `EntityBrowser` - Three-panel layout: classes → entities → editor
- `SearchInterface` - Full-text search using GraphDB Lucene connector
- `AppHeader` - Fixed header with endpoint config and language selector

**Entity Editing:**
- `EntityEditor` - Main editing form with property sections
- `DataPropertiesSection` - Manages datatype properties (text values)
- `EntityLabelsSection` - Manages rdfs:label in multiple languages
- `ObjectPropertySection` - Displays and manages object property values
- `OrderableValueList` - Drag-and-drop reordering for multi-value properties (@dnd-kit)

**WEMI Display:**
- `Expression`, `ExpressionList` - Expression view and list
- `Manifestation`, `ManifestationList`, `ManifestationResultSet`, `ManifestationSearchResult` - Manifestation display components

**UI Helpers:**
- `EntityEditorHeader` - Header section of entity editor
- `EntityPickerPanel` - Entity selection panel
- `LabelManager`, `LanguageSelector` - Label and language UI
- `ObjectPropertyGroup`, `ObjectPropertyValue` - Object property rendering
- `ResultSet` - Generic search result display

**Configuration:**
- `ConfigurationWizard` - First-run setup dialog
- `EndpointConfig` - SPARQL endpoint settings form

### Custom Hooks (app/src/hooks/)

**useSchemaQueries.ts** - OWL/RDFS schema introspection:
- `useRdfClasses` / `useRdfProperties` / `useRdfObjectProperties`

**useEntityQueries.ts** - Entity listing, pagination, and counts:
- `useEntitiesByClass` / `useInfiniteEntitiesByClass` / `useEntityCountByClass`
- `useEntitiesByRange` / `useInfiniteEntitiesByRange` / `useEntityCountByRange`

**useRelationshipQueries.ts** - WEMI and agent relationship properties:
- `useWEMIProperties` / `useAgentProperties`
- `useRelatedWorkProperties` / `useRelatedExpressionProperties` / `useRelatedManifestationProperties`

**useSearchQueries.ts** - Full-text search via GraphDB Lucene connector

**useDebouncedValue.ts** - Debounce hook for search inputs

**useManifestationQueries.ts** - Manifestation metadata queries

**useExpressionQueries.ts** - Expression queries by manifestation

### Utilities (app/src/utils/)

- `entityUpdate.ts` - pure SPARQL Update builder for entity save (diff-based), inverse
  cleanup and concurrent-edit detection; unit-tested in `entityUpdate.test.ts`
- `rdfTerms.ts` - RDF term model shared by load and save (IRI / literal with language
  tag or datatype), SPARQL serialization and term identity for diffing
- `luceneQuery.ts` - escapes free-text search input for the Lucene connector
- `turtleSerializer.ts` - Turtle serialization with configurable namespace prefix registry (`KNOWN_PREFIXES` map);
  predicates, datatypes, and `rdf:type` object (class) URIs are prefix-compacted; subject and other
  object URIs (entity references) stay as full `<uri>`
- `sparqlClient.ts` - SparqlClient class with query/update methods and auth support
- `configManager.ts` - localStorage persistence for app configuration
- `labelUtils.ts` - URI label extraction, formatting, SPARQL escaping
- `sparqlFragments.ts` - Reusable SPARQL fragments for language fallback
- `queryInvalidation.ts` - Cache invalidation after mutations
- `graphUtils.ts` - Generates GraphDB Workbench visualization URLs from endpoint URL
- `queryClient.ts` - TanStack Query client setup

### Data Flow

- Incoming triples (`?s ?p <entity>`) are converted to entity's perspective via
  `?inverseProp owl:inverseOf ?p` — used in search, expression, manifestation, and export queries
1. User selects RDF class → `useEntitiesByClass` fetches instances
2. User selects entity → `useEntity` loads all properties
3. Properties rendered dynamically based on rdfs:domain/range
4. Updates via SPARQL UPDATE → cache invalidation triggers refresh

### SPARQL Query Patterns

- OWL ontology queries for classes (`owl:Class`) and properties
- Property filtering by `rdfs:domain` and `entedit:status = "active"`
- Property ordering via `entedit:order` predicate
- Language-aware queries with COALESCE fallback (selected → untagged → fallback)
- GraphDB Lucene connector for full-text search (`lucene:query`)
- RDF-star annotations for value ordering: `<< <s> <p> <o> >> entedit:valueOrder N`

### Entity Save/Delete Strategy

`useEntityQuery` loads an entity twice: the **explicit snapshot**
(`loadEntitySnapshot`, inference OFF) carrying full RDF terms (language tag,
datatype), the named graph of each triple and its `entedit:valueOrder`, and the
**inferred view** (inference ON). Values present only in the inferred view are
marked `OrderedValue.inferred`, shown read-only with an "inferred" chip, and are
never written back — otherwise every save would materialize inferred supertypes
and inverse relationships as asserted triples.

**Save (diff, never rewrite):** `buildEntityUpdate` (`utils/entityUpdate.ts`) is
a pure function that diffs the snapshot against what the form holds and emits a
single `;`-joined update:
1. `DELETE DATA` for managed triples that disappeared, **each in the graph it was
   loaded from** (a `DELETE` without `GRAPH` spans all graphs, while
   `INSERT DATA` writes to the default graph — that mismatch used to move
   entities out of their named graph)
2. `INSERT DATA` for new triples, into the entity's graph (`targetGraph`, the
   graph of its `rdf:type`)
3. RDF-star `entedit:valueOrder` annotations rewritten only for properties whose
   values or order actually changed; data that was never ordered by the editor
   is left unannotated
4. `buildInverseCleanup` removes inverse triples (`owl:inverseOf` in either
   direction) for relationship values the user removed, plus their annotations

Unchanged triples produce no operations at all, so language tags, datatypes,
named graphs and unmanaged properties survive untouched, and a save that
changes one property cannot clobber another.

**Removing an inferred relationship:** inferred values are read-only for
*editing* but can be *removed*. Cataloguers link A→B or B→A inconsistently, so a
relationship must be removable from whichever side is open. `findRemovedRelations`
collects both the explicit links the diff dropped and the inferred ones the user
deleted from the form; `buildInverseCleanup` then deletes the statement that
entails the link — which for an inferred one lives on the *other* entity. Nothing
is materialized: the inferred value is still never written back. Inferred
*literals* (from superproperty inference) stay read-only, since no single
reciprocal statement corresponds to them.

**Conflict detection:** before writing, the properties the save will touch
(`changedProperties`) are compared with a freshly loaded snapshot
(`findConflicts`). If someone else changed one of them, the save is refused and
the user is asked to refresh. Only the properties being written are compared, so
unrelated concurrent edits don't block a save.

**New entities:** a custom URI is checked with a `COUNT` query first — inserting
into a URI that already has statements would silently merge the two entities.
Save is disabled until the form holds a value or a label.

**Entity delete (full blanket):** one request deleting RDF-star annotations on
outgoing *and* incoming triples, then all outgoing + incoming statements.

**URI type tracking:** `OrderedValue.isUri` comes from the SPARQL binding type
during load. On save, `objectPropertyUris.has(prop) || isUri` decides whether a
value is serialized as `<uri>` or a literal, so unmanaged relationship
properties are not turned into strings.

### SPARQL Syntax Gotchas (GraphDB)

- `FROM <http://www.ontotext.com/explicit>` restricts query to explicitly asserted triples only
  (excludes materialized inferences from forward-chaining); use when inferred supertypes/
  superproperties would cause unwanted duplicates
- `DELETE WHERE { ... VALUES ?x { } }` is invalid — use long form `DELETE { } WHERE { ... VALUES }`
- `OPTIONAL` with extra variables (e.g., `?order`) in `SELECT DISTINCT` can cause
  duplicate rows if the optional matches multiple times through inference
- RDF-star `<< s p o >>` OPTIONAL clauses may interact unpredictably with inference;
  consider separate queries if results are affected
- `SparqlClient.query()` = inference ON; `SparqlClient.queryWithoutInference()` = inference OFF
- `DELETE`/`DELETE WHERE` without `GRAPH` removes matching triples from **every**
  graph, but `INSERT DATA` without `GRAPH` writes to the default graph; use
  `DELETE DATA`/`INSERT DATA` with an explicit `GRAPH` to keep data in place
- The Lucene connector rejects bare query syntax (`(`, `"`, `:`, `AND`), so user
  input goes through `toLuceneQuery` (`utils/luceneQuery.ts`) before it is
  placed in `lucene:query`
- Schema property queries (`useRdfProperties`, `useRdfObjectProperties`, relationship hooks)
  run with inference and no JS-side deduplication — stale/duplicate annotation triples
  (e.g., multiple `entedit:order` values) cause duplicate properties in the editor UI;
  when reloading vocabulary files, delete old annotation triples first

### UI Patterns

- Features depending on saved database state (e.g., Turtle export) must be disabled when
  `isDirty` — pass `isDirty` to header and disable with tooltip explaining "save first"
- `LabelManager` dialog uses `hideBackdrop`, `disableEnforceFocus`, `disableAutoFocus`,
  `disableRestoreFocus` to allow interaction with content behind it (non-modal)
- Drag-and-drop reordering via @dnd-kit only shows controls when editing with 2+ values
- Controls must not move between view and edit mode: the identifier is the same
  `TextField` in both states (read-only, with lock and copy adornments, once
  saved) and uses the same monospace type in both, and the identity rows and
  section headers reserve the height of the controls that only appear while
  editing (`minHeight: 40`)

### Localization

Two namespaces in `app/src/locales/{lang}/`:
- `common.json` - Shared UI strings (buttons, messages, navigation)
- `entityEditor.json` - Entity editor specific labels

Language fallback: selected language → no language tag → opposite language (en↔no)

### Documentation

User-facing docs are static HTML in `app/public/docs/{lang}/`:
- `index.html` — Cataloguing guide (WEMI model, examples, exercises)
- `setup.html` — Database setup guide (Docker, GraphDB, ontology)

English (`en/`) is the primary language; Norwegian (`no/`) is a translation that must
be updated whenever English changes. Redirectors at `docs/index.html` and `docs/setup.html`
read `entEdit.language` from localStorage to pick the language folder.

A terminology glossary at `docs/glossary.json` maps English terms to each language.
It covers class names, property labels, relationship names, UI section headings, and
general domain terms. Property labels marked `"ui": true` come from the database and
must match what the user actually sees in the application for that language. Always
consult the glossary when translating documentation.

WEMI class names are translated: Work=Verk, Expression=Uttrykk, Manifestation=Manifestasjon,
Item=Eksemplar, Agent=Agent. Norwegian gender: Verk/Uttrykk are neuter (et/nytt),
Manifestasjon/Agent are masculine (en/ny). When listing classes, use the order:
Work → Expression → Manifestation → (Item) → Agent.

Adding a new language: create `docs/{lang}/` with translated files, add the language code
to the redirectors' JS and to `AppHeader.tsx`'s help button URL logic, and add a column
for the new language in `docs/glossary.json`.

Vite base path is `/entedit/`, so dev server serves docs at `/entedit/docs/{lang}/`.

### Docker Distribution

Users start the system entirely from Docker Hub — no GitHub download:
`docker compose -f oci://docker.io/trondaal/entedit-compose:latest up -d`.
That requires three published artifacts: `trondaal/entedit` (web app),
`trondaal/entedit-init` (alpine + curl with `database/` and `docker/graphdb/`
baked in, built from `docker/init/Dockerfile` with the project root as context),
and `trondaal/entedit-compose` (the Compose file as an OCI artifact, via
`docker compose publish`).

`app/nginx.conf` must keep two things: the `sub_filter` that rewrites the
Workbench's `<base href="/">` to `/graphdb/` (its relative assets 404 otherwise,
giving an unstyled page), and the separate `/graphdb/repositories/` location that
is proxied untouched — the rewrite requires `Accept-Encoding ""`, and SPARQL
results should stay compressed. The graph-visualization link and its repository
pre-selection (`prepareWorkbenchRepository` in `graphUtils.ts`) only work when
GraphDB shares the app's origin; cross-origin deployments fall back to the user
selecting a repository in the Workbench.

`docker-compose.yml` must therefore stay free of bind mounts — OCI publishing
rejects them. Local `database/` files are mounted through `docker-compose.dev.yml`
instead; use it whenever testing vocabulary, testdata or connector changes,
otherwise the baked-in copies from the init image are used. Changes under
`database/` or `docker/graphdb/` only reach users after `trondaal/entedit-init`
is rebuilt and pushed.

### Provisioning Repositories for Teaching

`tools/create-student-repos.sh` creates and initializes one GraphDB repository per
student group on any GraphDB server — same procedure as the Docker init, but
parameterized:

```
./tools/create-student-repos.sh -e http://host:7200 -p VBINF6000-H26- -n 12
```

Names are `<prefix><zero-padded group number>` (`VBINF6000-H26-01` … `-12`).
Each repository is created from `docker/graphdb/repositories/EntEdit/config.ttl`
(repository ID and label substituted), loaded with `database/types`, and given the
Lucene connectors from `database/lucene_connectors`; test data is imported only with
`--testdata`. Repositories carrying the init marker are skipped unless `--force`.
When GraphDB security is enabled, the script merges `READ_REPO_`/`WRITE_REPO_`
authorities for the new repositories into the server's free-access list so students
need no login (`--access read|write|none`). Run `--help` for all options.

### Configuration

- Persisted to localStorage (`entEdit.config`, `entEdit.language`,
  `entEdit.preferences`); credentials live in sessionStorage
- `ConfigurationWizard` shown on first run or when unconfigured
- URL parameter `?nosearch` hides the search tab
- Default endpoint is derived from the app's own origin
  (`<origin>/graphdb/repositories/EntEdit`), not a hard-coded host

**Cataloguing style** (`utils/catalogingStyle.ts`) decides how prominent RDF
identity is in the editor, supporting both classic cataloguing and semantic-web
cataloguing from one build:

- Four style preferences: `showIdentifier`, `showLabels`, `requireIdentifier`
  and `requireLabel`. The presets `CLASSIC_PREFERENCES` (all off) and
  `SEMANTIC_PREFERENCES` (all on) are offered as one-click choices in the wizard
  and the settings dialog (`CatalogingStyleSettings`); any other combination is
  reported as "custom". New installations default to semantic.
- `showInferredMarks` is a fifth preference that belongs to **no** style: off in
  both presets, excluded from `styleOf`'s comparison so toggling it does not
  read as "custom", and carried across by `applyPreset` so choosing a style
  never changes it. It controls only the "inferred" chip and dashed outline;
  inferred values behave identically either way, removal included.
- Hidden fields are not lost: `EntityEditor` offers an "Identifier and labels…"
  dialog from the ⋮ menu whenever either is hidden, and a missing identifier or
  label is generated on save as before.
- `require*` blocks saving a **new** entity until the field is filled in
  (surfaced through `saveBlockedReason`, the same mechanism that prevents empty
  entities). It replaced the older save-warning dialog and the
  `warnAutoUri`/`warnAutoLabel` preferences, which are still read from
  localStorage and migrated.
- `?style=classic` / `?style=semantic` overrides the stored preferences for one
  session, so a class can be given a single link (`applyStyleOverride`).

### Ontology Assumptions

The application expects:
- `entedit:status` predicate to mark active classes/properties
- `entedit:order` predicate for property display ordering
- `entedit:valueOrder` predicate (via RDF-star) for multi-value ordering within a property
- Standard RDFS vocabulary (rdfs:label, rdfs:domain, rdfs:range)
- RDA vocabulary for bibliographic entities (Work, Expression, Manifestation, Item)
- Properties must have correct `entedit:status` to appear in the editor UI;
  untagged properties are preserved during save but not displayed or editable

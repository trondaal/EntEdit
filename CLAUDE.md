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
│   └── package.json
├── database/              # RDF data and GraphDB config
│   ├── types/             # Vocabulary files loaded into GraphDB on init
│   ├── sparql/            # SPARQL query definitions
│   ├── lucene connectors/ # Lucene index configurations
│   ├── inference rules/   # GraphDB inference rule sets
│   └── testdata/          # Sample RDF entities for testing
├── docker/                # Docker deployment configs
│   ├── nginx/             # nginx SPA + proxy config
│   └── graphdb/           # Repository definition + init script
├── docs/                   # → served from app/public/docs/
│   ├── en/                 # English docs (primary/canonical)
│   ├── no/                 # Norwegian docs (translation)
│   ├── index.html          # Language redirector (reads localStorage)
│   └── setup.html          # Language redirector
├── scripts/               # Ad hoc scripts (gitignored, not for sharing)
├── docker-compose.yml
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

- `turtleSerializer.ts` - Turtle serialization with configurable namespace prefix registry (`KNOWN_PREFIXES` map);
  only predicates/datatypes are prefix-compacted, subject/object URIs stay as full `<uri>`
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

The entity load query runs WITH inference (`infer: true`), so it returns both
asserted triples and inferred inverse properties. This has critical implications:

**Save (targeted delete + re-insert):**
1. Only delete outgoing triples for **managed** properties (rdf:type, rdfs:label,
   data properties from `properties`, object properties from `objectPropertyUris`)
2. Diff old vs new `entityData` to find removed object property URI values
3. For each removed URI value, delete incoming triples from that entity
   (`<removedEntity> ?p <thisEntity>`) to clean up asserted inverse triples
4. Re-insert all current data from `entityData`

**Why targeted delete:** A blanket `DELETE { <e> ?p ?o . ?s ?p2 <e> . }` destroys
incoming triples from other entities and properties not managed by the editor
(those without `entedit:status`). These can't be restored because they may never
appear in `entityData` (incoming-only) or get serialized as literals instead of URIs.

**Entity delete (full blanket):** Deletes ALL outgoing + incoming triples and
RDF-star annotations to avoid dangling references.

**URI type tracking:** `OrderedValue.isUri` is captured from the SPARQL binding
type during load. During save, `objectPropertyUris.has(prop) || isUri` determines
whether to serialize as `<uri>` or `"literal"`. This prevents unmanaged relationship
properties from being corrupted into string literals.

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

### UI Patterns

- Features depending on saved database state (e.g., Turtle export) must be disabled when
  `isDirty` — pass `isDirty` to header and disable with tooltip explaining "save first"
- `LabelManager` dialog uses `hideBackdrop`, `disableEnforceFocus`, `disableAutoFocus`,
  `disableRestoreFocus` to allow interaction with content behind it (non-modal)
- Drag-and-drop reordering via @dnd-kit only shows controls when editing with 2+ values

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

### Configuration

- Persisted to localStorage (`entEdit.config`, `entEdit.language`)
- `ConfigurationWizard` shown on first run or when unconfigured
- URL parameter `?nosearch` hides the search tab
- Default endpoint: `http://localhost:7200/repositories/EntEdit`

### Ontology Assumptions

The application expects:
- `entedit:status` predicate to mark active classes/properties
- `entedit:order` predicate for property display ordering
- `entedit:valueOrder` predicate (via RDF-star) for multi-value ordering within a property
- Standard RDFS vocabulary (rdfs:label, rdfs:domain, rdfs:range)
- RDA vocabulary for bibliographic entities (Work, Expression, Manifestation, Item)
- Properties must have correct `entedit:status` to appear in the editor UI;
  untagged properties are preserved during save but not displayed or editable

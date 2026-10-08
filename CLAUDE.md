# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Run from the `app/` directory:

- `npm run dev` - Start development server with Vite (proxies /graphdb to localhost:7200)
- `npm run build` - Build for production (runs TypeScript check first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

No local GraphDB? Mock `window.fetch` in the browser to test UI with fake SPARQL
JSON responses — match on the *first* `SELECT` keyword's clause only, not the
whole query text, since nested subqueries (e.g. for creators/relationships)
can share the same `SELECT DISTINCT ?var` shape as the outer query and cause
false-positive matches.

## Architecture Overview

EntEdit is a React-based RDF/SPARQL entity editor for browsing and editing semantic web data, with particular support for bibliographic entities using IFLA-LRM/RDA vocabulary (Work, Expression, Manifestation, Item relationships).

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite with SWC
- **UI Framework**: Material-UI v9 (Emotion CSS-in-JS) — package.json pins `^9.0.0`
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
├── tools/                 # Shared admin scripts (create-repos.sh, create-users.sh, install-vocabularies.sh)
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
- `SearchInterface` - Full-text search using GraphDB Lucene connectors, three tabs
  in this order: publications (default, `manifestationsIndex`), content
  (`expressionsIndex`) and works (`worksIndex`)
- `AppHeader` - Fixed header with endpoint config and language selector

**Entity Editing:**
- `EntityEditor` - Main editing form with property sections
- `DataPropertiesSection` - Manages datatype properties (text values)
- `EntityLabelsSection` - Manages rdfs:label in multiple languages
- `ObjectPropertySection` - Displays and manages object property values
- `OrderableValueList` - Drag-and-drop reordering for multi-value properties (@dnd-kit)

**WEMI Display:**
- `Work`, `WorkExpressionList` - Work search result; its expressions load when opened,
  each with a Publications chip that opens its `ManifestationList`
- `Expression`, `ExpressionList` - Expression view and list
- `Manifestation`, `ManifestationList`, `ManifestationSearchResult` - Manifestation display components
- `ResultSet` - result list shared by the three search tabs (`renderResult` per tab)
- `ResultLines` - creator/relationship lines and chips styled like the result cards

**UI Helpers:**
- `EntityEditorHeader` - Header section of entity editor
- `EntityPickerPanel` - Entity selection panel
- `LabelManager`, `LanguageSelector` - Label and language UI
- `ObjectPropertyGroup`, `ObjectPropertyValue` - Object property rendering
- `SearchFilters` - Checkbox filters with hit counts for all searches, grouped
  work → expression → manifestation (`FILTER_FIELDS`: category of work, genre or
  form, language, content type; publications add media and carrier type), values
  by hit count; each search tab keeps its own selection. Beside the checkboxes,
  every selection and a followed link (the entity's name) is a removable chip, in the
  order chosen, last one at the bottom (kept per tab as `selectionKey`/
  `LINK_SELECTION` keys); chips and boxes share state, and "Clear all", aligned
  with the chips, removes filters and link
- `CollapsibleNote` - Manifestation note cut to two lines, "show the whole note"
  link included; the cut is measured (CSS line-clamp cannot fit the link)

**Configuration:**
- `ConfigurationWizard` - First-run setup dialog
- `EndpointConfig` - SPARQL endpoint settings form

### Custom Hooks (app/src/hooks/)

**useSchemaQueries.ts** - OWL/RDFS schema introspection:
- `useRdfClasses` / `useRdfProperties` / `useRdfObjectProperties`

**useEntityQueries.ts** - Entity listing, pagination, and counts:
- `useEntitiesByClass` / `useInfiniteEntitiesByClass` / `useEntityCountByClass`
- `useEntitiesByRange` / `useInfiniteEntitiesByRange` / `useEntityCountByRange`
- the infinite lists and the counts use the `entitiesIndex` connector when
  `useEntityIndexAvailable` finds it built and the class is one of
  `INDEXED_CLASSES`, and the SPARQL queries otherwise (see `entityList.ts`)

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
- `luceneQuery.ts` - turns free-text search input into a Lucene query: every word
  required (`+word`), punctuation-only words ("/", "–") left out — required, they
  matched nothing and emptied the result — and, for two or more words, an optional
  boosted phrase on names/titles/labels so the entity labelled with the whole text
  (e.g. a clicked relationship target) ranks first. Clicked names and titles are
  searched as plain text (`handleEntitySearch`), not wrapped in quotes
- `searchLink.ts` - a followed result link (`LinkTarget`: label, URI, kind), kept
  per search tab and shown as a removable chip with its label. `toLinkQuery` builds
  the ordinary Lucene query for it: an expression or work link is limited by an
  IRI field (`+expression:"<IRI>"`, `+work:"<IRI>"`; `$self` and the work links
  in every connector — the publication index reaches them through the embodied
  expressions, the work index has the work as `$self` and its expressions) with the label's words as *optional* ranking terms
  (`toLuceneQuery(…, { optional: true })`), so a work's original ranks before
  its translations; an agent link searches the name as a phrase in the names
  field (`toNameQuery`). Filters and facet counts apply on top. A link query that
  finds nothing at all (an index whose connectors were not recreated with the
  link fields, a work without expressions) falls back to the label as text
  (`findHits`, `textQueryFor`). Following a link clears the filters; removing the
  chip or typing returns to a plain search
- `entityList.ts` - the editor's entity lists through `entitiesIndex`
  (`database/lucene_connectors/entities_index.sparql`: fields `label`, `sortLabel`,
  `rdfType`, over the editor's classes). The index only decides which 50 entities
  a page holds and in what order (`lucene:orderBy "sortLabel"`, `lucene:totalHits`
  for counts); the labels come from a SPARQL lookup for those 50, so they follow
  the UI language and switching needs no reindexing. The lookup ends with *any*
  label (`createLanguageFallbackFragment(…, anyLanguage)`), so an entity with a
  label in some other language is never shown by its URI. SPARQL fallback when the
  connector is missing: an absent connector gives *no rows*, not an error, so
  availability is read from `connectorStatus`. Limits: `sortLabel` must be
  single-valued (several labels → one of them, arbitrary; case-sensitive byte
  order), the filter matches word beginnings in every language rather than any
  substring, and entities without a label sort first. A new editor class must be
  added to the connector's `types` and to `INDEXED_CLASSES`; unit-tested
- `wemiQueries.ts` - work/expression/manifestation detail queries shared by the search
  pages and the expandable lists under a result, built around a *scope* pattern
- `searchFilters.ts` - search category filters as Lucene clauses (OR within a
  field, AND across), the fields each index offers (`INDEX_FILTER_FIELDS`) and
  parsing of `lucene:facets` counts; unit-tested
- `turtleSerializer.ts` - Turtle serialization with configurable namespace prefix registry (`KNOWN_PREFIXES` map);
  predicates, datatypes, and `rdf:type` object (class) URIs are prefix-compacted; subject and other
  object URIs (entity references) stay as full `<uri>`. Values are written in their `entedit:valueOrder`;
  with `{ valueOrder: true }` (the export dialogs' Turtle-star checkbox, on by default so a
  migration export keeps the ordering; untick it for plain Turtle) each
  ordered value gets `{| entedit:valueOrder n |}`, the annotation syntax Turtle-star (GraphDB)
  and Turtle 1.2 share, downloaded as `.ttls`; the import dialog accepts `.ttls`
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
  (see "Value order" below)

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
   values or order actually changed, each in the graph of the triple it
   annotates; data that was never ordered by the editor stays unannotated
   until a value is moved from its load position (`reorderedProperties`)
4. `buildInverseCleanup` removes inverse triples (`owl:inverseOf` in either
   direction) for relationship values the user removed, plus their annotations

Unchanged triples produce no operations at all, so language tags, datatypes,
named graphs and unmanaged properties survive untouched, and a save that
changes one property cannot clobber another.

**Unicode:** literals the form adds or changes are saved in NFC
(`normalizeNewLiterals`), since decomposed text (e + combining accent, typical
of pasted PDF text) is missed by search, SPARQL equality and the duplicate
check, which also compares in NFC. Values stored exactly as loaded are not
normalized, so a save never rewrites text nobody edited.

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

**Which graph:** an existing entity is saved back into the graph its `rdf:type`
statement was loaded from (`targetGraph`; `graphForSave` in `utils/dataGraph.ts`); a
**new** entity is written to the **data graph**, `http://entedit.org/data` by default.
The user can change it under Settings → *Graph for new data*, a locked field that shows
the graph in use; **Change…** opens a confirmation dialog that explains the
consequences and validates the IRI, and "Use the default" goes back without asking,
because the point is to make a non-default graph deliberate (`dataGraph` on the
endpoint config, stored with the URL in `entEdit.config` only when it differs from the
default; `dataGraphOf` gives the effective graph and falls back to the default for an
empty or unusable value). The Import dialog is prefilled with it and stays editable.
The setting is per browser, so users sharing a repository should agree on one.
Everything created before the data graph existed is in the default graph, and
`tools/backup-repos.sh --graph http://entedit.org/data` (plus `--graph default` for
that older data) backs up what users wrote.

**New entities:** a custom URI is checked with a `COUNT` query first — inserting
into a URI that already has statements would silently merge the two entities.
Save is disabled until the form holds a value or a label.

**Entity delete (full blanket):** one request deleting RDF-star annotations on
outgoing *and* incoming triples, then all outgoing + incoming statements.

**URI type tracking:** `OrderedValue.isUri` comes from the SPARQL binding type
during load. On save, `objectPropertyUris.has(prop) || isUri` decides whether a
value is serialized as `<uri>` or a literal, so unmanaged relationship
properties are not turned into strings.

### Value order (RDF-star)

The order a cataloguer gives the values of a property is stored on each
statement with RDF-star — the only ordering the data has, and the one to use
wherever values are listed:

```sparql
<< <manifestation> rdamo:P30139 <expression> >> entedit:valueOrder 0 .
```

- **Definition:** `entedit:valueOrder` in `database/types/entedit_profile/profile.ttl`
  (xsd:integer, positions from 0).
- **Written** only by the editor's save (`buildEntityUpdate`, step 3 above): for
  properties with more than one value, rewritten when a save changes that
  property's values or order. For a property without annotations, "changed
  order" means a value moved from its load position — comparing with the
  (missing) stored annotation instead made a first reordering save nothing. Imported or never-reordered data has no annotations — every reader
  needs a fallback order. Each annotation is inserted into the graph of the
  triple it annotates (where the stored triple lives, or the entity's graph for
  a new one); removing them searches every graph.
- **Perspective:** the order belongs to the subject's own statement. A link
  stated from the other side (an incoming triple, shown through `owl:inverseOf`)
  has no order on this side; e.g. a manifestation's contents are ordered only
  through `m rdamo:P30139 e`, not `e rdaeo:P20059 m`.
- **Reading:** an `OPTIONAL { << <s> <p> ?o >> entedit:valueOrder ?n }` next to the
  statement (fine with `FROM <…/explicit>`; take `MIN` when grouping), then sort
  in the app with `sortByValueOrder` (`utils/valueOrder.ts`: ordered values first,
  the rest by a fallback). Do not rely on SPARQL for the order of a list built
  with `GROUP_CONCAT` — it has none.
- **Used by:** the editor (`EXPLICIT_QUERY` in `useEntityQueries.ts`), the Turtle
  exports (value order, and `{| entedit:valueOrder n |}` with the Turtle-star
  option), and the publication search's contents list
  (`expressionOrderInManifestation` in `wemiQueries.ts`, fallback by title).
- **Not yet used** for creators and relationships in search results, which are
  built as `GROUP_CONCAT` strings: to order them, return each value's order with
  it (a sort key inside the concatenated entry, or separate rows) and sort in
  the parser.
- **Syntax:** the `<< >>` notation is SPARQL-star/Turtle-star (RDF-star Community
  Group), which GraphDB 10–11 supports. Standard Turtle 1.1 cannot express it, and
  RDF 1.2 writes a triple term as `<<( s p o )>>` and reads `<< s p o >>` as a
  reifier, so a move to an RDF 1.2 store would need the annotations converted.

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
- A grouped subquery (`OPTIONAL { SELECT … GROUP BY }`) is evaluated on its own
  before the join, so it must bind its entities itself — repeat the outer
  `VALUES`/scope inside it, or it runs over the whole repository (this made
  every search page cost ~4.5 s on 650k triples, whatever the search term)
- A variable bound only in an `OPTIONAL` is unbound in rows where it did not
  match, and a later pattern on it then matches *everything* (an expression
  without a work joined with every work title). Nesting the dependent patterns
  inside that `OPTIONAL` is correct but slow: GraphDB evaluates the nested group
  for the whole repository first (~1 s at 90k expressions, and heap for the
  join). Instead give each block its own link and variable, and group
  subqueries by the scoped entity (see the work blocks in
  `buildExpressionDetailQuery`)
- Keep grouped subqueries out of `OPTIONAL` blocks that can stand alone as a query:
  GraphDB 10.8.4 left the `OPTIONAL { SELECT … GROUP BY }` of the collection lookup
  unbound in the publication search (no `collectionCount`, so a collection was not
  merged with its manifestation), while 10.8.12 answered it and the same pattern as a
  top-level query works on both. The lookup is its own query (`buildCollectionQuery`)
  merged in the app (`withCollections`). Compare hosted and local servers by version
  when the same data gives different results
- Test query changes against a large repository (millions of statements):
  both mistakes above were invisible at 100k–600k triples
- Page Lucene hits with `lucene:limit`/`lucene:offset` (already best first),
  not SPARQL `ORDER BY`/`LIMIT`, which sorts every hit of a broad term first
- A query cancelled by the browser keeps running in GraphDB; long-running ones
  show up under `/rest/monitor/repository/<repo>/query/active`. The repository
  config caps queries at 60 s (`graphdb:query-timeout`) and must keep
  `throw-QueryEvaluationException-on-timeout "true"`: without it a timed-out
  query silently returns a partial result instead of an error
- In a connector definition, a field name with `$` is merged into the part
  before it: all `titles$…` fields are one Lucene field `titles`, so query
  `titles:word`, never `titles$work:word`. Use it to reach one field by several
  property chains (e.g. `workType$direct` and `workType$inverse`)
- Search filters use unanalyzed IRI fields in `expressionsIndex` (`language`,
  `contentType`, `workType`, `genre`) and `manifestationsIndex` (the same plus
  `mediaType`, `carrierType`, reached through the embodied expressions and their
  works — a manifestation counts once per value any of them has) and `worksIndex`
  (`language`/`contentType` from its expressions, `workType`/`genre` on the work
  itself; no manifestation data, so a work does not gather every publication's
  titles and publishers); counts come from
  `lucene:facetFields`/`lucene:facets` and filters are Lucene clauses, so both
  stay in the index (3–55 ms on 89k expressions; the same counts in SPARQL took
  up to 4 s and grow with the hits). A field with a selection is counted in its
  own query without its own filter. Work type and genre follow `entedit:P01`/
  `P02`, not their superproperty `P10004`, which would mix the two
- A lookup through `owl:inverseOf` can return deprecated properties: RDA lists
  "is prequel to (Deprecated)" (`rdawo:P10195`) as an inverse of "has prequel work"
  next to the live "has sequel work", so a hidden live inverse let the deprecated
  one through. Add `notDeprecated("?inverse")` (`sparqlFragments.ts`, registry status
  1008) wherever an inverse is resolved for display or export
- With inference, `skos:altLabel` and `skos:prefLabel` count as `rdfs:label`;
  read display labels from explicit statements (`FROM <…/explicit>`) or an
  alternative label can win (`useFacetLabels`)
- The Lucene connector rejects bare query syntax (`(`, `"`, `:`, `AND`), so user
  input goes through `toLuceneQuery` (`utils/luceneQuery.ts`) before it is
  placed in `lucene:query`
- `importrdf preload` does not run the reasoner: after a bulk load the explicit data and
  the vocabulary are there, but no inverse or super-property statement is (on isfdb
  1.53 M `e P20231 w` and no `w P10078 e`, while new writes were inferred correctly).
  Everything the editor reads through inference stays empty until a one-off reinfer
  (`INSERT DATA { [] <http://www.ontotext.com/owlim/system#reinfer> [] }`, hours at
  29 M statements; it added 25.8 M inferred ones with the pruned vocabulary). The
  search-result lines are unaffected, since they resolve inverses at query time
  (`?inverse owl:inverseOf ?relationship`). VOCABULARY.md 2.2.1, ADVANCED.md
- Schema property queries (`useRdfProperties`, `useRdfObjectProperties`, relationship hooks)
  run with inference and no JS-side deduplication — stale/duplicate annotation triples
  (e.g., multiple `entedit:order` values) cause duplicate properties in the editor UI;
  when reloading vocabulary files, delete old annotation triples first

### UI Patterns

- `ListItemText`'s `secondary` prop renders as `<p>` by default; if secondary
  content nests `Box`/`Typography`/`Chip` (as in `Expression.tsx`'s creators/
  relationships/chips), that's invalid HTML and causes hydration-mismatch
  console errors — pass `slotProps={{ secondary: { component: "div" } }}`
- Features depending on saved database state (e.g., Turtle export) must be disabled when
  `isDirty` — pass `isDirty` to header and disable with tooltip explaining "save first"
- `LabelManager` dialog uses `hideBackdrop`, `disableEnforceFocus`, `disableAutoFocus`,
  `disableRestoreFocus` to allow interaction with content behind it (non-modal)
- Drag-and-drop reordering via @dnd-kit only shows controls when editing with 2+ values
- The form must not show edits that were not stored: empty rows and repeats of
  a value already recorded (same text and language — the same triple) are
  marked while editing and dropped once a save succeeds
  (`pruneEmptyValues`, `pruneDuplicateValues`, `duplicateValueIndexes`), and an
  empty row alone does not enable Save
- Controls must not move between view and edit mode: the identifier is the same
  `TextField` in both states (read-only, with lock and copy adornments, once
  saved) and uses the same monospace type in both, and the identity rows and
  section headers reserve the height of the controls that only appear while
  editing (`minHeight: 40`)
- Not every entity has a URI worth citing, so a semantic-web style that
  requires one cannot rely on the user typing one in: `EntityIdentitySection`
  shows a **Generate** button next to the identifier field for new entities
  while editing (`requireIdentifier`/`onGenerateUri` props), filling in the
  same `generateEntityUri(classUri)` identifier a blank field would get on
  save. The placeholder changes to "Enter a URI, or generate one" when
  `requireIdentifier` is set, since the plain "leave empty to auto-generate"
  text stops being true.

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

`docker compose publish` pushes the local image of every service that has a
`build` section, which overwrote the multi-arch `latest` images with
single-platform builds once. Keep `build` out of `docker-compose.yml` (it lives
in `docker-compose.dev.yml`) and publish from `docker-compose.yml` alone.

`app/nginx.conf` must keep two things: the `sub_filter` that rewrites the
Workbench's `<base href="/">` to `/graphdb/` (its relative assets 404 otherwise,
giving an unstyled page), and the separate `/graphdb/repositories/` location that
is proxied untouched — the rewrite requires `Accept-Encoding ""`, and SPARQL
results should stay compressed. The graph-visualization link and its repository
pre-selection (`prepareWorkbenchRepository` in `graphUtils.ts`) only work when
GraphDB shares the app's origin; cross-origin deployments fall back to the user
selecting a repository in the Workbench.

The compose file reads three optional variables: `ENTEDIT_PORT`, `GRAPHDB_PORT` and
`GDB_HEAP_SIZE` (passed to the GraphDB container; empty keeps GraphDB's defaults: a
1 GB minimum heap and a maximum of a quarter of the memory Docker can use). They apply
only to the `up` that sets them, so the docs say to repeat them on every `up`.

`docker-compose.yml` must therefore stay free of bind mounts — OCI publishing
rejects them. Local `database/` files are mounted through `docker-compose.dev.yml`
instead; use it whenever testing vocabulary, testdata or connector changes,
otherwise the baked-in copies from the init image are used. Changes under
`database/` or `docker/graphdb/` only reach users after `trondaal/entedit-init`
is rebuilt and pushed.

### Vocabulary graphs and `tools/install-vocabularies.sh`

Each folder of `database/types/` is loaded into a named graph of its own,
`http://entedit.org/graph/<folder>` (`rda_vocabulary`, `term_vocabularies`,
`entedit_profile`); example data goes into `http://entedit.org/examples`; user-created
data goes into `http://entedit.org/data` (see "Entity Save/Delete Strategy"). Upgrading
a layer on a running database is therefore: drop its graph, run
`tools/install-vocabularies.sh -e <endpoint> -U <user>` (password asked for). The
script works on any repository given its endpoint, loads only layers whose graph is
empty (`--merge` overrides; it re-adds blank-node statements), runs the
`database/lucene_connectors/*.sparql` files, and **never deletes**. The Docker init
(`docker/graphdb/import-types.sh`) and `create-repos.sh` (which calls the
script) use the same graph names. Facts behind the design, all verified on 10.8.12:

- A query without `FROM` sees all graphs as one default graph, so nothing in the app
  depends on where a statement is stored; a statement stored in two graphs is
  returned once.
- `GRAPH <http://www.openrdf.org/schema/sesame#nil>` addresses the real default graph
  only. Inferred statements count as part of it, so ask with `infer=false` when
  checking what is *stored* there (without it, an overlap check matches everything).
- Repositories installed before the graphs existed keep a default-graph copy; the
  script warns and prints the `DELETE` that removes it.
- The app's nginx must allow large uploads on `/graphdb/` (`client_max_body_size`):
  its 1 MB default refused the vocabulary files with 413.

### Provisioning Repositories for Teaching

`tools/create-repos.sh` creates and initializes one GraphDB repository per
group on any GraphDB server — same procedure as the Docker init, but
parameterized:

```
./tools/create-repos.sh -e http://host:7200 -p VBINF6000-H26- -n 12
```

Names are `<prefix><zero-padded group number>` (`VBINF6000-H26-01` … `-12`).
Each repository is created from `docker/graphdb/repositories/EntEdit/config.ttl`
(repository ID and label substituted), loaded with `database/types`, and given the
Lucene connectors from `database/lucene_connectors`; test data is imported only with
`--testdata`. Repositories carrying the init marker are skipped unless `--force`.
When GraphDB security is enabled, the script merges `READ_REPO_`/`WRITE_REPO_`
authorities for the new repositories into the server's free-access list so users
need no login (`--access read|write|none`). Run `--help` for all options.

`tools/create-users.sh` is the login-based alternative to free access: one
GraphDB user per group (`<prefix><animal>`, password of random words plus four
digits) with read/write on that group's repository only. The animal per group is a
shuffle seeded with the prefix, so a rerun skips existing users and never resets a
password. `--per-repo N` makes N users per repository: member *m* of group *g* takes
shuffled index `m * last_group + g - 1`, so raising N keeps existing names but adding
groups moves them; an existing user without `READ_REPO_<repo>` is reported, not
skipped, to catch exactly that. Users are created with `POST /rest/security/users/<name>`
(`ROLE_USER`, `READ_REPO_<id>`, `WRITE_REPO_<id>`); the admin check uses the
admin-only `/rest/security/users`, because `/rest/security` answers anonymously.

`tools/backup-repos.sh` backs up the same `<prefix><number>` repositories as TriG-star
(all graphs, RDF-star annotations kept, nothing inferred); `--graph IRI|default`
(repeatable) limits it to the named graphs (usually `http://entedit.org/data`) and
writes `<repo>.partial.trigs.gz`.

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

- Five style preferences: `showIdentifier`, `showLabels`, `requireIdentifier`,
  `requireLabel` and `showLanguageTags`. The presets `CLASSIC_PREFERENCES` (all off) and
  `SEMANTIC_PREFERENCES` (all on) are offered as one-click choices in the wizard
  and the settings dialog (`CatalogingStyleSettings`); any other combination is
  reported as "custom". New installations default to semantic.
- `showLanguageTags` shows the language of a text value and offers a selector
  (`VALUE_LANGUAGES` in `utils/languages.ts`, unset shown as an em dash) while
  editing, but only for properties whose values are natural language. The
  profile marks the exceptions with `entedit:linguistic false` (dates,
  numbering, dimensions, identifiers); a property without the annotation counts
  as linguistic, so existing vocabularies keep working. Even when it is off, a property whose values differ in language
  shows their tags anyway (`languagesInUse`), because values that differ only
  by an invisible tag look like duplicates and invite a cataloguer to delete
  one.
- `showInferredMarks` is a sixth preference that belongs to **no** style: off in
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
- `entedit:linguistic false` on data properties whose values are not natural
  language, which suppresses the language selector for them
- `entedit:collection true` on genre/form values (`entedit:P02` targets, marked in
  `labels.genretypes.ttl`: `entedit:T01` short story collections, `ntsf:15`
  anthologies). In the publication search, a manifestation with exactly one
  expression whose work has such a genre is shown as that collection: the
  expression and work are merged into the entry (like a single-expression
  manifestation) and left out of its Contents (`buildCollectionQuery` in
  `wemiQueries.ts`, `ManifestationSearchResult`). Two or more collections are
  not merged. The collection work is not linked to its parts, so the genre is
  the only signal
- `entedit:T07` selections (retrospective collections, `entedit:collection true`) are
  kept out of `expressionsIndex` by its `documentFilter`, so the content search neither
  finds them nor lists them as a category, whatever other genres they carry. The
  publication search still shows them, merged with their manifestation, and the
  work search lists them like any other work: `worksIndex` has no `documentFilter`,
  so it gives a full overview of everything entered as a work
- Standard RDFS vocabulary (rdfs:label, rdfs:domain, rdfs:range)
- RDA vocabulary for bibliographic entities (Work, Expression, Manifestation, Item)
- Properties must have correct `entedit:status` to appear in the editor UI;
  untagged properties are preserved during save but not displayed or editable

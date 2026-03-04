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
│   ├── graphdb/           # SPARQL connector query definitions
│   ├── inference rules/   # GraphDB inference rule sets
│   └── testdata/          # Sample RDF entities for testing
├── docker/                # Docker deployment configs
│   ├── nginx/             # nginx SPA + proxy config
│   └── graphdb/           # Repository definition + init script
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

**WEMI Relationship Selectors:**
- `WEMIRelationshipSelector` - Selector for Work-Expression-Manifestation-Item links
- `RelatedWorkSelector`, `RelatedExpressionSelector`, `RelatedManifestationSelector`
- `RelatedAgentsSelector` - For linking entities to agents (creators, contributors)

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

**useManifestationQueries.ts** - Manifestation metadata queries

**useExpressionQueries.ts** - Expression queries by manifestation

### Utilities (app/src/utils/)

- `sparqlClient.ts` - SparqlClient class with query/update methods and auth support
- `configManager.ts` - localStorage persistence for app configuration
- `labelUtils.ts` - URI label extraction, formatting, SPARQL escaping
- `sparqlFragments.ts` - Reusable SPARQL fragments for language fallback
- `queryInvalidation.ts` - Cache invalidation after mutations

### Data Flow

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

### Localization

Two namespaces in `app/src/locales/{lang}/`:
- `common.json` - Shared UI strings (buttons, messages, navigation)
- `entityEditor.json` - Entity editor specific labels

Language fallback: selected language → no language tag → opposite language (en↔no)

### Configuration

- Persisted to localStorage (`entEdit.config`, `entEdit.language`)
- `ConfigurationWizard` shown on first run or when unconfigured
- URL parameter `?nosearch` hides the search tab
- Default endpoint: `http://localhost:7200/repositories/EntEdit`

### Ontology Assumptions

The application expects:
- `entedit:status` predicate to mark active classes/properties
- `entedit:order` predicate for property display ordering
- Standard RDFS vocabulary (rdfs:label, rdfs:domain, rdfs:range)
- RDA vocabulary for bibliographic entities (Work, Expression, Manifestation, Item)

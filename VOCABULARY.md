# Vocabularies and data model

This document describes the RDF vocabularies EntEdit builds on, the terms EntEdit
defines itself, and the conventions the editor and the search rely on. It is for
developers who know RDF/SPARQL and library vocabularies (IFLA-LRM, RDA) and want
to understand, extend or replace what is in `database/types/`.

Setup and deployment are covered in [README.md](README.md) and
[ADVANCED.md](ADVANCED.md); this file is about the *content* of the repository.

- [1. Overview](#1-overview)
- [2. RDA Registry element sets](#2-rda-registry-element-sets)
- [3. Controlled value vocabularies](#3-controlled-value-vocabularies)
- [4. The EntEdit vocabulary](#4-the-entedit-vocabulary)
- [5. The EntEdit profile](#5-the-entedit-profile)
- [6. Data conventions](#6-data-conventions)
- [7. Extending the vocabulary](#7-extending-the-vocabulary)
- [8. Known quirks](#8-known-quirks)

## 1. Overview

EntEdit stores bibliographic data as RDF using the **RDA Registry** element sets
(the OWL version, implementing IFLA-LRM: WEMI classes and their properties) and generic controlled vocabularies (RDA term
lists, ISO 639-2, the Norwegian National Library's work types and NTSF). It does
not define a data model of its own. What it adds is a thin layer that
**tells the editor which of the many RDA properties to show, in what order and
with what labels**, plus a small number of properties and values RDA and the
source vocabularies lack.

Everything is loaded from `database/types/` when the repository is initialised
(`docker/graphdb/import-types.sh`), into the default graph. Example data
(`database/testdata/`) goes into the named graph `http://oslomet.no/abi/examples`,
so vocabulary and data can be reloaded independently.

| Layer | Files (`database/types/…`) | Source | Role |
|---|---|---|---|
| RDA element sets | `rda_vocabulary/*.nt` | [RDA Registry](https://www.rdaregistry.info/) | Classes, properties, inverse and subproperty axioms |
| Term lists | `term_vocabularies/RDA{Content,Media,Carrier}Type.nt` | RDA Registry | Content, media and carrier types |
| Languages | `term_vocabularies/iso639-2.rdf` | Library of Congress | Language values |
| Work types | `term_vocabularies/vtp.rdf` | National Library of Norway (`schema.nb.no`) | Category-of-work values |
| Genre/form | `term_vocabularies/ntsf.ttl` | National Library of Norway (`id.nb.no`) | Norwegian thesaurus of genre and form |
| SKOS | `term_vocabularies/skos.rdf` | W3C | Schema for the concept vocabularies |
| EntEdit profile | `entedit_profile/profile.ttl` | this project | Editor configuration and EntEdit's own terms |
| EntEdit labels | `entedit_profile/labels.*.ttl` | this project | Norwegian/English labels, ad hoc classes, extensions |

The repository runs GraphDB with the `rdfsplus-optimized` ruleset
(`docker/graphdb/repositories/EntEdit/config.ttl`). `rdfs:subClassOf`,
`rdfs:subPropertyOf`, `owl:inverseOf`, symmetric and transitive properties are
therefore materialised, and the design depends on it (see 2.2). Queries choose
between the inferred view (default) and the explicit statements only
(`FROM <http://www.ontotext.com/explicit>`).

### Namespaces

| Prefix | Namespace | Used for |
|---|---|---|
| `rdac:` | `http://rdaregistry.info/Elements/c/` | RDA classes (`C10001` Work, `C10006` Expression, `C10007` Manifestation, `C10003` Item, `C10002` Agent, `C10004` Person, `C10005` Corporate Body) |
| `rdawd:` `rdaed:` `rdamd:` `rdaid:` `rdaad:` | `…/Elements/{w,e,m,i,a}/datatype/` | RDA datatype properties per entity |
| `rdawo:` `rdaeo:` `rdamo:` `rdaio:` `rdaao:` | `…/Elements/{w,e,m,i,a}/object/` | RDA object properties per entity |
| `rdaxd:` | `…/Elements/x/datatype/` (and `…/x/object/`) | RDA *Entity* (unconstrained across entities), e.g. identifier `P00018`, name `P00019`, related agent `P00006` |
| `rdaco:` `rdamt:` `rdact:` | `http://rdaregistry.info/termList/RDA{Content,Media,Carrier}Type/` | RDA term list values |
| `entedit:` | `http://oslomet.no/abi/vocab#` | EntEdit's own terms |
| `vtp:` | `https://schema.nb.no/Bibliographic/Values/` | National Library work-type values |
| `ntsf:` | `https://id.nb.no/vocabulary/ntsf/` | NTSF genre/form values |

`entedit:` is a legacy namespace (from the OsloMet project this grew out of) and
is a stable identifier, not a resolvable URL. Two other project namespaces
exist for housekeeping only: `http://oslomet.no/abi/examples` (the named graph of
example data) and `urn:entedit:init-marker` (marks an initialised repository).
Entities created in the editor without a chosen URI get
`http://example.org/entedit/<Class>/<uuid>` (`generateEntityUri`,
`app/src/utils/labelUtils.ts`); real deployments are expected to mint their own.

## 2. RDA Registry element sets

### 2.1 Why the RDA Registry

The main reason is that the RDA Registry is the de facto standard element set for
bibliographic information, and it implements the IFLA Library Reference Model
(LRM): Work, Expression, Manifestation and Item, with their agent and
relationship elements. Using it means EntEdit data is expressed in the vocabulary
other library systems and RDA-based tooling already use, and no bibliographic
model has to be invented.

EntEdit uses **a subset of the registry**: the OWL version of the element sets,
which the registry publishes with richer semantics than its plain RDFS
version. Two features of it are what the design needs:

1. **Inverse properties.** Almost every RDA relationship is published together
   with its inverse (`owl:inverseOf`), for instance `rdawo:P10078` *has
   expression of work* ⇄ `rdaeo:P20231` *has work expressed*. A cataloguer can
   record a link from either entity, and the editor, search and exports show it
   from both sides. Inverse triples are inferred, never stored twice, and the
   editor lets a user remove a link from either side (see "Removing an inferred
   relationship" in `CLAUDE.md`).
2. **Domain and range on the WEMI classes, and a subproperty hierarchy.**
   Domains and ranges (`rdfs:domain rdac:C10001`) decide which properties a form
   offers for a class; the hierarchy lets one specific statement satisfy general
   queries. A role such as `rdawo:P10061` *has author agent* also entails the
   generic *has related agent of RDA entity* (`x/object/P00006`). The Lucene
   connectors and the result lists use those generic properties to reach agents
   and names without listing every role.

The registry also publishes *unconstrained* elements (`u/`, and `x/` for RDA
Entity) whose semantics are independent of LRM. The editor works with the
LRM-constrained sets (`w/`, `e/`, `m/`, `i/`, `a/`); `x/` is used for what is
common to all entities (identifier, name, related agent).

### 2.2 Loaded files

`database/types/rda_vocabulary/` holds the OWL version of the registry as
N-Triples dumps, one set per
entity: `c` (classes), `w e m i a p t n` (Work, Expression, Manifestation, Item,
Agent, Place, Timespan, Nomen), and, for each, the combined file
(`w.nt`), the `object` and the `datatype` variants. `x` (Entity), `u`
(unconstrained), `rof` (RDA/ONIX framework) and `z` (deprecated meta elements)
complete the set. The files carry `owl:versionInfo v5.2.2` as published by the
registry. To update, replace the files and reload; property URIs the profile
mentions must still exist.

Registry statements are used **unchanged**. EntEdit never redefines or overrides
anything in the RDA Registry or the other source vocabularies. The profile only
*adds*: configuration annotations on the registry's properties (section 5), labels
the registry lacks (mainly Norwegian), and the few domains and ranges it leaves
open.

### 2.3 What the profile adds

- **Norwegian labels (the bulk of it).** The registry has no Norwegian labels
  for its properties (the loaded files have English, and Finnish for a few). The profile adds
  `rdfs:label "…"@no` for every property it enables. Nothing is replaced or
  overridden: the registry's own labels stay as they are, and English falls back to
  them. The added labels are worded for cataloguers ("har forfatter", "er forfatter
  av"), not translated word for word from RDA's formulation. The same applies to
  the value vocabularies (section 3): only a missing `no` label, or an English
  label where one is lacking, is added.
- **Narrower ranges for controlled values.** The registry already gives these
  properties the correct domain (`rdaeo:P20006` language of expression,
  `rdaeo:P20001` content type, `rdamo:P30002` media type, `rdamo:P30001` carrier
  type), but its range is the very general `skos:Concept`. That says nothing about
  *which* concepts are allowed, so the editor could not offer a value list. The
  profile adds a narrower `rdfs:range`, an EntEdit class (`entedit:Language`,
  `entedit:Contenttype`, `entedit:Mediatype`, `entedit:Carriertype`, section 4.3)
  whose members are the permitted values. The profile repeats the domain on these
  four properties (marked "missing in RDA" in its comments); that is redundant
  and harmless.
- **Attributes vs. relationships.** RDA defines many elements both as a
  datatype property (a literal, `…/datatype/`) and as an object property (a link
  to a nomen or other entity, `…/object/`). EntEdit chooses, per element, which
  form to enable. Elements it treats as *attributes* (names, titles, dates, notes,
  identifiers) use the datatype variant: a plain string is enough for
  cataloguing, and the editor shows a text field. Elements it treats as
  *relationships* (agents, related works, controlled values) use the object
  variant, linked to another entity. Which variant is enabled is what the
  profile's `entedit:status` says (section 5.1); the other variant stays in the
  vocabulary, unused by the editor.

## 3. Controlled value vocabularies

Values are concepts with their own URIs, chosen from a list in the editor.
Each list has an *ad hoc class* so the editor can query "all values suitable for
this property" without knowing the source vocabulary (section 4.2).

| Property | Vocabulary | Values | Ad hoc class |
|---|---|---|---|
| `rdaeo:P20006` language | ISO 639-2 (`http://id.loc.gov/vocabulary/iso639-2/…`), ~490 codes  | `eng`, `nor`, … | `entedit:Language` |
| `rdaeo:P20001` content type | RDA Content Type (`rdaco:`), 72 terms | text, still image, … | `entedit:Contenttype` |
| `rdamo:P30002` media type | RDA Media Type (`rdamt:`), 24 terms | unmediated, audio, … | `entedit:Mediatype` |
| `rdamo:P30001` carrier type | RDA Carrier Type (`rdact:`), 144 terms | volume, audio disc, … | `entedit:Carriertype` |
| `entedit:P01` category of work | National Library work types (`vtp:V1000`–`V1009`) | language-based work, music work, film work, … | `entedit:Worktype` |
| `entedit:P02` genre or form | NTSF (`ntsf:…`, ~540 concepts) plus `entedit:T01`–`T06` | see 4.4 | `entedit:Genretype` |

### 3.1 National Library of Norway vocabularies

**Work types** (`vtp.rdf`, scheme `…/ValueSchemes/VS1000`) are the value list for
*category of work* in the National Library's bibliographic schema. They are used
as delivered. The originals are labelled in `nb`, `nn` and `en`, so
`labels.worktypes.ttl` adds `rdfs:label "…"@no` and types each as
`entedit:Worktype`.

**NTSF** (Norsk tesaurus for sjanger og form, `ntsf.ttl`) is used for genre and
form. It is a SKOS thesaurus with `skos:broader` hierarchy, `prefLabel` in
`nb`/`nn`/`en`, and some deprecated concepts (`owl:deprecated true`). Concepts
are used unchanged. `labels.genretypes.ttl` then does two things:

1. **Redefinitions** — for every NTSF concept offered in the editor, adds
   `a entedit:Genretype` plus `rdfs:label` in `no` and `en` (the labels the
   editor reads, see 5.4).
2. **Extensions** — concepts NTSF does not have, defined in the `entedit:`
   namespace (`entedit:T01`–`T06`, 4.4). They are full `skos:Concept`s with
   `skos:prefLabel` (`en`, `nb`, `nn`), often `skos:definition`, and the same
   `entedit:Genretype` typing, so they mix into the same list.

Work type and genre are stored with **different properties**, both
subproperties of the RDA generic `rdawo:P10004` *has category of work*:

```turtle
entedit:P01 rdfs:subPropertyOf rdawo:P10004 ; rdfs:range entedit:Worktype .   # V1000 …
entedit:P02 rdfs:subPropertyOf rdawo:P10004 ; rdfs:range entedit:Genretype .  # NTSF …
```

Queries must use `entedit:P01`/`P02`, never `P10004`, which returns both kinds
mixed together (the search filters and label generators rely on this).

### 3.2 RDA term lists and languages

The RDA term lists are used as published; `labels.rda.values.ttl` adds
Norwegian labels and the ad hoc class. `labels.languages.ttl` adds `no`/`en`
labels for ISO 639-2 languages (the `en` label copies the SKOS preferred label
so the editor needs only `rdfs:label`); typing as `entedit:Language` is at the end
of `profile.ttl`.

## 4. The EntEdit vocabulary

Terms defined in `profile.ttl` and `labels.genretypes.ttl`, namespace
`entedit:` = `http://oslomet.no/abi/vocab#`.

### 4.1 Configuration annotations

These are annotation-style properties on **other vocabularies' terms**: they
never appear on bibliographic entities. All are `owl:DatatypeProperty`.

| Property | Range | Applies to | Meaning |
|---|---|---|---|
| `entedit:status` | `entedit:StatusLiteral` | classes, properties | Which role a term plays in the editor (section 5.1). **A term without a status is invisible to the editor**, but data using it is preserved on save. |
| `entedit:order` | `xsd:integer` | classes, properties | Display order among siblings. Required for data properties; optional for others (5.2). |
| `entedit:display` | `xsd:boolean` | object properties | `false` hides one direction of a relationship pair in search and result lists. Absent means shown (5.3). |
| `entedit:linguistic` | `xsd:boolean` | data properties | `false` = value is not natural language (dates, identifiers, numbering, dimensions): no language selector. Absent means linguistic. |
| `entedit:collection` | `xsd:boolean` | genre concepts (`entedit:P02` values) | `true` = works of this genre gather other works (short story collection, anthology, omnibus). Drives the collection presentation in the publication search (6.3). |

### 4.2 Data-bearing annotation

| Property | Range | Applies to | Meaning |
|---|---|---|---|
| `entedit:valueOrder` | `xsd:integer` | **statements** (RDF-star) | Position from 0 of one value among the values of a property of the same subject. See 6.1. |

This one lives in the *data*, not the vocabulary, and is the only place EntEdit
extends the data model rather than describes it.

### 4.3 Classes

Classes exist only to group value concepts for filtering: `?value a
entedit:X` is easier than knowing which source vocabulary a property draws
from.

| Class | English | Norwegian | Members |
|---|---|---|---|
| `entedit:Language` | Language | Språk | ISO 639-2 languages |
| `entedit:Contenttype` | Content type | Innholdstype | RDA content types |
| `entedit:Mediatype` | Media type | Medietype | RDA media types |
| `entedit:Carriertype` | Carrier types | Bærertype | RDA carrier types |
| `entedit:Worktype` | Category of work | Kategori av verk | NB work types `V1000`–`V1009` |
| `entedit:Genretype` | Genre and form | Sjanger og form | NTSF concepts + `entedit:T01`–`T06` |
| `entedit:StatusLiteral` | | | Datatype enumerating the status values |

Membership is asserted on the *value* (`ntsf:1130 a entedit:Genretype`), in the
`labels.*.ttl` files, not on the source vocabulary's own files. Reloading a
source vocabulary does not lose it, but new concepts in an updated NTSF are
invisible until they are added to `labels.genretypes.ttl`.

### 4.4 Properties

**Controlled-value properties** (status `controlled property`)

| Property | Sub-property of | Domain → Range |
|---|---|---|
| `entedit:P01` category of work | `rdawo:P10004` | Work → `entedit:Worktype` |
| `entedit:P02` genre or form | `rdawo:P10004` | Work → `entedit:Genretype` |

**Contributor roles.** RDA offers only generic "contributor agent of text /
still image" for manifestations. The following name the role. Each is a
subproperty of the RDA generic, so inference still yields the standard
relationship, and each has an inverse so the role shows from the agent's side.

| Property | Inverse | Sub-property of | Label (en) |
|---|---|---|---|
| `entedit:P03` | `P04` | `rdamo:P30328` / `rdaao:P50475` | has / is author of introduction |
| `entedit:P05` | `P06` | `rdamo:P30321` / `rdaao:P50469` | has illustrator / is illustrator in |
| `entedit:P07` | `P08` | `rdamo:P30328` / `rdaao:P50475` | has / is author of foreword |
| `entedit:P09` | `P10` | `rdamo:P30328` / `rdaao:P50475` | has / is author of afterword |
| `entedit:P11` | `P12` | `rdamo:P30328` / `rdaao:P50475` | has / is annotator (notes, bibliographies) |
| `entedit:P13` | `P14` | `rdamo:P30321` / `rdaao:P50469` | has photographer / is photographer in |

Domain is Manifestation (`rdac:C10007`) and range Agent (`rdac:C10002`), reversed
for the inverse.

**Pseudonyms.** RDA's *has alternate/real identity of person* points to a nomen.
Systems like ISFDB record pseudonyms as separate person entities, so:

| Property | Inverse | Sub-property of | Label (en) |
|---|---|---|---|
| `entedit:P15` | `P16` | `rda:a/P50428` | has alternate identity |
| `entedit:P16` | `P15` | `rda:a/P50429` | has real identity |

Both link Person → Person (`rdac:C10004`).

**Genre and form concepts** (in `labels.genretypes.ttl`; all `skos:Concept` and
`entedit:Genretype`)

| Concept | Label (en) | Collection? |
|---|---|---|
| `entedit:T01` | Short story collections | yes |
| `entedit:T02` | Individual short stories | |
| `entedit:T03` | Novel sequences | yes |
| `entedit:T04` | Omnibus editions | yes |
| `entedit:T05` | Cover art | |
| `entedit:T06` | Illustrations | |

The NTSF concept `ntsf:15` (anthologies) is an existing concept that also carries
`entedit:collection true`, set in the redefinition part of the same file.

The numbering `entedit:P01…P16` and `T01…T06` is opaque by design; labels
carry the meaning. Next free numbers are `P17` and `T07`.

## 5. The EntEdit profile

`profile.ttl` is the editor's configuration, expressed as annotations on RDA
terms. It never changes the RDA statements; deleting it leaves valid RDA and an
editor with nothing to show.

### 5.1 `entedit:status`

| Value | Marks | Used by |
|---|---|---|
| `"class"` | An entity class shown in the class browser (Person, Corporate Body, Work, Expression, Manifestation, Item) | `useRdfClasses` (also requires `a owl:Class`) |
| `"data property"` | A literal-valued property shown as a text field | `useRdfProperties` (requires `entedit:order`) |
| `"core wemi property"` | The six WEMI links (work↔expression↔manifestation↔item) shown in the dedicated WEMI section | `useWEMIProperties` |
| `"object property"` | A relationship to another entity | agent and related-entity sections (`useAgentProperties`, `useRelated*Properties`) |
| `"controlled property"` | A link to a concept from a controlled list | as object properties; the picker lists members of the property's range class |
| `"deprecated"`, `"not used"` | Reserved in `StatusLiteral`; currently not assigned or queried | |

A property is offered for a class when the class is a `rdfs:subClassOf*` of the
property's `rdfs:domain`. Currently about 31 data properties, 6 core WEMI links,
6 controlled properties and ~510 object properties are enabled: the object
properties are the RDA agent and entity relationships in use, plus
`entedit:P03`–`P16`.

Object-property sections are picked by **range**: a relationship whose range is
Agent goes in the agent section, one whose range is Work/Expression/Manifestation in
the corresponding "related …" section. The core WEMI links are excluded from those
sections (`RELATED_EXCLUDED_PROPERTIES` in `useRelationshipQueries.ts`) so they
appear once. Properties whose range is `skos:Concept` are skipped.

### 5.2 `entedit:order`

Positive integers; lower first. Used for:

- **classes**, in the class browser (`order 2`–`7`; Agent itself is commented out).
- **data properties**, in the form. Data properties *without* an order are not shown
  (the query requires it). Gaps (manifestation `order 12`–`19`) are deliberate
  slack for insertions.
- **object properties**, optionally; unordered ones sort by label.

The concept files (`labels.genretypes.ttl`) also carry `entedit:order 1` on every
genre concept. **The application does not read it** — it is vestigial (section 8).

### 5.3 `entedit:display`

Relationship pairs have a natural "forward" direction. In search results
(`wemiQueries.ts`) only relationships without `entedit:display false` are listed, so
each link appears once from the side a user expects. Example: *has subject work*
is shown, its inverse *is subject work of* is not:

```turtle
rdaao:P50366 entedit:status "object property" ; entedit:display false .  # is subject agent of
```

Symmetric or evenly weighted pairs (*is part of* / *has part*) are left
unannotated so both directions show. About 24 properties (mostly work-to-work
adaptation/derivation relationships) carry `false`. This affects **presentation
only**: the editor still shows and edits both.

### 5.4 Labels

Labels are `rdfs:label`, language-tagged. The editor looks for the selected
language, then English (`createSchemaLabelFragment`); for property and class
names the profile supplies `@no`, RDA supplies `@en`. Concept vocabularies use
`skos:prefLabel` upstream, but the editor reads `rdfs:label`, hence the
`labels.*.ttl` files. Beware: with `rdfsplus-optimized`, `skos:prefLabel` and
`skos:altLabel` are *inferred* as `rdfs:label`, so query display labels from the
explicit graph or an alternative label can win (`useFacetLabels` does this).

## 6. Data conventions

### 6.1 Value order (`entedit:valueOrder`)

RDF has no order among the values of a property. The order a cataloguer gives
them (contents of a collection, a list of authors) is stored on the statement with
RDF-star:

```sparql
<< <manifestation/221397> rdamo:P30139 <expression/709593> >> entedit:valueOrder 0 .
<< <manifestation/221397> rdamo:P30139 <expression/37684>  >> entedit:valueOrder 1 .
```

Written by the editor's save only, for properties with more than one value whose
values or order changed; each annotation goes into the graph of the triple it
annotates. Imported or never-reordered data has none, so readers need a fallback
order. It belongs to the subject's own statement: a link asserted only from the other
side (seen through `owl:inverseOf`) has no order here. Exports write it as
`{| entedit:valueOrder n |}` (Turtle-star, `.ttls`) or drop it (plain Turtle). The
full specification, syntax caveats and RDF 1.2 notes are in the comments of
`profile.ttl` and `CLAUDE.md` ("Value order").

### 6.2 Graphs and inference

- Vocabulary and profile: default graph. Example data: `http://oslomet.no/abi/examples`.
- Entities live in the graph of their `rdf:type` statement. Saves diff against the
  explicit snapshot and write each triple back to its own graph.
- Inferred statements (supertypes, inverse links) are shown as *inferred* and
  never written back.

### 6.3 What the data looks like

A minimal entity, in the style of `database/testdata/simple_examples.ttl`:

```turtle
<http://viaf.org/viaf/29558386> a rdac:C10004 ;               # Person
    rdaad:P50413 "McCarthy, Cormac" ;                         # preferred name of agent
    rdaad:P50339 "1933-2023" ;
    rdfs:label   "McCarthy, Cormac" .

<work/1> a rdac:C10001 ;                                      # Work
    rdawd:P10223 "No country for old men" ;                   # preferred title of work
    entedit:P01  vtp:V1000 ;                                  # language-based work
    entedit:P02  ntsf:1122 ;                                  # a genre
    rdawo:P10061 <http://viaf.org/viaf/29558386> .            # has author agent
```

The *inverse* (`rdaao:P50195` *is author agent of*) is not stored; it is
inferred. The `rdfs:label` values on works, expressions, manifestations and
agents are **generated** from these statements by the maintenance queries in
`database/sparql/` (`*_labels.sparql`), for the search index and pickers. They
are not part of the model, replace existing labels, and are not baked into the
`entedit-init` image; run them after bulk imports.

**Publication search and collections.** A manifestation with exactly one
expression whose work has an `entedit:collection true` genre is presented as that
collection: work and expression merge into the entry and the remaining
expressions become its contents. Two or more collection expressions are not merged.

**Full-text search.** Two GraphDB Lucene connectors, `expressionsIndex` and
`manifestationsIndex` (`database/lucene_connectors/`), index names and titles
through RDA property chains, and expose unanalysed IRI fields (`language`,
`contentType`, `workType`, `genre`, plus `mediaType`, `carrierType` for
manifestations) used for facet filters. `workType` and `genre` follow
`entedit:P01` / `entedit:P02`. Changing chains or the profile properties they
depend on requires re-running the connector `.sparql` files on existing
repositories.

## 7. Extending the vocabulary

**Show an existing RDA property in the editor.** Add one line to
`profile.ttl`, in the section for its entity:

```turtle
rdamd:P30107 entedit:status "data property" ; entedit:order 6 ;
             rdfs:label "utgave"@no .           # add entedit:linguistic false if not text
rdamo:P30215 entedit:status "object property" ; rdfs:label "har papirprodusent"@no .
rdaao:P50242 entedit:status "object property" ; rdfs:label "er papirprodusent"@no .
```

Enable **both directions** of an object property, and add `entedit:display false`
to the one that should stay out of result lists. Check the property has an
`rdfs:domain` and `rdfs:range` in the registry.

**Add a role or relationship RDA lacks.** Mint `entedit:Pnn` as an
`rdf:Property` pair with `owl:inverseOf`, `rdfs:subPropertyOf` the closest RDA
property (so inference still gives the standard relationship), `rdfs:domain`,
`rdfs:range`, `status`, and labels in `no` and `en` (follow `entedit:P03`).

**Add a controlled vocabulary.** Load its concepts, give them an ad hoc class
(`entedit:Xtype`, labelled), define a `controlled property` with that class as
`rdfs:range` and the entity class as `rdfs:domain`, and provide `rdfs:label`
on each concept. If the value should be searchable or filterable, add a field to
the Lucene connector and a filter to `searchFilters.ts`.

**Add a genre.** Add a concept to `labels.genretypes.ttl` (NTSF concept: labels
and `a entedit:Genretype`; new: a full `skos:Concept` as `entedit:T07`). Mark
`entedit:collection true` if its works gather others.

**Reloading.** With `docker-compose.dev.yml`, the local `database/` is mounted;
otherwise changes reach users only after `trondaal/entedit-init` is rebuilt. An
initialised repository skips init: reload the changed files through the
Workbench or set `FORCE_REINIT=1` (this **wipes** the repository). When reloading
`profile.ttl`, delete the old annotation triples first: duplicate
`entedit:order` or `entedit:status` values produce duplicate rows in the editor.

## 8. Known quirks

- `entedit:order` on genre concepts (all `1`) is unused. It could be dropped or
  put to use for ordering value pickers.
- `"deprecated"` and `"not used"` are in `StatusLiteral` but no query treats them
  specially; a term is hidden simply by removing or not assigning `status`.
- The namespace `oslomet.no/abi/vocab#` and the graph `oslomet.no/abi/examples`
  are legacy names. Changing the namespace would require rewriting the profile,
  the labels, stored `entedit:valueOrder` annotations and the application code.
- NTSF's `owl:deprecated true` concepts are loaded and, if they have
  `entedit:Genretype`, offered. Deprecation is not filtered.
- The RDA Registry is versioned externally; updating it can change domains,
  ranges and inverse pairs the profile depends on. Diff the property URIs the
  profile mentions after an update.
- Norwegian labels use the tag `no`; upstream vocabularies use `nb`/`nn`.
  `labels.*.ttl` bridges this; new vocabularies need the same.

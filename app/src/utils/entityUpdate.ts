import { sanitizeSparqlUri } from "./labelUtils";
import { serializeTerm, termKey, type RdfTerm } from "./rdfTerms";

export const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
export const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
export const VALUE_ORDER = "http://oslomet.no/abi/vocab#valueOrder";

/** A triple that is currently asserted for the entity, and where it lives. */
export interface StoredTerm extends RdfTerm {
  property: string;
  /** Named graph holding the triple; undefined means the default graph. */
  graph?: string;
  /** entedit:valueOrder annotation currently attached, if any. */
  order?: number;
}

/**
 * The stored triples with each distinct triple once. The same statement can be stored in
 * several named graphs (an import of data that was already loaded from the examples, say),
 * and the snapshot holds one entry per graph. The form must show it once: it is one
 * statement, and with two copies on screen deleting one of them leaves the other, so the
 * diff sees the value as still wanted and nothing is removed. Removing the value from the
 * form then removes it from every graph, since the diff still reads the whole snapshot.
 */
export const distinctTerms = (snapshot: StoredTerm[]): StoredTerm[] => {
  const seen = new Set<string>();
  return snapshot.filter((term) => {
    const key = `${term.property}\u0000${termKey(term)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** A triple the form says should exist after saving. */
export interface DesiredTerm extends RdfTerm {
  property: string;
  order: number;
}

export interface BuildEntityUpdateArgs {
  entityUri: string;
  /** All explicitly asserted triples of the entity, as loaded. */
  snapshot: StoredTerm[];
  /** Everything the form holds, including rdf:type and rdfs:label. */
  desired: DesiredTerm[];
  /**
   * Properties the editor is allowed to remove. Triples of any other
   * property are left untouched even when they are absent from `desired`.
   */
  managedProperties: Set<string>;
  /** Named graph for newly inserted triples; undefined means the default graph. */
  targetGraph?: string;
}

const groupKey = (property: string, term: RdfTerm) =>
  `${property}\u0000${termKey(term)}`;

const triple = (subject: string, property: string, term: RdfTerm) =>
  `<${subject}> <${sanitizeSparqlUri(property)}> ${serializeTerm(term)} .`;

const inGraph = (graph: string | undefined, body: string) =>
  graph ? `GRAPH <${sanitizeSparqlUri(graph)}> { ${body} }` : body;

/**
 * Properties whose stored values the form puts in a different order, so their
 * `entedit:valueOrder` annotations must be rewritten. A property that was
 * never ordered (imported data, no annotation on any of its values) counts
 * only when a value moved from its load position — the order the editor
 * showed it in — so a save does not annotate an entity nobody reordered.
 */
export function reorderedProperties(snapshot: StoredTerm[], desired: DesiredTerm[]): Set<string> {
  const reordered = new Set<string>();
  const storedByKey = new Map<string, StoredTerm>();
  const loadPosition = new Map<string, number>();
  const seenPerProperty = new Map<string, number>();
  // A triple stored in two graphs is one value in the form: count it once
  for (const term of distinctTerms(snapshot)) {
    const key = groupKey(term.property, term);
    storedByKey.set(key, term);
    const position = seenPerProperty.get(term.property) ?? 0;
    loadPosition.set(key, position);
    seenPerProperty.set(term.property, position + 1);
  }
  for (const term of desired) {
    const key = groupKey(term.property, term);
    const stored = storedByKey.get(key);
    if (!stored) continue;
    const desiredOrder = countFor(desired, term.property) > 1 ? term.order : undefined;
    const propertyIsOrdered = snapshot.some(
      (other) => other.property === term.property && other.order !== undefined,
    );
    if (propertyIsOrdered ? stored.order !== desiredOrder
        : desiredOrder !== undefined && desiredOrder !== loadPosition.get(key)) {
      reordered.add(term.property);
    }
  }
  return reordered;
}

/**
 * Builds the SPARQL Update that turns `snapshot` into `desired`, as a single
 * `;`-joined request.
 *
 * Only what actually changed is written: unchanged triples are left alone, so
 * language tags, datatypes and the named graph a triple lives in survive a
 * save, and concurrent edits to other properties are not clobbered. Triples
 * of unmanaged properties are never deleted, and inferred statements are not
 * part of `snapshot` or `desired`, so they are never materialized.
 *
 * Returns an empty string when there is nothing to do.
 */
export function buildEntityUpdate({
  entityUri,
  snapshot,
  desired,
  managedProperties,
  targetGraph,
}: BuildEntityUpdateArgs): string {
  const subject = sanitizeSparqlUri(entityUri);

  const storedByKey = new Map<string, StoredTerm>();
  for (const term of snapshot) storedByKey.set(groupKey(term.property, term), term);
  const desiredByKey = new Map<string, DesiredTerm>();
  for (const term of desired) desiredByKey.set(groupKey(term.property, term), term);

  // Triples to remove: managed, currently stored, no longer wanted.
  const removals = snapshot.filter(
    (term) =>
      managedProperties.has(term.property) &&
      !desiredByKey.has(groupKey(term.property, term)),
  );
  // Triples to add: wanted but not stored yet.
  const additions = desired.filter(
    (term) => !storedByKey.has(groupKey(term.property, term)),
  );

  // Properties whose value list changed in content or order; their
  // entedit:valueOrder annotations are rewritten from scratch.
  const touchedProperties = new Set<string>();
  for (const term of [...removals, ...additions]) touchedProperties.add(term.property);
  for (const property of reorderedProperties(snapshot, desired)) touchedProperties.add(property);

  const operations: string[] = [];

  // 1. Drop order annotations on the touched properties (in any graph).
  // Properties with nothing stored yet cannot carry annotations.
  const storedProperties = new Set(snapshot.map((term) => term.property));
  for (const property of touchedProperties) {
    if (!storedProperties.has(property)) continue;
    operations.push(`DELETE {
  << <${subject}> <${sanitizeSparqlUri(property)}> ?o >> ?annotationProperty ?annotationValue .
} WHERE {
  << <${subject}> <${sanitizeSparqlUri(property)}> ?o >> ?annotationProperty ?annotationValue .
}`);
  }

  // 2. Remove the triples themselves, each from the graph it lives in.
  const removalsByGraph = new Map<string | undefined, StoredTerm[]>();
  for (const term of removals) {
    const list = removalsByGraph.get(term.graph) ?? [];
    list.push(term);
    removalsByGraph.set(term.graph, list);
  }
  for (const [graph, terms] of removalsByGraph) {
    const body = terms.map((term) => triple(subject, term.property, term)).join("\n    ");
    operations.push(`DELETE DATA {\n    ${inGraph(graph, body)}\n}`);
  }

  // 3. Insert the new triples into the entity's graph.
  if (additions.length > 0) {
    const body = additions.map((term) => triple(subject, term.property, term)).join("\n    ");
    operations.push(`INSERT DATA {\n    ${inGraph(targetGraph, body)}\n}`);
  }

  // 4. Re-state the order annotations for the touched, multi-valued properties,
  // each in the graph of the triple it annotates: where a stored triple lives,
  // or the entity's graph for one inserted above.
  const annotationsByGraph = new Map<string | undefined, string[]>();
  for (const term of desired) {
    if (!touchedProperties.has(term.property) || countFor(desired, term.property) <= 1) continue;
    // A stored triple's graph may be the default graph (undefined): keep that
    const stored = storedByKey.get(groupKey(term.property, term));
    const graph = stored ? stored.graph : targetGraph;
    const list = annotationsByGraph.get(graph) ?? [];
    list.push(
      `<< <${subject}> <${sanitizeSparqlUri(term.property)}> ${serializeTerm(term)} >> <${VALUE_ORDER}> ${term.order} .`,
    );
    annotationsByGraph.set(graph, list);
  }
  if (annotationsByGraph.size > 0) {
    const blocks = [...annotationsByGraph].map(([graph, lines]) =>
      inGraph(graph, lines.join("\n    ")),
    );
    operations.push(`INSERT DATA {\n    ${blocks.join("\n    ")}\n}`);
  }

  return operations.join(" ;\n");
}

const countFor = (terms: DesiredTerm[], property: string) =>
  terms.reduce((n, term) => (term.property === property ? n + 1 : n), 0);

/**
 * Puts literal values the form adds or changes in Unicode NFC.
 *
 * Text pasted from PDFs or catalogue exports can arrive decomposed (e plus a
 * combining accent instead of é). It looks the same but compares as a
 * different string, so it is missed by search, SPARQL equality and the
 * duplicate check. A value already stored exactly as the form holds it is
 * left alone: normalizing it would rewrite a triple nobody edited.
 */
export function normalizeNewLiterals(
  snapshot: StoredTerm[],
  desired: DesiredTerm[],
): DesiredTerm[] {
  const storedKeys = new Set(snapshot.map((term) => groupKey(term.property, term)));
  return desired.map((term) => {
    if (term.isUri || storedKeys.has(groupKey(term.property, term))) return term;
    const value = term.value.normalize("NFC");
    return value === term.value ? term : { ...term, value };
  });
}

/**
 * Builds the update that removes the inverse triples pointing back at this
 * entity from relationship targets the user removed.
 *
 * Only inverse properties of the removed property are deleted (declared in
 * either direction with owl:inverseOf), so unrelated statements the other
 * entity makes about this one are kept.
 */
export function buildInverseCleanup(
  entityUri: string,
  removedRelations: Array<{ property: string; value: string }>,
): string {
  const subject = sanitizeSparqlUri(entityUri);
  return removedRelations
    .map(({ property, value }) => {
      const other = sanitizeSparqlUri(value);
      const prop = sanitizeSparqlUri(property);
      const inverseOf = `{ ?inverse <http://www.w3.org/2002/07/owl#inverseOf> <${prop}> } UNION { <${prop}> <http://www.w3.org/2002/07/owl#inverseOf> ?inverse }`;
      return `DELETE {
  << <${other}> ?inverse <${subject}> >> ?annotationProperty ?annotationValue .
  <${other}> ?inverse <${subject}> .
} WHERE {
  <${other}> ?inverse <${subject}> .
  ${inverseOf}
  OPTIONAL { << <${other}> ?inverse <${subject}> >> ?annotationProperty ?annotationValue . }
}`;
    })
    .join(" ;\n");
}

/**
 * Compares the snapshot taken when the entity was opened with a freshly
 * loaded one, and reports the managed properties that someone else changed
 * in the meantime. Only properties the user is about to write are reported,
 * so an unrelated concurrent edit doesn't block the save.
 */
export function findConflicts(
  openedSnapshot: StoredTerm[],
  currentSnapshot: StoredTerm[],
  propertiesBeingWritten: Set<string>,
): string[] {
  const fingerprint = (terms: StoredTerm[], property: string) =>
    terms
      .filter((term) => term.property === property)
      .map((term) => `${termKey(term)}|${term.order ?? ""}`)
      .sort()
      .join("\u0000");

  return [...propertiesBeingWritten]
    .filter(
      (property) =>
        fingerprint(openedSnapshot, property) !== fingerprint(currentSnapshot, property),
    )
    .sort();
}

/**
 * The managed properties whose values differ between `snapshot` and
 * `desired` — that is, exactly the properties this save will write.
 */
export function changedProperties(
  snapshot: StoredTerm[],
  desired: DesiredTerm[],
  managedProperties: Set<string>,
): Set<string> {
  const changed = new Set<string>();
  const storedKeys = new Set(snapshot.map((t) => groupKey(t.property, t)));
  const desiredKeys = new Set(desired.map((t) => groupKey(t.property, t)));
  for (const term of desired) {
    if (!storedKeys.has(groupKey(term.property, term))) changed.add(term.property);
  }
  for (const term of snapshot) {
    if (
      managedProperties.has(term.property) &&
      !desiredKeys.has(groupKey(term.property, term))
    ) {
      changed.add(term.property);
    }
  }
  for (const property of reorderedProperties(snapshot, desired)) changed.add(property);
  return changed;
}

/** A relationship value the user removed, with the property it hung on. */
export interface RemovedRelation {
  property: string;
  value: string;
}

/**
 * Works out which relationship targets the save must detach.
 *
 * Two kinds are collected. An explicit link the user deleted is removed from
 * this entity by the diff, and its reciprocal statement on the other entity is
 * cleaned up here. An *inferred* link — the same relationship seen from the
 * other side, e.g. a Work showing "has expression of work" because the
 * Expression states "has work expressed" — has no statement on this entity at
 * all: deleting it means deleting the statement that entails it, which lives on
 * the other entity. Both end up in `buildInverseCleanup`, so a relationship can
 * be removed from whichever side the cataloguer happens to be looking at.
 */
export function findRemovedRelations({
  snapshot,
  desired,
  managedProperties,
  loadedInferred,
  keptInferred,
}: {
  snapshot: StoredTerm[];
  desired: DesiredTerm[];
  managedProperties: Set<string>;
  /** Inferred relationship values the entity was loaded with. */
  loadedInferred: RemovedRelation[];
  /** Those still shown in the form, as `property|value`. */
  keptInferred: Set<string>;
}): RemovedRelation[] {
  const removed: RemovedRelation[] = [];
  const seen = new Set<string>();
  const add = (relation: RemovedRelation) => {
    const key = `${relation.property}|${relation.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    removed.push(relation);
  };

  const desiredKeys = new Set(desired.map((term) => `${term.property}|${term.value}`));
  for (const term of snapshot) {
    if (!term.isUri || !managedProperties.has(term.property)) continue;
    if (!desiredKeys.has(`${term.property}|${term.value}`)) {
      add({ property: term.property, value: term.value });
    }
  }
  for (const relation of loadedInferred) {
    if (!keptInferred.has(`${relation.property}|${relation.value}`)) add(relation);
  }
  return removed;
}

/**
 * Drops values the user left empty, and properties left with none.
 *
 * An empty row is a half-finished edit: nothing is written for it, so the
 * form must not keep showing it as though something was saved.
 */
export function pruneEmptyValues<T extends { value: string }>(
  data: Record<string, T[]>,
): Record<string, T[]> {
  const pruned: Record<string, T[]> = {};
  for (const [property, values] of Object.entries(data)) {
    const kept = values.filter((v) => v.value.trim());
    if (kept.length > 0) pruned[property] = kept;
  }
  return pruned;
}

/**
 * Indexes of values that repeat one already listed for the same property.
 *
 * Same text and same language means the same triple, so the repeat adds
 * nothing and would vanish on the next load. Values that differ only in
 * language are distinct triples and are not duplicates. Text is compared in
 * NFC, since a new value is saved that way (`normalizeNewLiterals`).
 */
export function duplicateValueIndexes<
  T extends { value: string; lang?: string },
>(values: T[]): Set<number> {
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  values.forEach((value, index) => {
    const text = value.value.trim().normalize("NFC");
    if (!text) return;
    const key = `${value.lang ?? ""}\u0000${text}`;
    if (seen.has(key)) duplicates.add(index);
    else seen.add(key);
  });
  return duplicates;
}

/** Removes the repeats `duplicateValueIndexes` finds, keeping the first of each. */
export function pruneDuplicateValues<
  T extends { value: string; lang?: string },
>(data: Record<string, T[]>): Record<string, T[]> {
  const pruned: Record<string, T[]> = {};
  for (const [property, values] of Object.entries(data)) {
    const duplicates = duplicateValueIndexes(values);
    pruned[property] = values.filter((_, index) => !duplicates.has(index));
  }
  return pruned;
}

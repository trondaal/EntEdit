import { describe, expect, it } from "vitest";
import {
  buildEntityUpdate,
  buildInverseCleanup,
  findConflicts,
  RDF_TYPE,
  RDFS_LABEL,
  type DesiredTerm,
  type StoredTerm,
  findRemovedRelations,
} from "./entityUpdate";

const WORK = "http://viaf.org/viaf/214012164";
const TITLE = "http://rdaregistry.info/Elements/w/datatype/P10223";
const AUTHOR = "http://rdaregistry.info/Elements/w/object/P10061";
const CLASS_WORK = "http://rdaregistry.info/Elements/c/C10001";
const EXAMPLES = "http://oslomet.no/abi/examples";

const managed = new Set([RDF_TYPE, RDFS_LABEL, TITLE, AUTHOR]);

/** The Work as loaded from the example data: everything in the examples graph. */
const storedWork: StoredTerm[] = [
  { property: RDF_TYPE, value: CLASS_WORK, isUri: true, graph: EXAMPLES },
  { property: RDFS_LABEL, value: "No country for old men", graph: EXAMPLES },
  { property: TITLE, value: "No country for old men", graph: EXAMPLES },
  { property: TITLE, value: "Ingen land for gamle menn", lang: "no", graph: EXAMPLES },
];

const desiredWork: DesiredTerm[] = [
  { property: RDF_TYPE, value: CLASS_WORK, isUri: true, order: 0 },
  { property: RDFS_LABEL, value: "No country for old men", order: 0 },
  { property: TITLE, value: "No country for old men", order: 0 },
  { property: TITLE, value: "Ingen land for gamle menn", lang: "no", order: 1 },
];

describe("buildEntityUpdate", () => {
  it("writes nothing when the form matches what is stored (D1, D2, D3)", () => {
    expect(
      buildEntityUpdate({
        entityUri: WORK,
        snapshot: storedWork,
        desired: desiredWork,
        managedProperties: managed,
        targetGraph: EXAMPLES,
      }),
    ).toBe("");
  });

  it("keeps the language tag when another value changes (D1)", () => {
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: storedWork,
      desired: desiredWork.map((term) =>
        term.property === TITLE && term.lang === undefined
          ? { ...term, value: "No Country for Old Men" }
          : term,
      ),
      managedProperties: managed,
      targetGraph: EXAMPLES,
    });
    expect(update).toContain('"No Country for Old Men"');
    // The Norwegian title is untouched, so it is neither deleted nor re-inserted
    expect(update).not.toContain("Ingen land for gamle menn\"@no .\n}");
    expect(update).toContain('"Ingen land for gamle menn"@no >>');
  });

  it("round-trips a typed literal unchanged", () => {
    const stored: StoredTerm[] = [
      {
        property: TITLE,
        value: "1998",
        datatype: "http://www.w3.org/2001/XMLSchema#gYear",
      },
    ];
    const desired: DesiredTerm[] = [
      {
        property: TITLE,
        value: "1998",
        datatype: "http://www.w3.org/2001/XMLSchema#gYear",
        order: 0,
      },
    ];
    expect(
      buildEntityUpdate({ entityUri: WORK, snapshot: stored, desired, managedProperties: managed }),
    ).toBe("");
  });

  it("never re-inserts inferred statements, which are not in the snapshot (D2)", () => {
    // The inferred supertype is not part of `desired`, and the editor does not
    // manage it away either: nothing about it appears in the update.
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: storedWork,
      desired: [...desiredWork, { property: TITLE, value: "Extra", order: 2 }],
      managedProperties: managed,
      targetGraph: EXAMPLES,
    });
    expect(update).not.toContain("C10013");
  });

  it("inserts into, and deletes from, the entity's own graph (D3)", () => {
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: storedWork,
      desired: [
        ...desiredWork.filter((term) => term.lang !== "no"),
        { property: TITLE, value: "Nytt", lang: "no", order: 1 },
      ],
      managedProperties: managed,
      targetGraph: EXAMPLES,
    });
    expect(update).toContain(`DELETE DATA {\n    GRAPH <${EXAMPLES}>`);
    expect(update).toContain(`INSERT DATA {\n    GRAPH <${EXAMPLES}>`);
  });

  it("leaves unmanaged properties alone", () => {
    const unmanaged = "http://rdaregistry.info/Elements/x/datatype/P00018";
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: [...storedWork, { property: unmanaged, value: "vtls000", graph: EXAMPLES }],
      desired: desiredWork,
      managedProperties: managed,
      targetGraph: EXAMPLES,
    });
    expect(update).toBe("");
  });

  it("removes a value the user deleted", () => {
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: storedWork,
      desired: desiredWork.filter((term) => term.lang !== "no"),
      managedProperties: managed,
      targetGraph: EXAMPLES,
    });
    expect(update).toContain('"Ingen land for gamle menn"@no .');
    expect(update).toContain("DELETE DATA");
    expect(update).not.toContain("INSERT DATA");
  });

  it("rewrites order annotations only for the property that changed", () => {
    const snapshot: StoredTerm[] = [
      { property: TITLE, value: "A", order: 0 },
      { property: TITLE, value: "B", order: 1 },
      { property: RDFS_LABEL, value: "Label" },
    ];
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot,
      desired: [
        { property: TITLE, value: "B", order: 0 },
        { property: TITLE, value: "A", order: 1 },
        { property: RDFS_LABEL, value: "Label", order: 0 },
      ],
      managedProperties: managed,
    });
    expect(update).toContain(`<< <${WORK}> <${TITLE}> "B" >> <http://oslomet.no/abi/vocab#valueOrder> 0 .`);
    expect(update).toContain(`<< <${WORK}> <${TITLE}> "A" >> <http://oslomet.no/abi/vocab#valueOrder> 1 .`);
    expect(update).not.toContain(RDFS_LABEL);
    // Reordering moves no triples, only annotations
    expect(update).not.toContain("DELETE DATA");
  });

  it("drops the order annotation when a property falls back to one value", () => {
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: [
        { property: TITLE, value: "A", order: 0 },
        { property: TITLE, value: "B", order: 1 },
      ],
      desired: [{ property: TITLE, value: "A", order: 0 }],
      managedProperties: managed,
    });
    expect(update).toContain("<< <" + WORK + "> <" + TITLE + "> ?o >>");
    expect(update).not.toContain("valueOrder> 0");
  });

  it("creates a new entity with a single INSERT DATA", () => {
    const update = buildEntityUpdate({
      entityUri: "http://example.org/work/1",
      snapshot: [],
      desired: [
        { property: RDF_TYPE, value: CLASS_WORK, isUri: true, order: 0 },
        { property: RDFS_LABEL, value: "New work", order: 0 },
      ],
      managedProperties: managed,
    });
    expect(update.startsWith("INSERT DATA")).toBe(true);
    expect(update).not.toContain("DELETE");
  });

  it("escapes literals and rejects an unsafe IRI", () => {
    const update = buildEntityUpdate({
      entityUri: WORK,
      snapshot: [],
      desired: [{ property: RDFS_LABEL, value: 'He said "no"\n', order: 0 }],
      managedProperties: managed,
    });
    expect(update).toContain('"He said \\"no\\"\\n"');
    expect(() =>
      buildEntityUpdate({
        entityUri: WORK,
        snapshot: [],
        desired: [{ property: AUTHOR, value: "http://x/ <evil>", isUri: true, order: 0 }],
        managedProperties: managed,
      }),
    ).toThrow(/Unsafe URI/);
  });
});

describe("buildInverseCleanup", () => {
  it("deletes only inverse properties of the removed relationship (D8)", () => {
    const update = buildInverseCleanup(WORK, [
      { property: AUTHOR, value: "http://viaf.org/viaf/29558386" },
    ]);
    expect(update).toContain("owl#inverseOf");
    expect(update).toContain("<http://viaf.org/viaf/29558386> ?inverse <" + WORK + ">");
    expect(update).toContain("?annotationProperty");
  });

  it("returns an empty string when nothing was removed", () => {
    expect(buildInverseCleanup(WORK, [])).toBe("");
  });
});

describe("findConflicts", () => {
  const opened = storedWork;

  it("reports a property another user changed (D6)", () => {
    const current = opened.map((term) =>
      term.property === TITLE && term.lang === "no"
        ? { ...term, value: "Endret av en annen" }
        : term,
    );
    expect(findConflicts(opened, current, new Set([TITLE]))).toEqual([TITLE]);
  });

  it("ignores changes to properties this save does not write", () => {
    const current = [...opened, { property: RDFS_LABEL, value: "Another label" }];
    expect(findConflicts(opened, current, new Set([TITLE]))).toEqual([]);
  });

  it("reports nothing when the entity is unchanged", () => {
    expect(findConflicts(opened, [...opened].reverse(), new Set([TITLE, RDFS_LABEL]))).toEqual([]);
  });
});

describe("findRemovedRelations", () => {
  const managed = new Set([AUTHOR, TITLE, RDF_TYPE, RDFS_LABEL]);
  const EXPRESSION = "http://example.org/expr/1";
  const HAS_EXPRESSION = "http://rdaregistry.info/Elements/w/object/P10078";

  it("detaches an explicit link the user deleted", () => {
    expect(
      findRemovedRelations({
        snapshot: [{ property: AUTHOR, value: "http://viaf.org/viaf/29558386", isUri: true }],
        desired: [],
        managedProperties: managed,
        loadedInferred: [],
        keptInferred: new Set(),
      }),
    ).toEqual([{ property: AUTHOR, value: "http://viaf.org/viaf/29558386" }]);
  });

  it("detaches an inferred link the user deleted, though it is on no snapshot", () => {
    expect(
      findRemovedRelations({
        snapshot: [],
        desired: [],
        managedProperties: managed,
        loadedInferred: [{ property: HAS_EXPRESSION, value: EXPRESSION }],
        keptInferred: new Set(),
      }),
    ).toEqual([{ property: HAS_EXPRESSION, value: EXPRESSION }]);
  });

  it("leaves an inferred link alone while it is still shown", () => {
    expect(
      findRemovedRelations({
        snapshot: [],
        desired: [],
        managedProperties: managed,
        loadedInferred: [{ property: HAS_EXPRESSION, value: EXPRESSION }],
        keptInferred: new Set([`${HAS_EXPRESSION}|${EXPRESSION}`]),
      }),
    ).toEqual([]);
  });

  it("keeps a link that is still in the form, and ignores unmanaged properties", () => {
    const unmanaged = "http://rdaregistry.info/Elements/x/object/P00018";
    expect(
      findRemovedRelations({
        snapshot: [
          { property: AUTHOR, value: "http://viaf.org/viaf/29558386", isUri: true },
          { property: unmanaged, value: "http://example.org/other", isUri: true },
        ],
        desired: [
          { property: AUTHOR, value: "http://viaf.org/viaf/29558386", isUri: true, order: 0 },
        ],
        managedProperties: managed,
        loadedInferred: [],
        keptInferred: new Set(),
      }),
    ).toEqual([]);
  });

  it("reports a value removed from both sides only once", () => {
    expect(
      findRemovedRelations({
        snapshot: [{ property: HAS_EXPRESSION, value: EXPRESSION, isUri: true }],
        desired: [],
        managedProperties: new Set([HAS_EXPRESSION]),
        loadedInferred: [{ property: HAS_EXPRESSION, value: EXPRESSION }],
        keptInferred: new Set(),
      }),
    ).toEqual([{ property: HAS_EXPRESSION, value: EXPRESSION }]);
  });
});

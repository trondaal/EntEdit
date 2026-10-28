import { describe, expect, it } from "vitest";
import {
  buildCollectionQuery,
  buildExpressionDetailQuery,
  buildManifestationDetailQuery,
  buildRelationTargetsQuery,
  buildWorkDetailQuery,
  expressionOrderInWork,
  expressionsOfWork,
  manifestationScope,
  toWorkDetail,
  withCollections,
  workScope,
  type ManifestationDetail,
} from "./wemiQueries";
import { notDeprecated } from "./sparqlFragments";

const scope = manifestationScope(["http://example.org/m1"]);
const term = (value: string) => ({ type: "literal", value });
const manifestation = (uri: string): ManifestationDetail => ({ uri });

describe("buildCollectionQuery", () => {
  const query = buildCollectionQuery(scope);

  it("is a query of its own, restricted to the scope and to asserted statements", () => {
    expect(query).toContain("VALUES ?manifestation { <http://example.org/m1> }");
    expect(query).toContain("FROM <http://www.ontotext.com/explicit>");
    expect(query).toContain("GROUP BY ?manifestation");
  });

  it("counts expressions whose work has a genre marked entedit:collection true", () => {
    expect(query).toContain("COUNT(DISTINCT ?collection_expression)");
    expect(query).toContain("?collection_genre entedit:collection true");
  });
});

describe("buildManifestationDetailQuery", () => {
  it("no longer nests the collection subquery (GraphDB 10.8.4 left it unbound)", () => {
    const query = buildManifestationDetailQuery(scope, "en");
    expect(query).not.toContain("collection_count");
    expect(query).not.toContain("entedit:collection");
  });

  it("reads the publisher name the profile uses (rdamd:P30176, not P30076)", () => {
    expect(buildManifestationDetailQuery(scope, "en")).toContain("?manifestation rdamd:P30176 ?publisher_val");
  });

  it("lists relationships to other manifestations, from either side, scoped to the hits", () => {
    const query = buildManifestationDetailQuery(scope, "en");
    expect(query).toContain("?target a <http://rdaregistry.info/Elements/c/C10007>");
    expect(query).toContain("as ?manifestation_to_manifestation_relationships");
    expect(query).toContain("as ?manifestation_collapsed_relationships");
    expect(query).toContain("GROUP BY ?manifestation ?manifestation_relationship_label ?manifestation_relationship_property");
    // Each grouped subquery binds its own manifestations (agents, relationships, collapsed)
    expect(query.match(/VALUES \?manifestation \{ <http:\/\/example.org\/m1> \}/g)).toHaveLength(4);
  });
});

describe("withCollections", () => {
  const bindings = [
    {
      manifestation: term("http://example.org/m1"),
      collection_count: term("1"),
      collection_sample: term("http://example.org/e1"),
    },
    {
      manifestation: term("http://example.org/m2"),
      collection_count: term("2"),
      collection_sample: term("http://example.org/e2"),
    },
  ] as never;

  it("adds count and expression to the manifestations it describes", () => {
    const [m1, m2] = withCollections([manifestation("http://example.org/m1"), manifestation("http://example.org/m2")], bindings);
    expect(m1).toMatchObject({ collectionCount: 1, collectionExpression: "http://example.org/e1" });
    expect(m2).toMatchObject({ collectionCount: 2 });
  });

  it("leaves manifestations without a collection untouched and keeps the order", () => {
    const result = withCollections([manifestation("http://example.org/m3"), manifestation("http://example.org/m1")], bindings);
    expect(result.map((m) => m.uri)).toEqual(["http://example.org/m3", "http://example.org/m1"]);
    expect(result[0].collectionCount).toBeUndefined();
  });
});

describe("work queries", () => {
  const work = "http://example.org/w1";

  it("finds the expressions of a work from either side of the link", () => {
    const scope = expressionsOfWork(work);
    expect(scope).toContain(`<${work}> rdawo:P10078 ?expression`);
    expect(scope).toContain(`?expression rdaeo:P20231 <${work}>`);
  });

  it("reads the expression order from the work's own statement", () => {
    expect(expressionOrderInWork(work)).toContain(
      `<< <${work}> rdawo:P10078 ?expression >> entedit:valueOrder ?value_order`,
    );
  });

  it("describes the works in scope, repeating the scope in its subqueries", () => {
    const scope = workScope([work]);
    const query = buildWorkDetailQuery(scope, "en");
    expect(query).toContain("FROM <http://www.ontotext.com/explicit>");
    expect(query).toContain("GROUP BY ?work\n");
    expect(query.split(scope).length - 1).toBe(4); // outer, agents, relationships, collapsed relationships
    expect(query).toContain("COUNT(DISTINCT ?expression) as ?expression_count");
  });

  it("gives an icon only when all expressions share a content type", () => {
    const row = (count: string) =>
      ({
        work: term(work),
        expression_count: term("2"),
        contenttype_count: term(count),
        contenttype_uri: term("http://rdaregistry.info/termList/RDAContentType/1020"),
      }) as never;
    expect(toWorkDetail(row("1")).contenttypeUri).toBe("http://rdaregistry.info/termList/RDAContentType/1020");
    expect(toWorkDetail(row("2")).contenttypeUri).toBeUndefined();
    expect(toWorkDetail(row("1")).expression_count).toBe(2);
  });
});

describe("inverse relationships and deprecated properties", () => {
  const deprecated = notDeprecated("?shown");

  it("builds a filter on the registry's deprecated status", () => {
    expect(deprecated).toBe(
      "FILTER NOT EXISTS { ?shown <http://metadataregistry.org/uri/profile/regap/status> <http://metadataregistry.org/uri/RegStatus/1008> }",
    );
  });

  // RDA lists "is prequel to (Deprecated)" as an inverse of "has prequel work"
  // next to the live "has sequel work"; showing every inverse put the old label
  // into result lines.
  it("skips deprecated inverses when relationships are read from the other side", () => {
    for (const query of [
      buildWorkDetailQuery(workScope(["http://example.org/w1"]), "en"),
      buildExpressionDetailQuery(workScope(["http://example.org/w1"]), "en"),
    ]) {
      expect(query).toMatch(/\?shown owl:inverseOf \?relationship \.\s+FILTER NOT EXISTS \{ \?shown <[^>]*regap\/status> <[^>]*RegStatus\/1008> \}/);
    }
  });

  it("skips deprecated inverses for agent relationships too", () => {
    const query = buildWorkDetailQuery(workScope(["http://example.org/w1"]), "en");
    expect(query).toMatch(/\?inverse owl:inverseOf \?relationship \.\s+FILTER NOT EXISTS \{ \?inverse <[^>]*regap\/status> <[^>]*RegStatus\/1008> \}/);
  });
});

describe("collapsed relationships", () => {
  const WORK = "http://rdaregistry.info/Elements/c/C10001";
  const workQuery = buildWorkDetailQuery(workScope(["http://example.org/w1"]), "en");

  it("lists the relationships not marked entedit:collapse inline, and counts the marked ones", () => {
    expect(workQuery).toContain("FILTER NOT EXISTS { ?shown entedit:collapse true }");
    expect(workQuery).toContain("?shown entedit:collapse true .");
    expect(workQuery).toContain("COUNT(DISTINCT ?target) as ?work_collapsed_count");
    expect(workQuery).toContain("as ?work_collapsed_relationships");
  });

  it("still leaves out the relationships marked entedit:display false, collapsed ones included", () => {
    expect(workQuery.match(/FILTER NOT EXISTS \{ \?shown entedit:display false \}/g)).toHaveLength(2);
  });

  it("counts the collapsed relationships of an expression's work and of the expression", () => {
    const query = buildExpressionDetailQuery(expressionsOfWork("http://example.org/w1"), "en");
    expect(query).toContain("as ?work_collapsed_relationships");
    expect(query).toContain("as ?expression_collapsed_relationships");
    expect(query).toContain("(SAMPLE(?w_uri) as ?work_uri)");
  });

  it("lists the targets of one relationship of one entity, from either side, by title, a page at a time", () => {
    const query = buildRelationTargetsQuery(
      "http://example.org/w1",
      "http://rdaregistry.info/Elements/w/object/P10147",
      WORK,
      "en",
      50,
      100,
    );
    expect(query).toContain("<http://example.org/w1> <http://rdaregistry.info/Elements/w/object/P10147> ?target");
    expect(query).toContain("<http://rdaregistry.info/Elements/w/object/P10147> owl:inverseOf ?relationship");
    expect(query).toContain("FROM <http://www.ontotext.com/explicit>");
    expect(query).toContain("ORDER BY ?target_title ?target");
    expect(query).toContain("LIMIT 50");
    expect(query).toContain("OFFSET 100");
  });

  it("ends the title with any label, so a target is never shown by its URI while it has one", () => {
    const query = buildRelationTargetsQuery("http://example.org/w1", "http://example.org/p", WORK, "no", 50, 0);
    expect(query).toContain("COALESCE(?title_chosen, ?title_none, ?title_fallback, ?title_any)");
  });

  it("refuses an unsafe IRI", () => {
    expect(() => buildRelationTargetsQuery("http://x> } DROP", "http://p", WORK, "en", 50, 0)).toThrow();
  });
});

describe("the property of an inline relationship line", () => {
  it("is returned with each group, for the part-relationship preference", () => {
    const query = buildWorkDetailQuery(workScope(["http://example.org/w1"]), "en");
    expect(query).toContain("CONCAT(?work_relationship_label, \" ‡ \", ?work_relationship_property, \" ⊢ \", ?work_relationship_targets)");
    expect(query).toContain("BIND(STR(?shown) AS ?work_relationship_property)");
    expect(query).toContain("GROUP BY ?work ?work_relationship_label ?work_relationship_property");
  });

  it("is returned for the expression's own relationships as well", () => {
    const query = buildExpressionDetailQuery(expressionsOfWork("http://example.org/w1"), "en");
    expect(query).toContain("?expression_relationship_property");
    expect(query).toContain("?work_relationship_property");
  });
});

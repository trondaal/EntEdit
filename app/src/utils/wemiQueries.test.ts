import { describe, expect, it } from "vitest";
import {
  buildCollectionQuery,
  buildManifestationDetailQuery,
  buildWorkDetailQuery,
  expressionOrderInWork,
  expressionsOfWork,
  manifestationScope,
  toWorkDetail,
  withCollections,
  workScope,
  type ManifestationDetail,
} from "./wemiQueries";

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
    expect(query.split(scope).length - 1).toBe(3); // outer, agents, relationships
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

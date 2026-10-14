import { describe, expect, it } from "vitest";
import { presentManifestation } from "./manifestationPresentation";

const COLLECTION = "http://ex.org/e/collection";
const PART = "http://ex.org/e/part";

describe("presentManifestation, as in the publication search", () => {
  it("merges the only expression and lists no contents", () => {
    expect(presentManifestation({ expression_count: 1 })).toMatchObject({
      isSingleExpression: true,
      mergeSingleExpression: true,
      hasContents: false,
    });
  });

  it("merges the one collection among several and lists the others as contents", () => {
    expect(
      presentManifestation({ expression_count: 6, collectionCount: 1, collectionExpression: COLLECTION }),
    ).toMatchObject({
      mergedCollectionUri: COLLECTION,
      collectionUri: COLLECTION,
      contentsCount: 5,
      hasContents: true,
      mergeSingleExpression: false,
    });
  });

  it("merges nothing among several expressions without a collection", () => {
    expect(presentManifestation({ expression_count: 4 })).toMatchObject({
      mergedCollectionUri: undefined,
      mergeSingleExpression: false,
      contentsCount: 4,
      hasContents: true,
    });
  });

  it("merges nothing when two or more expressions are collections", () => {
    expect(
      presentManifestation({ expression_count: 4, collectionCount: 2, collectionExpression: COLLECTION }),
    ).toMatchObject({ collectionUri: undefined, mergedCollectionUri: undefined, contentsCount: 4 });
  });

  it("does not know the contents before the count is", () => {
    expect(presentManifestation({}).contentsCount).toBeUndefined();
  });
});

describe("presentManifestation, under an expression", () => {
  it("does not repeat the expression it is listed under when that is the only one", () => {
    expect(presentManifestation({ expression_count: 1 }, PART)).toMatchObject({
      mergeSingleExpression: false,
      hasContents: false,
    });
  });

  it("merges a collection the parent belongs to, and keeps the parent in the contents", () => {
    expect(
      presentManifestation({ expression_count: 6, collectionCount: 1, collectionExpression: COLLECTION }, PART),
    ).toMatchObject({ mergedCollectionUri: COLLECTION, contentsCount: 5 });
  });

  it("does not repeat the collection when it is the parent, which stays out of the contents as the collection", () => {
    expect(
      presentManifestation({ expression_count: 6, collectionCount: 1, collectionExpression: COLLECTION }, COLLECTION),
    ).toMatchObject({ mergedCollectionUri: undefined, collectionUri: COLLECTION, contentsCount: 5 });
  });

  it("lists every expression, the parent included, when none is a collection", () => {
    expect(presentManifestation({ expression_count: 4 }, PART)).toMatchObject({
      mergedCollectionUri: undefined,
      contentsCount: 4,
      hasContents: true,
    });
  });
});

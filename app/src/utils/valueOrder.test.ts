import { describe, expect, it } from "vitest";
import { sortByValueOrder } from "./valueOrder";

type Item = { title: string; order?: number };
const byTitle = (a: Item, b: Item) => a.title.localeCompare(b.title);
const titles = (items: Item[]) => items.map((i) => i.title);

describe("sortByValueOrder", () => {
  it("puts ordered values first, in their order", () => {
    const items = [{ title: "C" }, { title: "B", order: 1 }, { title: "A", order: 0 }];
    expect(titles(sortByValueOrder(items, (i) => i.order, byTitle))).toEqual(["A", "B", "C"]);
  });

  it("orders the rest by the fallback", () => {
    const items = [{ title: "Z", order: 0 }, { title: "Y" }, { title: "X" }];
    expect(titles(sortByValueOrder(items, (i) => i.order, byTitle))).toEqual(["Z", "X", "Y"]);
  });

  it("keeps the current order without a fallback, and ties stable", () => {
    const items = [{ title: "b" }, { title: "a" }, { title: "c", order: 0 }, { title: "d", order: 0 }];
    expect(titles(sortByValueOrder(items, (i) => i.order))).toEqual(["c", "d", "b", "a"]);
  });

  it("treats 0 as an order, not as missing", () => {
    const items = [{ title: "late" }, { title: "first", order: 0 }];
    expect(titles(sortByValueOrder(items, (i) => i.order))).toEqual(["first", "late"]);
  });

  it("does not modify the input", () => {
    const items = [{ title: "B", order: 1 }, { title: "A", order: 0 }];
    sortByValueOrder(items, (i) => i.order);
    expect(titles(items)).toEqual(["B", "A"]);
  });
});

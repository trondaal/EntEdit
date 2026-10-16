import { describe, expect, it } from "vitest";
import { buildAgentPropertiesQuery } from "./useRelationshipQueries";

const AGENT = "http://rdaregistry.info/Elements/c/C10002";
const WORK = "http://rdaregistry.info/Elements/c/C10001";

describe("buildAgentPropertiesQuery", () => {
  it("accepts Agent and its subclasses as range, not Agent alone", () => {
    const query = buildAgentPropertiesQuery(WORK, "en");
    expect(query).toContain(`?range rdfs:subClassOf* <${AGENT}>`);
    expect(query).not.toMatch(/FILTER\(\?range\s*=/);
  });

  it("limits the properties to those the edited class can have", () => {
    expect(buildAgentPropertiesQuery(WORK, "en")).toContain(`<${WORK}> rdfs:subClassOf* ?domain`);
    expect(buildAgentPropertiesQuery(undefined, "en")).not.toContain("rdfs:subClassOf* ?domain");
  });

  it("returns the range with each property, which the picker uses to narrow its targets", () => {
    expect(buildAgentPropertiesQuery(WORK, "en")).toMatch(/SELECT DISTINCT \?property \?label \?domain \?range/);
  });
});

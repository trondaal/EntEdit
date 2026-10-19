import { describe, expect, it } from "vitest";
import {
  buildSessionContext,
  createLinkSearchGuard,
  diffEndpoint,
  diffPreferences,
  stampEvent,
} from "./interactionLog";
import { CLASSIC_PREFERENCES, SEMANTIC_PREFERENCES } from "./catalogingStyle";

describe("stampEvent", () => {
  it("adds the time and the place in the session to the caller's fields", () => {
    const event = stampEvent({ type: "class_selected", classUri: "c:1" }, 3, "2026-10-19T10:00:00.000Z");
    expect(event).toEqual({
      type: "class_selected",
      classUri: "c:1",
      timestamp: "2026-10-19T10:00:00.000Z",
      sequenceNumber: 3,
    });
  });
});

describe("buildSessionContext", () => {
  it("records the build and a copy of the preferences", () => {
    const preferences = { ...SEMANTIC_PREFERENCES };
    const context = buildSessionContext("1.0.31", preferences);
    expect(context.appVersion).toBe("1.0.31");
    expect(context.preferences).toEqual(preferences);
    preferences.showIdentifier = false;
    expect(context.preferences.showIdentifier).toBe(true);
  });
});

describe("diffPreferences", () => {
  it("is empty when nothing changed", () => {
    expect(diffPreferences(CLASSIC_PREFERENCES, { ...CLASSIC_PREFERENCES })).toEqual([]);
  });

  it("lists each changed preference with its new value", () => {
    const changes = diffPreferences(CLASSIC_PREFERENCES, {
      ...CLASSIC_PREFERENCES,
      showIdentifier: true,
      partLevels: "work",
    });
    expect(changes).toEqual([
      { setting: "showIdentifier", value: true },
      { setting: "partLevels", value: "work" },
    ]);
  });

  it("reports a whole style change as every preference that differs", () => {
    const changes = diffPreferences(CLASSIC_PREFERENCES, SEMANTIC_PREFERENCES);
    expect(changes.map((c) => c.setting)).toEqual(
      expect.arrayContaining(["showIdentifier", "showLabels", "requireIdentifier", "requireLabel", "showLanguageTags"]),
    );
  });
});

describe("diffEndpoint", () => {
  const base = { url: "http://a/repositories/X", username: "u", password: "p" };

  it("says that the address changed, never what it is", () => {
    const changes = diffEndpoint(base, { ...base, url: "http://private-server/repositories/Y" });
    expect(changes).toEqual([{ setting: "endpoint", value: "changed" }]);
    expect(JSON.stringify(changes)).not.toContain("private-server");
  });

  it("ignores credentials", () => {
    expect(diffEndpoint(base, { ...base, username: "other", password: "secret" })).toEqual([]);
  });

  it("notices a data graph change, and treats unset as empty", () => {
    expect(diffEndpoint(base, { ...base, dataGraph: "http://g" })).toEqual([{ setting: "dataGraph", value: "changed" }]);
    expect(diffEndpoint({ ...base, dataGraph: "" }, base)).toEqual([]);
  });
});

describe("createLinkSearchGuard", () => {
  it("recognises the search that the followed link's label caused, once", () => {
    const guard = createLinkSearchGuard();
    guard.mark("Ballard, J. G.");
    expect(guard.consume("Ballard, J. G.")).toBe(true);
    expect(guard.consume("Ballard, J. G.")).toBe(false);
  });

  it("does not hide a different search, and forgets the link after it", () => {
    const guard = createLinkSearchGuard();
    guard.mark("Ballard, J. G.");
    expect(guard.consume("crash")).toBe(false);
    expect(guard.consume("Ballard, J. G.")).toBe(false);
  });

  it("lets everything through when no link was followed", () => {
    expect(createLinkSearchGuard().consume("crash")).toBe(false);
  });
});

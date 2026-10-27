import { describe, expect, it } from "vitest";
import {
  canDiscover,
  canReveal,
  demoState,
  initialState,
  matchReasons,
  mergeEncounters,
  parseState,
} from "./domain";

describe("matching and privacy", () => {
  it("only matches shared tags in the same life stage and applies adjustable threshold", () => {
    const { profile, encounters } = demoState();
    expect(matchReasons(profile, encounters[0])).toEqual([
      "嵌入式开发",
      "人工智能",
    ]);
    expect(
      matchReasons({ ...profile, minSharedTags: 3 }, encounters[0]),
    ).toEqual([]);
    expect(matchReasons({ ...profile, mode: "alumni" }, encounters[0])).toEqual(
      [],
    );
    expect(matchReasons(profile, { ...encounters[0], blocked: true })).toEqual(
      [],
    );
  });
  it("supports same school alumni gating without arbitrary scores", () => {
    const { profile, encounters } = demoState();
    const alumni = { ...profile, mode: "alumni" as const };
    const peer = { ...encounters[0], mode: "alumni" as const, schoolId: 2 };
    expect(matchReasons(alumni, peer)).toEqual([]);
    expect(
      matchReasons({ ...alumni, requireSameSchool: false }, peer),
    ).toHaveLength(2);
  });
  it("does not enable real broadcasting by default and honors expiry", () => {
    expect(canDiscover(initialState().profile)).toBe(false);
    const { profile } = demoState(1000);
    expect(canDiscover(profile, 1000)).toBe(true);
    expect(canDiscover(profile, profile.intentExpiresAt)).toBe(false);
    expect(canDiscover({ ...profile, broadcastConsent: false }, 1000)).toBe(
      false,
    );
  });
  it("preserves local block and consent decisions during repeated synchronization", () => {
    const { encounters } = demoState();
    const local = { ...encounters[0], blocked: true };
    expect(
      mergeEncounters([local], [encounters[0], encounters[1], encounters[1]]),
    ).toEqual([local, encounters[1]]);
  });
  it("never treats a local file as evidence of remote consent for device records", () => {
    const state = demoState();
    state.encounters[0] = {
      ...state.encounters[0],
      source: "device",
      connection: "connected",
    };
    expect(canReveal(state.encounters[0])).toBe(false);
    expect(parseState(state)?.encounters[0].connection).toBe("none");
  });
  it("rejects malformed stored data", () => {
    expect(
      parseState({ ...demoState(), profile: { mode: "student" } }),
    ).toBeNull();
    const state = demoState();
    state.profile.tags = [999];
    expect(parseState(state)).toBeNull();
  });
});

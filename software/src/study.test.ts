import { describe, expect, it } from "vitest";
import { isStudySearch, storageKeyFor } from "./study";

describe("software-only test link", () => {
  it("activates only for the explicit study parameter", () => {
    expect(isStudySearch("?study=1")).toBe(true);
    expect(isStudySearch("?lang=en&study=1")).toBe(true);
    expect(isStudySearch("")).toBe(false);
    expect(isStudySearch("?study=0")).toBe(false);
  });
  it("keeps study data separate from the ordinary device space", () => {
    expect(storageKeyFor("?study=1")).toBe("university-radar:study:v1");
    expect(storageKeyFor("")).toBe("university-radar:v1");
  });
});

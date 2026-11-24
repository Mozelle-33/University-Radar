import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./domain";
import { loadState, saveState, STORAGE_KEY } from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("local data recovery", () => {
  it.each(["{broken", JSON.stringify({ version: 999 })])(
    "preserves unreadable or unsupported data across later saves",
    (raw) => {
      const store = new Map([[STORAGE_KEY, raw]]);
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      });
      expect(loadState().warning).not.toBeNull();
      expect(saveState(initialState())).toBe(false);
      expect(store.get(STORAGE_KEY)).toBe(raw);
    },
  );
  it("continues to save valid existing profiles", () => {
    const store = new Map([[STORAGE_KEY, JSON.stringify(initialState(1000))]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    const next = initialState(2000);
    expect(saveState(next)).toBe(true);
    expect(JSON.parse(store.get(STORAGE_KEY)!)).toEqual(next);
  });
});

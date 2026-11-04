import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { getLanguage, setLanguage, t } from "./i18n";
import { FIELD_NAMES, INTENTS, SCHOOLS, TAGS, initialState } from "./domain";

afterEach(() => {
  setLanguage("zh");
  vi.unstubAllGlobals();
});

describe("Chinese and English application language", () => {
  it("persists the choice without changing matching IDs or stored profile values", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
    });
    const documentStub = { documentElement: { lang: "" }, title: "" };
    vi.stubGlobal("document", documentStub);
    const original = initialState(1000);
    setLanguage("en");
    expect(getLanguage()).toBe("en");
    expect(storage.get("university-radar:language")).toBe("en");
    expect(documentStub.documentElement.lang).toBe("en");
    expect(documentStub.title).toContain("Find common ground");
    expect(t("雷达")).toBe("Radar");
    expect(t("人工智能")).toBe("Artificial intelligence");
    expect(t("Custom user text")).toBe("Custom user text");
    expect(t("toString")).toBe("toString");
    expect(t("__proto__")).toBe("__proto__");
    expect(initialState(1000)).toEqual(original);
    setLanguage("zh");
    expect(t("雷达")).toBe("雷达");
    expect(documentStub.documentElement.lang).toBe("zh-CN");
  });

  it("works for a session when local storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => setLanguage("en")).not.toThrow();
    expect(t("连接")).toBe("Connections");
  });

  it("covers app-owned static copy and shared tag, school and intent labels", () => {
    setLanguage("en");
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const file = ts.createSourceFile(
      "App.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const phrases: string[] = [];
    const unwrapped: string[] = [];
    const walk = (node: ts.Node) => {
      if (ts.isJsxText(node) && /[\u3400-\u9fff]/.test(node.text))
        unwrapped.push(node.text.trim());
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(file) === "t" &&
        ts.isStringLiteral(node.arguments[0]) &&
        /[\u3400-\u9fff]/.test(node.arguments[0].text)
      )
        phrases.push(node.arguments[0].text);
      ts.forEachChild(node, walk);
    };
    walk(file);
    expect(unwrapped).toEqual([]);
    for (const path of ["./ble/client.ts", "./storage.ts"]) {
      const other = ts.createSourceFile(
        path,
        readFileSync(new URL(path, import.meta.url), "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const scan = (node: ts.Node) => {
        if (ts.isStringLiteral(node) && /[\u3400-\u9fff]/.test(node.text))
          phrases.push(node.text);
        ts.forEachChild(node, scan);
      };
      scan(other);
    }
    const shared = [
      ...INTENTS,
      ...TAGS.map((v) => v.name),
      ...SCHOOLS.map((v) => v.name),
      ...Object.values(FIELD_NAMES),
      "同校校友",
      "上午",
      "下午",
      "晚间",
      "离线相遇",
    ];
    expect(
      [...new Set([...phrases, ...shared])].filter(
        (value) => t(value) === value,
      ),
    ).toEqual([]);
  });
});

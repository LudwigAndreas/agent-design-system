import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrollIntoView, which the agent spotlight uses.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * This jsdom setup does not expose Web Storage, so the shell's persistence
 * behaviour would be untestable. A minimal in-memory implementation is enough:
 * the production code only ever does getItem/setItem inside try/catch.
 */
if (typeof globalThis.localStorage === "undefined") {
  const createStorage = (): Storage => {
    const entries = new Map<string, string>();
    return {
      get length() {
        return entries.size;
      },
      clear: () => entries.clear(),
      getItem: (key) => entries.get(key) ?? null,
      key: (index) => [...entries.keys()][index] ?? null,
      removeItem: (key) => void entries.delete(key),
      setItem: (key, value) => void entries.set(key, String(value)),
    };
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createStorage(),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: createStorage(),
  });
}

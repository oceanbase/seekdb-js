import { describe, it, expect } from "vitest";
import { toSnake } from "./index";

describe("toSnake", () => {
  it("should convert camelCase keys to snake_case", () => {
    expect(toSnake({ fooBar: 1, nestedKey: "a" })).toEqual({
      foo_bar: 1,
      nested_key: "a",
    });
  });

  it("should leave primitives unchanged", () => {
    expect(toSnake(null)).toBe(null);
    expect(toSnake(42)).toBe(42);
    expect(toSnake("x")).toBe("x");
  });

  it("should map arrays recursively", () => {
    expect(toSnake([{ aB: 1 }, { cD: 2 }])).toEqual([{ a_b: 1 }, { c_d: 2 }]);
  });

  it("should nest objects recursively", () => {
    expect(
      toSnake({
        outerKey: { innerValue: true },
      })
    ).toEqual({
      outer_key: { inner_value: true },
    });
  });
});

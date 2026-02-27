import { describe, it, expect } from "vitest";
import { valueToColumnType, inferColumnTypes } from "../src/conversion.js";
import { ColumnTypeEnum } from "@prisma/driver-adapter-utils";

describe("conversion", () => {
  describe("valueToColumnType", () => {
    it("returns Text for null and undefined", () => {
      expect(valueToColumnType(null)).toBe(ColumnTypeEnum.Text);
      expect(valueToColumnType(undefined)).toBe(ColumnTypeEnum.Text);
    });

    it("returns Int32 for integers", () => {
      expect(valueToColumnType(0)).toBe(ColumnTypeEnum.Int32);
      expect(valueToColumnType(42)).toBe(ColumnTypeEnum.Int32);
      expect(valueToColumnType(-1)).toBe(ColumnTypeEnum.Int32);
    });

    it("returns Double for non-integer numbers", () => {
      expect(valueToColumnType(3.14)).toBe(ColumnTypeEnum.Double);
      expect(valueToColumnType(1.5)).toBe(ColumnTypeEnum.Double);
    });

    it("returns Int64 for bigint", () => {
      expect(valueToColumnType(BigInt(123))).toBe(ColumnTypeEnum.Int64);
    });

    it("returns Text for strings", () => {
      expect(valueToColumnType("hello")).toBe(ColumnTypeEnum.Text);
      expect(valueToColumnType("")).toBe(ColumnTypeEnum.Text);
    });

    it("returns Boolean for booleans", () => {
      expect(valueToColumnType(true)).toBe(ColumnTypeEnum.Boolean);
      expect(valueToColumnType(false)).toBe(ColumnTypeEnum.Boolean);
    });

    it("returns DateTime for Date", () => {
      expect(valueToColumnType(new Date())).toBe(ColumnTypeEnum.DateTime);
    });

    it("returns Bytes for Buffer", () => {
      expect(valueToColumnType(Buffer.from("x"))).toBe(ColumnTypeEnum.Bytes);
    });

    it("returns Json for plain objects", () => {
      expect(valueToColumnType({ a: 1 })).toBe(ColumnTypeEnum.Json);
      expect(valueToColumnType([])).toBe(ColumnTypeEnum.Json);
    });

    it("returns Text for unknown types", () => {
      expect(valueToColumnType(Symbol("x"))).toBe(ColumnTypeEnum.Text);
    });
  });

  describe("inferColumnTypes", () => {
    it("returns Text for each column when rows is empty", () => {
      const result = inferColumnTypes(["a", "b"], []);
      expect(result).toEqual([ColumnTypeEnum.Text, ColumnTypeEnum.Text]);
    });

    it("infers types from first row", () => {
      const rows: Array<Record<string, unknown>> = [
        { id: 1, name: "Alice", score: 3.14, active: true },
      ];
      const result = inferColumnTypes(["id", "name", "score", "active"], rows);
      expect(result).toEqual([
        ColumnTypeEnum.Int32,
        ColumnTypeEnum.Text,
        ColumnTypeEnum.Double,
        ColumnTypeEnum.Boolean,
      ]);
    });

    it("handles null values in first row", () => {
      const rows: Array<Record<string, unknown>> = [{ a: null, b: null }];
      const result = inferColumnTypes(["a", "b"], rows);
      expect(result).toEqual([ColumnTypeEnum.Text, ColumnTypeEnum.Text]);
    });
  });
});

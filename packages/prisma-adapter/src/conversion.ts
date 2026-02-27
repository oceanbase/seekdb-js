import { type ColumnType, ColumnTypeEnum } from "@prisma/driver-adapter-utils";

/** Infer Prisma ColumnType from a JavaScript value (for building SqlResultSet from MySQL rows). */
export function valueToColumnType(value: unknown): ColumnType {
  if (value == null) return ColumnTypeEnum.Text;
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? ColumnTypeEnum.Int32
      : ColumnTypeEnum.Double;
  }
  if (typeof value === "bigint") return ColumnTypeEnum.Int64;
  if (typeof value === "string") return ColumnTypeEnum.Text;
  if (typeof value === "boolean") return ColumnTypeEnum.Boolean;
  if (value instanceof Date) return ColumnTypeEnum.DateTime;
  if (Buffer.isBuffer(value)) return ColumnTypeEnum.Bytes;
  if (typeof value === "object") return ColumnTypeEnum.Json;
  return ColumnTypeEnum.Text;
}

/** Build columnTypes array from first row values, or Text for empty rows. */
export function inferColumnTypes(
  columnNames: string[],
  rows: Array<Record<string, unknown>>
): ColumnType[] {
  const first = rows[0];
  return columnNames.map((name) =>
    first ? valueToColumnType(first[name]) : ColumnTypeEnum.Text
  );
}

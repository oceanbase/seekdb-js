/**
 * Embedded mode - Collection name validation (same coverage as server collection-name-validation.test.ts)
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { validateCollectionName } from "../../../src/utils.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { SeekdbClient } from "../../../src/client.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("collection-name-validation.test.ts");

describe("Embedded Mode - Collection Name Validation", () => {
  describe("Valid names", () => {
    test("should accept single letter", () => {
      expect(() => validateCollectionName("a")).not.toThrow();
      expect(() => validateCollectionName("A")).not.toThrow();
    });

    test("should accept single digit", () => {
      expect(() => validateCollectionName("0")).not.toThrow();
    });

    test("should accept name with letters, digits, and underscores", () => {
      expect(() => validateCollectionName("collection_1")).not.toThrow();
      expect(() => validateCollectionName("MyCollection_123")).not.toThrow();
    });

    test("should accept maximum length name (512 characters)", () => {
      const maxLengthName = "A".repeat(512);
      expect(() => validateCollectionName(maxLengthName)).not.toThrow();
    });

    test("should accept name with all allowed characters", () => {
      expect(() =>
        validateCollectionName("abcdefghijklmnopqrstuvwxyz")
      ).not.toThrow();
      expect(() =>
        validateCollectionName("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
      ).not.toThrow();
      expect(() => validateCollectionName("0123456789")).not.toThrow();
      expect(() => validateCollectionName("___")).not.toThrow();
      expect(() => validateCollectionName("test_123_ABC")).not.toThrow();
    });
  });

  describe("Invalid type", () => {
    test("should reject non-string types with SeekdbValueError", () => {
      expect(() => validateCollectionName(123 as any)).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName(123 as any)).toThrow(
        "Collection name must be a string, got number"
      );
    });

    test("should reject null with SeekdbValueError", () => {
      expect(() => validateCollectionName(null as any)).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName(null as any)).toThrow(
        "Collection name must be a string, got object"
      );
    });

    test("should reject undefined with SeekdbValueError", () => {
      expect(() => validateCollectionName(undefined as any)).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName(undefined as any)).toThrow(
        "Collection name must be a string, got undefined"
      );
    });

    test("should reject object with SeekdbValueError", () => {
      expect(() => validateCollectionName({} as any)).toThrow(SeekdbValueError);
      expect(() => validateCollectionName({ name: "test" } as any)).toThrow(
        SeekdbValueError
      );
    });

    test("should reject array with SeekdbValueError", () => {
      expect(() => validateCollectionName([] as any)).toThrow(SeekdbValueError);
      expect(() => validateCollectionName(["test"] as any)).toThrow(
        SeekdbValueError
      );
    });
  });

  describe("Empty name", () => {
    test("should reject empty string", () => {
      expect(() => validateCollectionName("")).toThrow(SeekdbValueError);
      expect(() => validateCollectionName("")).toThrow(
        "Collection name must not be empty"
      );
    });
  });

  describe("Name too long", () => {
    test("should reject name longer than 512 characters", () => {
      const tooLongName = "a".repeat(513);
      expect(() => validateCollectionName(tooLongName)).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName(tooLongName)).toThrow(
        /Collection name too long: 513 characters; maximum allowed is 512/
      );
    });

    test("should reject name much longer than maximum", () => {
      const tooLongName = "a".repeat(1000);
      expect(() => validateCollectionName(tooLongName)).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName(tooLongName)).toThrow(
        /Collection name too long: 1000 characters; maximum allowed is 512/
      );
    });
  });

  describe("Invalid characters", () => {
    test("should reject name with dash", () => {
      expect(() => validateCollectionName("name-with-dash")).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName("name-with-dash")).toThrow(
        /Collection name contains invalid characters.*\[a-zA-Z0-9_\]/
      );
    });

    test("should reject name with dot", () => {
      expect(() => validateCollectionName("name.with.dot")).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName("name.with.dot")).toThrow(
        /Collection name contains invalid characters.*\[a-zA-Z0-9_\]/
      );
    });

    test("should reject name with space", () => {
      expect(() => validateCollectionName("name with space")).toThrow(
        SeekdbValueError
      );
      expect(() => validateCollectionName("name with space")).toThrow(
        /Collection name contains invalid characters.*\[a-zA-Z0-9_\]/
      );
    });

    test("should reject name with dollar sign", () => {
      expect(() => validateCollectionName("name$")).toThrow(SeekdbValueError);
      expect(() => validateCollectionName("name$")).toThrow(
        /Collection name contains invalid characters.*\[a-zA-Z0-9_\]/
      );
    });

    test("should reject name with Chinese characters", () => {
      expect(() => validateCollectionName("名字")).toThrow(SeekdbValueError);
      expect(() => validateCollectionName("名字")).toThrow(
        /Collection name contains invalid characters.*\[a-zA-Z0-9_\]/
      );
    });

    test("should reject name with special characters", () => {
      const specialChars = [
        "!",
        "@",
        "#",
        "%",
        "^",
        "&",
        "*",
        "(",
        ")",
        "+",
        "=",
        "[",
        "]",
        "{",
        "}",
        "|",
        "\\",
        ";",
        ":",
        "'",
        '"',
        "<",
        ">",
        ",",
        "?",
        "/",
      ];
      for (const char of specialChars) {
        const name = `test${char}name`;
        expect(() => validateCollectionName(name)).toThrow(SeekdbValueError);
        expect(() => validateCollectionName(name)).toThrow(
          /Collection name contains invalid characters.*\[a-zA-Z0-9_\]/
        );
      }
    });
  });

  describe("Edge cases", () => {
    test("should accept name at exactly 512 characters boundary", () => {
      const name511 = "a".repeat(511);
      const name512 = "a".repeat(512);
      const name513 = "a".repeat(513);
      expect(() => validateCollectionName(name511)).not.toThrow();
      expect(() => validateCollectionName(name512)).not.toThrow();
      expect(() => validateCollectionName(name513)).toThrow(SeekdbValueError);
    });

    test("should accept underscore at start", () => {
      expect(() => validateCollectionName("_test")).not.toThrow();
    });

    test("should accept underscore at end", () => {
      expect(() => validateCollectionName("test_")).not.toThrow();
    });

    test("should accept digit at start", () => {
      expect(() => validateCollectionName("1test")).not.toThrow();
    });

    test("should accept all underscores", () => {
      expect(() => validateCollectionName("___")).not.toThrow();
    });
  });

  describe("Collection Name Validation Integration", () => {
    let client: SeekdbClient;

    beforeAll(async () => {
      await cleanupTestDb("collection-name-validation.test.ts");
      client = new SeekdbClient(TEST_CONFIG);
    }, 60000);

    afterAll(async () => {
      await client.close();
    });

    describe("createCollection validation", () => {
      test("should reject empty collection name", async () => {
        await expect(
          client.createCollection({
            name: "",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
        await expect(
          client.createCollection({
            name: "",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow("Collection name must not be empty");
      });

      test("should reject collection name with dash", async () => {
        await expect(
          client.createCollection({
            name: "test-collection",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
        await expect(
          client.createCollection({
            name: "test-collection",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(/invalid characters.*\[a-zA-Z0-9_\]/);
      });

      test("should reject collection name with space", async () => {
        await expect(
          client.createCollection({
            name: "test collection",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
      });

      test("should reject collection name with special characters", async () => {
        await expect(
          client.createCollection({
            name: "test@collection",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
      });

      test("should reject collection name longer than 512 characters", async () => {
        const longName = "a".repeat(513);
        await expect(
          client.createCollection({
            name: longName,
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
        await expect(
          client.createCollection({
            name: longName,
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(/too long.*513.*maximum.*512/);
      });

      test("should reject non-string collection name", async () => {
        await expect(
          client.createCollection({
            name: 123 as any,
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
        await expect(
          client.createCollection({
            name: 123 as any,
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow("Collection name must be a string");
      });
    });

    describe("getOrCreateCollection validation", () => {
      test("should reject empty collection name", async () => {
        await expect(
          client.getOrCreateCollection({
            name: "",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
      });

      test("should reject collection name with invalid characters", async () => {
        await expect(
          client.getOrCreateCollection({
            name: "test.collection",
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
      });

      test("should reject non-string collection name", async () => {
        await expect(
          client.getOrCreateCollection({
            name: null as any,
            configuration: { dimension: 3 },
            embeddingFunction: null,
          })
        ).rejects.toThrow(SeekdbValueError);
      });
    });
  });
});

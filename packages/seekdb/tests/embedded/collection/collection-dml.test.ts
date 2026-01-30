/**
 * Collection DML tests - testing collection.add(), collection.delete(), collection.upsert(), collection.update() interfaces for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "../../../src/factory.js";
import { Collection } from "../../../src/collection.js";
import { generateCollectionName } from "../../test-utils.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";
import type { SeekdbClient } from "../../../src/client.js";

describe("Embedded Mode - Collection DML Operations", () => {
    let client: SeekdbClient;
    const TEST_DB_DIR = getTestDbDir("collection-dml.test.ts");

    beforeAll(async () => {
        await cleanupTestDb("collection-dml.test.ts");
        // Use Client() factory function - it will return SeekdbClient (embedded mode when path is provided)
        client = Client({
            path: TEST_DB_DIR,
            database: "test",
        });
    }, 60000);

    afterAll(async () => {
        await client.close();
    });

    describe("Embedded Mode Collection DML", () => {
        let collection: Collection;
        let collectionName: string;

        beforeAll(async () => {
            collectionName = generateCollectionName("test_dml");
            collection = await client.createCollection({
                name: collectionName,
                configuration: { dimension: 3, distance: "cosine" },
                embeddingFunction: null,
            });
        }, 60000);

        afterAll(async () => {
            try {
                await client.deleteCollection(collectionName);
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        test("collection.add - throws error for vector with NaN", async () => {
            const testId = "test_id_nan";
            await expect(async () => {
                await collection.add({
                    ids: testId,
                    embeddings: [1.0, NaN, 3.0],
                });
            }).rejects.toThrow(SeekdbValueError);
            await expect(async () => {
                await collection.add({
                    ids: testId,
                    embeddings: [1.0, NaN, 3.0],
                });
            }).rejects.toThrow("Vector contains invalid value: NaN");
        });

        test("collection.add - throws error for vector with Infinity", async () => {
            const testId = "test_id_inf";
            await expect(async () => {
                await collection.add({
                    ids: testId,
                    embeddings: [1.0, Infinity, 3.0],
                });
            }).rejects.toThrow(SeekdbValueError);
            await expect(async () => {
                await collection.add({
                    ids: testId,
                    embeddings: [1.0, Infinity, 3.0],
                });
            }).rejects.toThrow("Vector contains invalid value: Infinity");
        });

        test("collection.add - throws error for vector dimension mismatch at start", async () => {
            const testId = "test_id_dim_mismatch_start";
            await expect(async () => {
                await collection.add({
                    ids: testId,
                    // Collection dimension is configured as 3, so providing 2 dims should fail
                    embeddings: [1.0, 2.0],
                });
            }).rejects.toThrow(SeekdbValueError);
            await expect(async () => {
                await collection.add({
                    ids: testId,
                    embeddings: [1.0, 2.0],
                });
            }).rejects.toThrow("Dimension mismatch at index 0. Expected 3, got 2");
        });

        test("collection.add - throws error for vector dimension mismatch in middle", async () => {
            const testIds = ["id1", "id2", "id3"];
            await expect(async () => {
                await collection.add({
                    ids: testIds,
                    embeddings: [
                        [1.0, 2.0, 3.0], // Correct
                        [1.0, 2.0], // Incorrect
                        [4.0, 5.0, 6.0], // Correct
                    ],
                });
            }).rejects.toThrow(SeekdbValueError);
            await expect(async () => {
                await collection.add({
                    ids: testIds,
                    embeddings: [
                        [1.0, 2.0, 3.0],
                        [1.0, 2.0],
                        [4.0, 5.0, 6.0],
                    ],
                });
            }).rejects.toThrow("Dimension mismatch at index 1. Expected 3, got 2");
        });

        test("collection.update - throws error for vector with -Infinity", async () => {
            const testId = "test_id_neg_inf";
            // First add a valid item
            await collection.add({
                ids: testId,
                embeddings: [1.0, 2.0, 3.0],
            });

            await expect(async () => {
                await collection.update({
                    ids: testId,
                    embeddings: [1.0, -Infinity, 3.0],
                });
            }).rejects.toThrow(SeekdbValueError);
            await expect(async () => {
                await collection.update({
                    ids: testId,
                    embeddings: [1.0, -Infinity, 3.0],
                });
            }).rejects.toThrow("Vector contains invalid value: -Infinity");
        });

        test("collection.add - add single item", async () => {
            const testId1 = "test_id_1";
            await collection.add({
                ids: testId1,
                embeddings: [1.0, 2.0, 3.0],
                documents: "This is test document 1",
                metadatas: { category: "test", score: 100 },
            });

            // Verify using collection.get
            const results = await collection.get({ ids: testId1 });
            expect(results.ids.length).toBe(1);
            expect(results.ids[0]).toBe(testId1);
            expect(results.documents![0]).toBe("This is test document 1");
            expect(results?.metadatas![0]?.category).toBe("test");
        }, 60000);

        test("collection.add - add multiple items", async () => {
            const testIds = ["test_id_2", "test_id_3", "test_id_4"];
            await collection.add({
                ids: testIds,
                embeddings: [
                    [2.0, 3.0, 4.0],
                    [3.0, 4.0, 5.0],
                    [4.0, 5.0, 6.0],
                ],
                documents: ["Document 2", "Document 3", "Document 4"],
                metadatas: [
                    { category: "test", score: 90 },
                    { category: "test", score: 85 },
                    { category: "demo", score: 80 },
                ],
            });

            // Verify using collection.get
            const results = await collection.get({ ids: testIds });
            expect(results.ids.length).toBe(3);
        }, 60000);

        test("collection.update - update existing item", async () => {
            const testId1 = "test_id_1";
            await collection.update({
                ids: testId1,
                metadatas: { category: "test", score: 95, updated: true },
            });

            // Verify update using collection.get
            const results = await collection.get({ ids: testId1 });
            expect(results.ids.length).toBe(1);
            expect(results.documents![0]).toBe("This is test document 1");
            expect(results?.metadatas![0]?.score).toBe(95);
            expect(results?.metadatas![0]?.updated).toBe(true);
        });

        test("collection.update - update multiple items", async () => {
            const testIds = ["test_id_2", "test_id_3"];
            await collection.update({
                ids: testIds,
                embeddings: [
                    [2.1, 3.1, 4.1],
                    [3.1, 4.1, 5.1],
                ],
                metadatas: [
                    { category: "test", score: 92 },
                    { category: "test", score: 87 },
                ],
            });

            // Verify update using collection.get
            const results = await collection.get({ ids: testIds });
            expect(results.ids.length).toBe(2);
        });

        test("collection.upsert - upsert existing item (update)", async () => {
            const testId1 = "test_id_1";
            await collection.upsert({
                ids: testId1,
                embeddings: [1.0, 2.0, 3.0],
                documents: "Upserted document 1",
                metadatas: { category: "test", score: 98 },
            });

            // Verify upsert using collection.get
            const results = await collection.get({ ids: testId1 });
            expect(results.ids.length).toBe(1);
            expect(results.documents![0]).toBe("Upserted document 1");
            expect(results?.metadatas![0]?.score).toBe(98);
        });

        test("collection.upsert - upsert new item (insert)", async () => {
            const testIdNew = "test_id_new";
            await collection.upsert({
                ids: testIdNew,
                embeddings: [5.0, 6.0, 7.0],
                documents: "New upserted document",
                metadatas: { category: "new", score: 99 },
            });

            // Verify upsert using collection.get
            const results = await collection.get({ ids: testIdNew });
            expect(results.ids.length).toBe(1);
            expect(results.documents![0]).toBe("New upserted document");
            expect(results?.metadatas![0]?.category).toBe("new");
        });

        test("collection.delete - delete by id", async () => {
            const testId = "test_id_delete";
            await collection.add({
                ids: testId,
                embeddings: [1.0, 2.0, 3.0],
            });

            await collection.delete({ ids: testId });

            const results = await collection.get({ ids: testId });
            expect(results.ids.length).toBe(0);
        });

        test("collection.delete - delete multiple items", async () => {
            const testIds = ["test_id_del1", "test_id_del2", "test_id_del3"];
            await collection.add({
                ids: testIds,
                embeddings: [
                    [1.0, 2.0, 3.0],
                    [2.0, 3.0, 4.0],
                    [3.0, 4.0, 5.0],
                ],
            });

            await collection.delete({ ids: ["test_id_del1", "test_id_del2"] });

            const results = await collection.get({ ids: testIds });
            expect(results.ids.length).toBe(1);
            expect(results.ids[0]).toBe("test_id_del3");
        });

        test("collection.delete - delete by where clause", async () => {
            await collection.add({
                ids: ["test_id_where1", "test_id_where2"],
                embeddings: [
                    [1.0, 2.0, 3.0],
                    [2.0, 3.0, 4.0],
                ],
                metadatas: [
                    { category: "delete_me" },
                    { category: "keep_me" },
                ],
            });

            await collection.delete({
                where: { category: { $eq: "delete_me" } },
            });

            const results = await collection.get({ ids: ["test_id_where1", "test_id_where2"] });
            expect(results.ids.length).toBe(1);
            expect(results.ids[0]).toBe("test_id_where2");
        });
    });
});

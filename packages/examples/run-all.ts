/**
 * Run all examples
 */

async function runAll() {
  console.log(">>> Simple Example\n");
  await import("./simple-example.js");

  console.log("\n>>> Complete Example\n");
  await import("./complete-example.js");

  console.log("\n>>> Hybrid Search Example\n");
  await import("./hybrid-search-example.js");

  console.log("\n✓ All examples completed");
}

runAll().catch(console.error);

import { pipeline, env } from "@huggingface/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

// Set HuggingFace mirror for Chinese users, matching src/embedding-function.ts
env.remoteHost = process.env.HF_ENDPOINT || "https://huggingface.co/";

async function downloadAndTestModel() {
  console.log(`Downloading/Loading model ${MODEL_NAME}...`);
  try {
    const extractor = await pipeline("feature-extraction", MODEL_NAME);
    console.log("Model loaded successfully.");

    // Test run
    const result = await extractor("This is a test sentence.", {
      pooling: "mean",
      normalize: true,
    });
    console.log("Model inference successful:", result.dims);

    // dispose if possible to free memory
    if (typeof (extractor as any).dispose === "function") {
      await (extractor as any).dispose();
    }
  } catch (error) {
    console.error("Error downloading/loading model:", error);
    process.exit(1);
  }
}

downloadAndTestModel();

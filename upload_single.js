import { GoogleAIFileManager } from "@google/generative-ai/server";

const API_KEY = process.env.GEMINI_API_KEY;
const BOOK_PATH = process.env.BOOK_PATH || "./assets/Emergency_Medical_Guide.txt";

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize the File Manager
const fileManager = new GoogleAIFileManager(API_KEY);

async function uploadPdf() {
  try {
    console.log(`Uploading file: ${BOOK_PATH}`);

    const uploadResponse = await fileManager.uploadFile(BOOK_PATH, {
      mimeType: "text/plain",
      displayName: "ResQ-AI Emergency Medical Guide",
    });

    console.log("------------------------------------------------");
    console.log("SUCCESS! File Uploaded.");
    console.log(`Display Name: ${uploadResponse.file.displayName}`);
    console.log(`File URI: ${uploadResponse.file.uri}`); // <--- COPY THIS URI
    console.log("------------------------------------------------");

  } catch (error) {
    console.error("Error uploading file:", error);
  }
}

uploadPdf();
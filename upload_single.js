import { GoogleAIFileManager } from "@google/generative-ai/server";

// Initialize the File Manager
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "REDACTED_API_KEY");

async function uploadPdf() {
  try {
    console.log("Uploading file...");

    const uploadResponse = await fileManager.uploadFile("/Users/faizankhan/Documents/Books/Emergency_Medical_Guide.txt", {
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
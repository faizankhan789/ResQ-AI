const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require("fs");
const path = require("path");

// --- CONFIGURATION ---
// Ensure you have your API Key here or in process.env
const apiKey = process.env.API_KEY || "YOUR_API_KEY_HERE"; 
const fileManager = new GoogleAIFileManager(apiKey);

// The folder containing your books
const TARGET_FOLDER = "/Users/faizankhan/Documents/Books/All Books";

// Supported Extensions (Gemini does NOT support .docx or .chm directly)
const SUPPORTED_TYPES = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html"
};

async function uploadBulk() {
  if (!fs.existsSync(TARGET_FOLDER)) {
    console.error(`❌ Error: Folder not found at: ${TARGET_FOLDER}`);
    return;
  }

  const files = fs.readdirSync(TARGET_FOLDER);
  const uploadedParts = [];

  console.log(`📂 Scanning directory... Found ${files.length} files.`);
  console.log(`⚠️ NOTE: .docx and .chm files will be skipped (Convert them to PDF first).\n`);

  for (const fileName of files) {
    const fullPath = path.join(TARGET_FOLDER, fileName);
    const ext = path.extname(fileName).toLowerCase();

    // 1. Check if file type is supported
    if (!SUPPORTED_TYPES[ext]) {
      console.log(`⏭️  Skipping unsupported file: ${fileName}`);
      continue;
    }

    // 2. Upload
    try {
      process.stdout.write(`⬆️  Uploading ${fileName}... `);
      
      const response = await fileManager.uploadFile(fullPath, {
        mimeType: SUPPORTED_TYPES[ext],
        displayName: fileName,
      });

      console.log(`✅ Done!`);
      
      // Add to our list
      uploadedParts.push({
        fileData: {
          mimeType: response.file.mimeType,
          fileUri: response.file.uri
        }
      });

      // 3. Rate Limit Prevention (Safety pause)
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      console.log(`❌ Failed`);
      console.error(`   Error: ${error.message}`);
    }
  }

  // 4. Generate the Code Snippet for you
  console.log("\n\n🎉 UPLOAD COMPLETE!");
  console.log("👇 Copy the code below and replace the 'parts' array in your InteractiveMode.tsx:\n");
  
  console.log("parts: [");
  console.log(`  { text: "You are an expert using the attached medical library." },`);
  
  uploadedParts.forEach(part => {
    console.log(`  { fileData: { mimeType: "${part.fileData.mimeType}", fileUri: "${part.fileData.fileUri}" } },`);
  });
  
  console.log("]");
}

uploadBulk();
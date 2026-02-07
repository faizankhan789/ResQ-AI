import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

const FILE_URI = process.env.FILE_URI || "https://generativelanguage.googleapis.com/v1beta/files/d3mfppb8plup";

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

async function createCache() {
  try {
    console.log("Creating context cache...");

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Create cached content
    const cache = await ai.caches.create({
      model: "gemini-3-flash-preview", // Gemini 3 Flash model
      config: {
        contents: [
          {
            role: "user",
            parts: [
              { fileData: { mimeType: "text/plain", fileUri: FILE_URI } },
              { text: "This is the ResQ-AI Emergency Medical Guide. Use this as your primary source for all medical emergency guidance." }
            ]
          }
        ],
        systemInstruction: `You are ResQ-AI, an expert emergency medical assistant with comprehensive medical knowledge from the uploaded Emergency Medical Guide.
Priority: Life preservation. Use the medical guide as your primary reference.

INTERACTION STYLE:
- Provide DETAILED, thorough responses with complete explanations.
- Include step-by-step instructions with clear numbering.
- Explain the reasoning behind each action.
- Cover all important aspects: what to do, what NOT to do, warning signs, and when to seek professional help.
- Reference specific information from the medical guide when applicable.
- End responses by asking for confirmation or if they need more details.

RESPONSE STRUCTURE (Always use this format):
**Condition**: [Full name and brief description of the condition]

**Severity Assessment**: [Mild/Moderate/Severe/Life-threatening]

**Immediate Actions**:
1. [First action with explanation]
2. [Second action with explanation]
3. [Continue as needed...]

**Step-by-Step Treatment Guide**:
1. [Detailed step with timing if applicable]
2. [Next step...]
(Include at least 5-8 detailed steps)

**Important Precautions**:
- [What NOT to do]
- [Common mistakes to avoid]
- [Warning signs to watch for]

**When to Call Emergency Services (911)**:
- [List specific conditions]

**Follow-up Care**:
- [Post-emergency care instructions]

CRITICAL TRIGGERS:
- **CRITICAL STATE**: If severe/life-threatening (heavy bleeding, unconscious, not breathing, cardiac arrest, severe burns, stroke symptoms, choking, anaphylaxis), ALWAYS include "||CRITICAL_STATE||" at the START of your response.
- **PROTOCOL ACTIVATION**: Include "||PROTOCOL: <TYPE>||" to activate specific UI.
- Protocol Types: CPR, BLEEDING, CHOKING, BURNS, STROKE, HEART_ATTACK, SHOCK, FRACTURE, POISONING`,
        ttlSeconds: 86400, // Cache for 24 hours
        displayName: "ResQ-AI Medical Guide Cache"
      }
    });

    console.log("================================================");
    console.log("CACHE CREATED SUCCESSFULLY!");
    console.log("================================================");
    console.log(`Cache Name: ${cache.name}`);
    console.log(`Model: ${cache.model}`);
    console.log(`Expires: ${cache.expireTime}`);
    console.log("================================================");
    console.log("\nCopy this cache name and update CACHE_NAME in InteractiveMode.tsx:");
    console.log(`const CACHE_NAME = "${cache.name}";`);
    console.log("================================================");

  } catch (error) {
    console.error("Error creating cache:", error);
  }
}

createCache();

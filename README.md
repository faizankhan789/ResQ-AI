# ResQ-AI

### 1. Live Emergency Assistant (Interactive Mode)
- **Voice Interaction** - Speech-to-text input and text-to-speech responses for hands-free use
- **Live Camera Analysis** - Real-time analysis of camera feed every 4 seconds with AI overlay guidance
- **Video Analysis** - Upload and analyze video files for situational assessment
- **Image Analysis** - Upload or capture images for instant AI-powered analysis
- **Auto Critical Mode** - Detects life-threatening emergencies from user input, images, and AI responses with 80+ keyword patterns
- **Medical Book Toggle** - Load Emergency Medical Guide content inline for expert-level guidance
- **Cache Toggle** - Upload book to Google Files API and create context cache for faster responses
- **PDF Protocol Upload** - Upload medical protocol PDFs for context-aware guidance
- **Emergency Protocols** - Auto-detected protocols for CPR, Bleeding, Choking, Burns, Stroke, Heart Attack, Shock, Fracture, Poisoning

### 2. Emergency Skills Training (Learning Mode)
- AI-generated educational content for emergency preparedness
- Interactive first-aid tutorials and scenarios
- Quiz-based learning with AI feedback and scoring
- Adaptive difficulty based on performance

### 3. AI Health Scan (Analysis Mode)
- Upload video for instant AI triage assessment
- Automated severity classification
- Detailed medical analysis reports

### 4. Emergency Bridge
- Quick access to emergency services (911)
- Emergency contact management
- Location sharing capabilities via Google Maps

### 5. Medical Report Generation
- Automatic timeline tracking of all events during a session
- AI-generated paramedic handoff reports from conversation history
- Export reports as PDF with full incident timeline

---

| Category | Technology |
|----------|-----------|
| Frontend | React 19, TypeScript, Vite |
| AI Model | Google Gemini 3 Flash (`gemini-3-flash-preview`) |
| AI SDK | `@google/genai` v1.35.0 |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| PDF Export | jsPDF + jspdf-autotable |
| Speech | Web Speech API (STT + TTS) |
| Camera | MediaDevices API |
| CI/CD | GitHub Actions (auto cache refresh) |

## Prerequisites

- Node.js (v18 or higher recommended)
- Google Gemini API Key ([Get one here](https://aistudio.google.com/apikey))

## Configuration

All API and model configuration is managed through the `.env.local` file in the project root. **No API keys or model names are hardcoded in the source code.**

Create a `.env.local` file in the root directory:

```env
# Required: Your Google Gemini API Key
GEMINI_API_KEY=your_api_key_here

# Optional: AI Model (defaults to gemini-3-flash-preview if not set)
GEMINI_MODEL=gemini-3-flash-preview
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Your Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | `gemini-3-flash-preview` | Gemini model to use across the entire app |

These environment variables are injected at build time via `vite.config.ts` and are available as `process.env.API_KEY`, `process.env.GEMINI_API_KEY`, and `process.env.GEMINI_MODEL` throughout the application.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/faizankhan789/ResQ-AI.git
   cd resq-ai-emergency-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your GEMINI_API_KEY
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Medical Book Modes

The Interactive Mode supports three AI modes, controlled by two toggle buttons:

| Medical Book | Cache | Mode | Description |
|:---:|:---:|------|-------------|
| OFF | OFF | **General LLM** | Basic AI emergency assistant without medical reference |
| ON | OFF | **Inline Book** | Fetches Emergency Medical Guide and appends to system instruction |
| ON | ON | **Cached Book** | Uploads book to Google Files API, creates context cache for optimized responses |

### How Cache Mode Works
1. Checks if an existing cache is alive
2. Searches for any valid ResQ-AI cache
3. If none found: uploads `Emergency_Medical_Guide.txt` to Google Files API
4. Waits for file processing
5. Creates a new context cache (24h TTL)
6. Starts chat session with cached context

## GitHub Actions - Auto Cache Refresh

The app uses Gemini cached content for the medical book (expires every 24 hours). A GitHub workflow automatically refreshes it.

**Setup:**
1. Go to your repo Settings > Secrets and variables > Actions
2. Add secret: `GEMINI_API_KEY` with your API key
3. The workflow runs every 2 days and updates the cache automatically

**Manual trigger:**
Go to Actions > "Refresh Gemini Cache" > Run workflow

## API Rate Limits

This app uses Google Gemini API which has rate limits:
- **Free tier:** ~15 requests/minute, daily quota limits
- **Paid tier:** Higher limits based on plan

If you encounter `429 RESOURCE_EXHAUSTED` errors:
1. Wait for quota to reset (daily)
2. Enable billing in Google AI Studio for higher limits
3. Check usage at [ai.dev/rate-limit](https://ai.dev/rate-limit)


## Browser Permissions

The app requires the following permissions:
- **Camera** - For live video analysis
- **Microphone** - For voice input
- **Speech Synthesis** - For text-to-speech responses



##  Testing the App

- **Emergency Assistant:** Try prompts like *“Someone collapsed and is not breathing.”*
- **Live Camera Mode:** Allow camera access and point the camera at a scene.
- **Learning Mode:** Complete a lesson, quiz, or emergency drill.
- **Emergency Bridge:** Simulate an emergency and view the AI-generated triage summary and medical report.

Screenshots and a full walkthrough of all features are included in the demo video linked above.

---

## Future Roadmap

- Offline-first emergency guidance
- Multilingual and sign-language support
- Retrieval-Augmented Generation (RAG) for dynamic protocol lookup
- Wearable-triggered emergency detection
- Community responder networks
- Direct integration with EMS and hospital workflows for pre-arrival digital handoffs

---

Healthcare does not begin in the emergency room.  
It begins with the person standing next to you when something goes wrong.

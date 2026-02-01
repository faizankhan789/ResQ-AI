# ResQ AI - Emergency Assistant

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

An AI-powered emergency response assistant that provides real-time guidance during emergencies using Google Gemini API. Designed for hands-free operation with voice interaction and live video/image analysis.

## Features

### Interactive Mode
- **Live Camera Analysis** - Real-time analysis of camera feed every 4 seconds for emergency guidance
- **Video Analysis** - Upload and analyze video files for situational assessment
- **Image Analysis** - Upload images for instant AI-powered analysis
- **Voice Interaction** - Speech-to-text input and text-to-speech responses for hands-free use
- **Critical Mode** - Enhanced response mode for life-threatening emergencies

### Learning Mode
- Educational content for emergency preparedness
- Interactive first-aid tutorials
- Quiz-based learning with AI feedback

### Emergency Bridge
- Quick access to emergency services (911)
- Location sharing capabilities

### Medical Report Generation
- Automatic timeline tracking of all events
- AI-generated medical reports from conversation history
- Export reports as PDF

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **AI:** Google Gemini API (`@google/genai`)
- **Icons:** Lucide React
- **PDF Export:** jsPDF + jspdf-autotable

## Prerequisites

- Node.js (v18 or higher recommended)
- Google Gemini API Key ([Get one here](https://aistudio.google.com/apikey))

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/resq-ai-emergency-assistant.git
   cd resq-ai-emergency-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your API key:

   Create or edit `.env.local` file in the root directory:
   ```
   GEMINI_API_KEY=your_api_key_here
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

## API Rate Limits

This app uses Google Gemini API which has rate limits:
- **Free tier:** ~15 requests/minute, daily quota limits
- **Paid tier:** Higher limits based on plan

If you encounter `429 RESOURCE_EXHAUSTED` errors:
1. Wait for quota to reset (daily)
2. Enable billing in Google AI Studio for higher limits
3. Check usage at [ai.dev/rate-limit](https://ai.dev/rate-limit)

## Project Structure

```
resq-ai-emergency-assistant/
├── App.tsx                 # Main application component
├── components/
│   ├── Context/            # React context providers
│   │   ├── MedicalReportContext.tsx
│   │   └── LearningProfileContext.tsx
│   ├── Dashboard/          # Home view components
│   ├── Layout/             # Header, FAB components
│   └── Modules/            # Main feature modules
│       ├── InteractiveMode.tsx
│       ├── LearningMode.tsx
│       ├── EmergencyBridge.tsx
│       └── MedicalReportView.tsx
├── types/                  # TypeScript type definitions
├── vite.config.ts          # Vite configuration
└── .env.local              # Environment variables (API key)
```

## Browser Permissions

The app requires the following permissions:
- **Camera** - For live video analysis
- **Microphone** - For voice input
- **Speech Synthesis** - For text-to-speech responses

## License

MIT

## Disclaimer

This application is for educational and assistive purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always call emergency services (911) for life-threatening emergencies.

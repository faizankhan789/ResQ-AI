# ResQ-AI Emergency Assistant

## What is it?
An AI-powered emergency response app that provides **real-time medical guidance** during emergencies. Uses Google Gemini AI with a medical knowledge base for accurate first-aid instructions. Designed for **hands-free operation** during crisis situations.

---

## Features & Functionalities

### 1. AI Emergency Chat
- Type or speak your emergency situation
- Get step-by-step medical guidance instantly
- AI responds with voice (text-to-speech) for hands-free use

### 2. Voice Interaction
- **Speech-to-Text**: Speak your questions instead of typing
- **Text-to-Speech**: AI reads out instructions aloud
- Perfect when your hands are busy helping someone

### 3. Image Analysis
- Upload a photo of injury/situation
- AI analyzes and provides specific guidance
- Supports live continuous analysis with follow-up questions

### 4. Video Analysis
- Upload video of the emergency scene
- AI watches and guides you through it
- Live video mode analyzes every 3 seconds

### 5. Live Camera Mode
- Point your phone camera at the situation
- AI analyzes the live feed every 4 seconds
- Provides real-time guidance as situation changes

### 6. Auto Critical Mode
- **Automatically activates** when AI detects severe/life-threatening situations:
  - Heavy bleeding
  - Unconscious person
  - Not breathing
  - Cardiac arrest
  - Severe burns
  - Stroke symptoms
  - Choking
  - Anaphylaxis
- **UI turns red** for urgency
- **Faster, more urgent responses**
- **Activates specific protocols** (CPR, Bleeding Control, etc.)

### 7. Learning Mode
- Learn first-aid before emergencies happen
- Interactive tutorials (CPR, choking, burns, etc.)
- Quiz yourself with AI feedback
- Track your learning progress

### 8. Emergency Bridge (911)
- One-tap call to emergency services
- Share your GPS location with responders
- Quick access floating button always visible

### 9. Medical Report Generation
- Automatically logs everything during emergency:
  - What you reported
  - What AI instructed
  - Actions taken
  - Timeline of events
- Generates structured medical report
- Export as PDF to show paramedics/doctors

### 10. PDF Protocol Upload
- Upload your own medical protocols/guides
- AI uses them as reference for responses

---

## How Auto Emergency Mode Works

```
User describes situation
        ↓
AI analyzes severity
        ↓
If SEVERE detected (bleeding, unconscious, cardiac arrest, etc.)
        ↓
┌─────────────────────────────────┐
│  CRITICAL MODE ACTIVATES        │
│  • UI turns RED                 │
│  • Urgent voice alerts          │
│  • Step-by-step protocol starts │
│  • Timer for actions            │
│  • 911 quick-dial appears       │
└─────────────────────────────────┘
```

---

## Use Cases

| Scenario | How ResQ-AI Helps |
|----------|-------------------|
| Someone choking | Voice-guided Heimlich maneuver steps |
| Deep cut bleeding | Shows pressure points, bandaging technique |
| Person collapsed | CPR guidance with timer, checks for breathing |
| Burn injury | Immediate cooling steps, severity assessment |
| Car accident | Triage guidance, what NOT to move |
| Allergic reaction | Identifies anaphylaxis signs, EpiPen guidance |

---

## Future Features (Planned)

### Connectivity & Access
| Feature | Description |
|---------|-------------|
| **Offline Mode** | Download essential medical guides for use without internet connection |
| **Multi-Language Support** | Emergency guidance available in 20+ languages |
| **Sign Language Mode** | Visual animated instructions for deaf/hard-of-hearing users |

### Medical Data
| Feature | Description |
|---------|-------------|
| **Medical ID Profile** | Store personal health info - allergies, conditions, medications, blood type, emergency contacts |
| **Medication Scanner** | Scan any pill with camera to identify and check for drug interactions |
| **Poison Control Database** | Instant lookup for toxic substances with treatment protocols |

### Location Services
| Feature | Description |
|---------|-------------|
| **Nearby Hospital Finder** | GPS-based search for nearest ER with real-time wait times |
| **AED Locator** | Find nearest automated defibrillator on interactive map |
| **24/7 Pharmacy Finder** | Locate open pharmacies nearby for urgent medication needs |

### Community & Communication
| Feature | Description |
|---------|-------------|
| **Emergency Contacts Auto-Alert** | Automatically notify family/friends when critical emergency detected |
| **Community Responders Network** | Connect with nearby CPR-certified volunteers for immediate help |
| **Live Video Call with Paramedic** | Real-time video consultation with medical professionals |

### Specialized Modes
| Feature | Description |
|---------|-------------|
| **Pediatric Mode** | Child-specific emergency protocols (dosages, techniques adjusted for children) |
| **Pet Emergency Mode** | First-aid guidance for dogs, cats, and other animals |
| **Mental Health Crisis Support** | Suicide prevention resources, panic attack guidance, crisis hotlines |
| **Mass Casualty Triage** | Multi-victim prioritization system for disaster scenarios |

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **AI:** Google Gemini 3 Flash API (with cached medical knowledge)
- **Voice:** Web Speech API (speech-to-text & text-to-speech)
- **Icons:** Lucide React
- **PDF Export:** jsPDF + jspdf-autotable
- **CI/CD:** GitHub Actions (auto cache refresh)

---

## Disclaimer

This application is for educational and assistive purposes only. It is **not a substitute** for professional medical advice, diagnosis, or treatment. **Always call emergency services (911)** for life-threatening emergencies.

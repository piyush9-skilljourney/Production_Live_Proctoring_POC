# PIE v2 — Proctoring Intelligence Engine

## Project Overview
- Name: PIE v2
- Organization: Hyrai
- Type: Real-Time AI Behavioral Intelligence Platform
- Frontend: React + Vite + TensorFlow.js
- Backend: FastAPI (Python)
- AI Stack:
  - MediaPipe FaceMesh
  - TensorFlow.js
  - COCO-SSD
  - DeepFace
  - Web Audio API
- Database: MongoDB
- Real-Time Layer: WebSocket + REST Sync
- Telemetry Frequency: 10 Hz
- Current Phase: Sprint 0 (Foundation Migration)
- Started: 2026-05-08

---

## Vision Statement

PIE is designed to move from:
"Detection"
to
"Behavioral Understanding."

The system should:
- Reduce false positives
- Differentiate anxiety from dishonesty
- Generate explainable evidence chains
- Build recruiter trust
- Preserve candidate fairness
- Produce legally defensible reports

---

## Architecture Layers

| Layer | Name | Responsibility | Status |
|------|------|----------------|--------|
| L00 | Setup Layer | Calibration + Identity | In Progress |
| L01 | Intelligence Capture | Vision + Audio telemetry | Operational |
| L02 | Signal Calibration | Confidence computation | Operational |
| L03 | Personal Baseline | Candidate normalization | Operational |
| L04 | Event Factory | Behavioral event generation | Operational |
| L05 | Threshold Guard | False-positive filtering | Operational |
| L06 | Recovery Modeling | Anxiety recovery logic | Operational |
| L07 | Pattern Memory | Temporal pattern detection | Operational |
| L08 | Multi-Modal Correlation | Cross-signal intelligence | Operational |
| L09 | Scoring Engine | A / E / I computation | Operational |
| L10 | Answer Correlation | Behavior-answer linkage | Planned |
| L11 | Behavioral Dashboard | Recruiter interface | Operational |
| L12 | Narrative Engine | Explainable summaries | Operational |

---

## Sprint Registry

| Sprint | Goal | Layers | Status |
|--------|------|--------|--------|
| Sprint 1 | Foundation: Browser capture + Sync | L01 + L02 | Completed |
| Sprint 2 | Core Engine: Aggregation + Scoring | L03-L09 | Completed |
| Sprint 3 (New) | Calibration Refinement | L00 | In Progress |
| Sprint 4 (New) | Identity Verification (ID) | L00 | Planned |
| Sprint 5 (New) | Answer Correlation + Audit | L10-L12 | Planned |

---

## Repository Structure

| Path | Purpose |
|------|---------|
| frontend/src/components | UI + overlays |
| frontend/src/hooks | Telemetry hooks |
| frontend/src/services | Sync + inference services |
| backend/app/api | FastAPI routes |
| backend/app/services | AI scoring services |
| backend/app/models | Session + telemetry models |
| backend/app/storage | DB layer |
| backend/app/patterns | Temporal intelligence |
| backend/app/narrative | Explainable AI |
| shared/types | Shared telemetry contracts |
| docs | Research + architecture docs |
| tests | Unit/integration tests |

---

## File Registry
(UPDATED ON EVERY FILE CHANGE)

| # | File Path | Layer | Type | Status | Description |
|---|-----------|------|------|--------|-------------|
| 1 | PIE_CONTEXT.md | ALL | DOC | ✅ Created | Technical memory & architecture registry |
| 2 | backend/requirements.txt | L00 | CFG | ✅ Created | Backend dependencies |
| 3 | frontend/package.json | L00 | CFG | ✅ Created | Frontend dependencies |
| 4 | shared/types.ts | L01 | TYPE | ✅ Created | Shared telemetry contracts |
| 5 | frontend/src/hooks/usePIE.ts | L02 | Hook | ✅ Created | Sync pipeline + audio monitoring |
| 6 | frontend/src/hooks/useInference.ts | L01 | Hook | ✅ Created | FaceMesh + COCO-SSD inference |
| 7 | backend/app/main.py | L02 | API | ✅ Created | FastAPI entry point + /sync route |
| 8 | frontend/src/components/TestDashboard.tsx | L00 | UI | ✅ Created | Foundation verification dashboard |
| 9 | frontend/vite.config.ts | L00 | CFG | ✅ Created | Vite configuration |
| 10| backend/app/services/events.py | L04 | Service | ✅ Created | Event factory & Z-score gating logic |
| 11| .vscode/settings.json | L00 | CFG | ✅ Created | Workspace VS Code settings for Python interpreter |

---

## AI Pipeline Registry

| Stage | Input | Processing | Output | Status |
|------|------|------------|--------|--------|
| Webcam Stream | Raw camera | MediaPipe FaceMesh | 468 landmarks | Operational |
| Audio Stream | Microphone | RMS + VAD | Speech probability | Operational |
| Object Detection | Video frame | COCO-SSD | Device/person events | Operational |
| Calibration Engine | Gaze samples | Offset normalization | Personalized gaze map | In Progress |
| Baseline Engine | First 60s telemetry | Rolling μ/σ | Candidate baseline | Operational |
| Pattern Memory | Window history | Temporal analysis | Pattern flags | Operational |
| Correlation Engine | Behavior + answers | Evidence linkage | Suspicion reasoning | Operational |

---

## Telemetry Schema Registry

| Field | Type | Description | Source |
|------|------|-------------|--------|
| gaze_zone | string | CENTER/LEFT/RIGHT | FaceMesh |
| yaw | number | Horizontal head rotation | FaceMesh |
| pitch | number | Vertical rotation | FaceMesh |
| face_visible | boolean | Face visibility state | FaceMesh |
| audio_level | number | RMS amplitude | Web Audio API |
| vad_speech | boolean | Voice activity | Audio VAD |
| objects | array | Detected objects | COCO-SSD |
| confidence | number | Signal quality score | L02 |
| attentiveness | number | A Index | L09 |
| environment | number | E Index | L09 |
| integrity | number | I Index | L09 |

---

## Event Registry

| Event | Trigger | Severity | Layer | Status |
|------|---------|----------|--------|--------|
| GAZE_AWAY | gaze deviation > threshold | Moderate | L04 | Active |
| PHONE_DETECTED | COCO-SSD detects phone | Critical | L04 | Active |
| SECOND_PERSON | Additional face detected | Critical | L04 | Active |
| VOICE_DETECTED | VAD speech spike | Moderate | L04 | Active |
| FACE_ABSENT | Face invisible | Moderate | L04 | Active |
| IDENTITY_DRIFT | Embedding mismatch | Critical | L09 | Planned |

---

## Formula Registry

| Formula | Purpose | Layer | Status |
|---------|---------|--------|--------|
| Confidence Formula | Signal reliability | L02 | Active |
| Z-Score Formula | Personal baseline deviation | L03 | Active |
| Recovery Bonus Formula | Anxiety recovery | L06 | Active |
| Attentiveness Index | Focus scoring | L09 | Active |
| Environment Index | Environment integrity | L09 | Active |
| Integrity Index | Final composite score | L09 | Active |

---

## Endpoint Registry

| Method | Endpoint | Purpose | Layer | Status |
|--------|----------|---------|--------|--------|
| POST | /api/sync | Telemetry sync | L02 | Active |
| POST | /api/calibrate | Save calibration map | L00 | Planned |
| POST | /api/verify-id | Identity verification | L09 | Planned |
| POST | /api/correlate-answer | Behavior-answer correlation | L10 | Planned |
| GET | /api/session/{id} | Session details | Dashboard | Planned |

---

## Fairness & Ethics Registry

| Concern | Mitigation Strategy | Layer | Status |
|---------|--------------------|--------|--------|
| Natural fidgeting | Personal baseline normalization | L03 | Active |
| Anxiety spikes | Recovery modeling | L06 | Active |
| Poor lighting | Confidence adjustment | L02 | Active |
| False gaze drift | Calibration mapping | L00 | In Progress |
| One-off anomalies | Threshold guard | L05 | Active |
| AI hallucination | Deterministic narrative templates | L12 | Active |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| FaceMesh FPS | ≥ 15 FPS |
| Telemetry Frequency | 10 Hz |
| Sync Latency | < 1s |
| Frame Loss | < 5% |
| Detection Confidence | ≥ 0.65 |
| Dashboard Update Rate | 5s |
| Max Buffer Duration | 5s |

---

## Dependencies Registry

| Dependency | Version | Purpose |
|------------|---------|---------|
| @mediapipe/face_mesh | latest | Landmark tracking |
| @tensorflow/tfjs | latest | Browser ML |
| coco-ssd | latest | Object detection |
| deepface | latest | Identity embeddings |
| fastapi | latest | Backend API |
| websockets | latest | Real-time transport |

---

## Environment Variables

| Key | Description |
|----|-------------|
| MONGO_URI | MongoDB connection |
| JWT_SECRET | Auth secret |
| MODEL_PATH | AI model directory |
| VITE_API_URL | Frontend backend URL |
| SESSION_BUFFER_LIMIT | Max telemetry buffer |
| FACE_CONFIDENCE_THRESHOLD | Face detection confidence |
| PHONE_DETECTION_THRESHOLD | Phone detection confidence |

---

## Research Notes
(UPDATED DURING IMPLEMENTATION)

| Step | Research Finding | Impact |
|-----|------------------|--------|
| R-1 | Static gaze calibration caused corner drift | Added moving-ball interpolation |
| R-2 | MediaPipe WASM aborts on HMR re-render | Implemented singleton ref pattern |

---

## Change Log
(UPDATED AFTER EVERY FILE OPERATION)

| Step | Action | File | Layer | Details |
|------|--------|------|--------|---------|
| Step-1 | CREATE | PIE_CONTEXT.md | ALL | Initialized technical context |
| Step-2 | CREATE | backend/requirements.txt | L00 | Added backend dependencies |
| Step-3 | CREATE | frontend/package.json | L00 | Added frontend dependencies |
| Step-4 | CREATE | shared/types.ts | L01 | Added shared telemetry types |
| Step-5 | CREATE | frontend/src/hooks/usePIE.ts | L02 | Added sync pipeline hook |
| Step-6 | CREATE | frontend/src/hooks/useInference.ts | L01 | Added inference hook (L01 foundation) |
| Step-7 | CREATE | backend/app/main.py | L02 | Added FastAPI sync entry point |
| Step-8 | CREATE | - | L00 | Added verification UI infrastructure |
| Step-9 | MODIFY | useInference.ts | L01 | Implemented CDN Singleton pattern |
| Step-10| CREATE | tsconfig.json | L00 | Added Vite client types |
| Step-11| MODIFY | useInference.ts | L01 | Fixed TS server cache issue by explicit index import |
| Step-12| MODIFY | CalibrationOverlay.tsx | L00 | Fixed TS server cache issue by explicit index import |
| Step-13| RENAME | frontend/src/types.ts | L01 | Flattened types dir to types.ts to bust IDE cache |
| Step-14| MODIFY | useInference, CalibrationOverlay | L01 | Reverted imports to ../types |
| Step-15| CREATE | backend/app/services/events.py | L04 | Added event factory for Z-score gating |
| Step-16| MODIFY | backend/app/main.py | L02,L04 | Integrated event factory and Event schema |
| Step-17| CREATE | .vscode/settings.json | L00 | Configured VS Code to use backend venv python interpreter |
| Step-18| MODIFY | .vscode/settings.json | L00 | Updated paths to absolute paths to support multi-workspace setups |
| Step-19| MODIFY | PIE_CONTEXT.md | ALL | Started implementation of Essential Fixes and Sprint 5 completion |
| Step-20| MODIFY | frontend/src/types.ts | L01 | Added sampleCount to CalibrationMap and PIEEvent |
| Step-21| MODIFY | backend/app/main.py | L00 | Implemented /api/calibrate with validation & webhook support |
| Step-22| MODIFY | frontend/src/hooks/useInference.ts | L01 | Gated object detection via enableObjectDetection |
| Step-23| CREATE | frontend/src/components/LiveEventLog.tsx | L00 | Added frontend live event feed |
| Step-24| MODIFY | frontend/src/App.tsx | L00 | Integrated Calibration validation & LiveEventLog |

---

## Known Issues / TODOs

| # | Issue | Layer | Priority |
|---|-------|------|----------|
| 1 | Low-light gaze instability | L01 | High |
| 2 | Mobile Safari camera inconsistency | L01 | Medium |
| 3 | DeepFace cold-start latency | L09 | Medium |
| 4 | Temporal memory optimization needed | L07 | Medium |

---

## Final Summary
(To be added after implementation completes)

- Total Files Created: 1
- Total Layers Operational: 12 (Partial)
- Total AI Events: 5
- Total Endpoints: 1
- Total Formulas: 6
- Total Recruiter Reports Generated: 0
- Frontend Run Command: npm run dev
- Backend Run Command: uvicorn main:app --reload
- Dashboard URL: http://localhost:5173
- Backend URL: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Production Readiness: 65%

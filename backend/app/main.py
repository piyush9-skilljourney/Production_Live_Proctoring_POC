from datetime import datetime, timedelta, timezone
import json
import os
import urllib.request
from secrets import token_urlsafe
from typing import Literal, Any
from uuid import uuid4

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.confidence import calculate_confidence
from app.services.events import detect_events

app = FastAPI(title="PIE v2 Proctoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://production-live-proct-git-b68f3b-piyush9-skilljourneys-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GazeZone = Literal["CENTER", "LEFT", "RIGHT", "UP", "DOWN", "MISSING"]
MAX_RECENT_FRAMES = 200
BASELINE_WINDOW_LIMIT = 12
SESSION_TOKEN_TTL_MINUTES = 120
WEBHOOK_INTERVAL_SECONDS = 5
FRONTEND_IFRAME_BASE_URL = os.getenv(
    "FRONTEND_IFRAME_BASE_URL",
    "http://127.0.0.1:5173/",
)
SESSION_STORE: dict[str, "SessionRecord"] = {}


class HeadPose(BaseModel):
    yaw: float
    pitch: float


class FramePayload(BaseModel):
    timestamp: int
    gaze_zone: GazeZone
    head_pose: HeadPose
    face_visible: bool
    fps: float
    audio_level: float
    vad_speech: bool
    objects: list[str]


class SyncRequest(BaseModel):
    session_id: str | None = None
    frames: list[FramePayload]


class BaselineWindow(BaseModel):
    gaze_deviation: float
    audio_level: float


class RollingMetricStats(BaseModel):
    mean: float = 0.0
    std_dev: float = 0.0


class BaselineStats(BaseModel):
    windows_collected: int = 0
    is_ready: bool = False
    gaze_deviation: RollingMetricStats = Field(default_factory=RollingMetricStats)
    audio_level: RollingMetricStats = Field(default_factory=RollingMetricStats)


class Event(BaseModel):
    type: str
    severity: str
    timestamp: str
    details: str


class SyncResponse(BaseModel):
    session_id: str
    received_count: int
    confidence: float
    echoed_frames: list[FramePayload]
    baseline: BaselineStats
    events: list[Event]


class SessionRecord(BaseModel):
    session_id: str
    created_at: str
    last_seen_at: str
    candidate_id: str | None = None
    assessment_id: str | None = None
    proctoring_token: str | None = None
    expires_at: str | None = None
    webhook_url: str | None = None
    calibration_attempts: int = 0
    calibration_map: dict[str, Any] | None = None
    calibration_complete: bool = False
    total_frames: int = 0
    last_confidence: float = 0.0
    baseline_windows: list[BaselineWindow] = Field(default_factory=list)
    baseline: BaselineStats = Field(default_factory=BaselineStats)
    recent_frames: list[FramePayload] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    last_event_times: dict[str, float] = Field(default_factory=dict)
    last_webhook_sent_at: float = 0.0


class AdminSessionSummary(BaseModel):
    session_id: str
    candidate_id: str | None = None
    assessment_id: str | None = None
    created_at: str
    last_seen_at: str
    expires_at: str | None = None
    total_frames: int
    last_confidence: float
    baseline_ready: bool
    baseline_windows: int
    recent_frame_count: int


class AdminSessionsResponse(BaseModel):
    sessions: list[AdminSessionSummary]


class SessionStartRequest(BaseModel):
    candidate_id: str
    assessment_id: str
    webhook_url: str | None = None


class SessionStartResponse(BaseModel):
    session_id: str
    proctoring_token: str
    expires_at: str
    iframe_url: str

class CalibrationMap(BaseModel):
    centerYaw: float
    centerPitch: float
    yawRange: float      # max - min yaw across all points
    pitchRange: float    # max - min pitch across all points
    sampleCount: int     # how many frames were captured
    pointSamples: list[dict[str, Any]]
    trackingSamples: list[dict[str, Any]]

class CalibrationResponse(BaseModel):
    valid: bool
    reason: str

def post_webhook(url: str, payload: dict):
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            pass
    except Exception as e:
        print(f"[Webhook] Failed to send update to {url}: {e}")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_iframe_url(session_id: str, proctoring_token: str) -> str:
    return (
        f"{FRONTEND_IFRAME_BASE_URL}/"
        f"?session_id={session_id}&token={proctoring_token}"
    )


def calculate_mean(values: list[float]) -> float:
    if not values:
        return 0.0

    return sum(values) / len(values)


def calculate_std_dev(values: list[float], mean: float) -> float:
    if len(values) < 2:
        return 0.0

    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return variance ** 0.5


def calculate_gaze_deviation(frame: FramePayload) -> float:
    return (frame.head_pose.yaw**2 + frame.head_pose.pitch**2) ** 0.5


def build_baseline_window(frames: list[FramePayload]) -> BaselineWindow:
    if not frames:
        return BaselineWindow(gaze_deviation=0.0, audio_level=0.0)

    return BaselineWindow(
        gaze_deviation=calculate_mean(
            [calculate_gaze_deviation(frame) for frame in frames]
        ),
        audio_level=calculate_mean([frame.audio_level for frame in frames]),
    )


def build_baseline_stats(windows: list[BaselineWindow]) -> BaselineStats:
    gaze_values = [window.gaze_deviation for window in windows]
    audio_values = [window.audio_level for window in windows]
    gaze_mean = calculate_mean(gaze_values)
    audio_mean = calculate_mean(audio_values)

    return BaselineStats(
        windows_collected=len(windows),
        is_ready=len(windows) >= BASELINE_WINDOW_LIMIT,
        gaze_deviation=RollingMetricStats(
            mean=round(gaze_mean, 4),
            std_dev=round(calculate_std_dev(gaze_values, gaze_mean), 4),
        ),
        audio_level=RollingMetricStats(
            mean=round(audio_mean, 4),
            std_dev=round(calculate_std_dev(audio_values, audio_mean), 4),
        ),
    )


def summarize_objects_for_batch(frames: list[FramePayload]) -> list[str]:
    if not frames:
        return []

    phone_detected = any("cell phone" in frame.objects for frame in frames)
    max_person_count = max((frame.objects.count("person") for frame in frames), default=0)
    other_object_detected = any("other_object" in frame.objects for frame in frames)

    summarized_objects = ["person"] * max_person_count
    if phone_detected:
        summarized_objects.append("cell phone")
    elif max_person_count == 0 and other_object_detected:
        summarized_objects.append("other_object")

    return summarized_objects


def update_baseline(session: SessionRecord, frames: list[FramePayload]) -> None:
    if len(session.baseline_windows) < BASELINE_WINDOW_LIMIT:
        session.baseline_windows.append(build_baseline_window(frames))

    session.baseline = build_baseline_stats(session.baseline_windows)


def get_or_create_session(session_id: str | None) -> SessionRecord:
    resolved_session_id = session_id or f"session-{uuid4()}"
    record = SESSION_STORE.get(resolved_session_id)
    if record:
        return record

    now = utc_now()
    record = SessionRecord(
        session_id=resolved_session_id,
        created_at=now,
        last_seen_at=now,
    )
    SESSION_STORE[resolved_session_id] = record
    return record


def get_existing_session_or_404(session_id: str) -> SessionRecord:
    record = SESSION_STORE.get(session_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sync", response_model=SyncResponse)
def sync(payload: SyncRequest, background_tasks: BackgroundTasks) -> SyncResponse:
    frame_count = len(payload.frames)
    current_ts = datetime.now(timezone.utc).timestamp()
    avg_fps = (
        sum(frame.fps for frame in payload.frames) / frame_count
        if frame_count
        else 0.0
    )
    visibility_ratio = (
        sum(1 for frame in payload.frames if frame.face_visible) / frame_count
        if frame_count
        else 0.0
    )
    confidence = calculate_confidence(
        avg_fps=avg_fps,
        visibility_ratio=visibility_ratio,
    )

    session = get_or_create_session(payload.session_id)
    session.last_seen_at = utc_now()
    session.total_frames += frame_count
    session.last_confidence = confidence
    update_baseline(session, payload.frames)
    session.recent_frames.extend(payload.frames)
    session.recent_frames = session.recent_frames[-MAX_RECENT_FRAMES:]

    new_events = []
    if session.baseline.is_ready and payload.frames:
        current_window = build_baseline_window(payload.frames)
        speech_detected = any(frame.vad_speech for frame in payload.frames)

        all_objects = summarize_objects_for_batch(payload.frames)

        print(f"[DEBUG] Latest frame objects: {all_objects}")
        print(f"[DEBUG] Person count: {all_objects.count('person')}")
        
        detected_dicts = detect_events(
            window_gaze=current_window.gaze_deviation,
            window_audio=current_window.audio_level,
            baseline_gaze_mean=session.baseline.gaze_deviation.mean,
            baseline_gaze_std=session.baseline.gaze_deviation.std_dev,
            baseline_audio_mean=session.baseline.audio_level.mean,
            baseline_audio_std=session.baseline.audio_level.std_dev,
            speech_detected=speech_detected,
            objects=all_objects,
            last_event_times=session.last_event_times,
            current_timestamp=current_ts,
        )
        new_events = [Event(**e) for e in detected_dicts]
        session.events.extend(new_events)

    if (
        session.webhook_url
        and (current_ts - session.last_webhook_sent_at) >= WEBHOOK_INTERVAL_SECONDS
    ):
        webhook_payload = {
            "session_id": session.session_id,
            "integrity": 100,  # Placeholder until Sprint 6
            "attentiveness": 100,  # Placeholder until Sprint 6
            "environment": 100,  # Placeholder until Sprint 6
            "events": [e.dict() for e in new_events],
            "latest_events": [e.dict() for e in new_events],
        }
        background_tasks.add_task(post_webhook, session.webhook_url, webhook_payload)
        session.last_webhook_sent_at = current_ts

    return SyncResponse(
        session_id=session.session_id,
        received_count=frame_count,
        confidence=confidence,
        echoed_frames=payload.frames,
        baseline=session.baseline,
        events=new_events,
    )


@app.post("/api/session/start", response_model=SessionStartResponse)
def session_start(body: SessionStartRequest) -> SessionStartResponse:
    session_id = f"session-{uuid4()}"
    proctoring_token = token_urlsafe(32)
    now = utc_now()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=SESSION_TOKEN_TTL_MINUTES)
    ).isoformat()
    SESSION_STORE[session_id] = SessionRecord(
        session_id=session_id,
        created_at=now,
        last_seen_at=now,
        candidate_id=body.candidate_id,
        assessment_id=body.assessment_id,
        proctoring_token=proctoring_token,
        expires_at=expires_at,
        webhook_url=body.webhook_url,
    )
    return SessionStartResponse(
        session_id=session_id,
        proctoring_token=proctoring_token,
        expires_at=expires_at,
        iframe_url=build_iframe_url(session_id, proctoring_token),
    )

@app.get("/api/admin/sessions", response_model=AdminSessionsResponse)
def list_sessions() -> AdminSessionsResponse:
    return AdminSessionsResponse(
        sessions=[
            AdminSessionSummary(
                session_id=session.session_id,
                candidate_id=session.candidate_id,
                assessment_id=session.assessment_id,
                created_at=session.created_at,
                last_seen_at=session.last_seen_at,
                expires_at=session.expires_at,
                total_frames=session.total_frames,
                last_confidence=session.last_confidence,
                baseline_ready=session.baseline.is_ready,
                baseline_windows=session.baseline.windows_collected,
                recent_frame_count=len(session.recent_frames),
            )
            for session in SESSION_STORE.values()
        ]
    )


@app.get("/api/admin/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str) -> SessionRecord:
    return get_existing_session_or_404(session_id)

@app.post("/api/calibrate", response_model=CalibrationResponse)
def calibrate(session_id: str, body: CalibrationMap) -> CalibrationResponse:
    session = get_or_create_session(session_id)

    # Retry limit
    if session.calibration_attempts >= 3:
        return CalibrationResponse(
            valid=False,
            reason="Maximum attempts reached. Contact administrator."
        )
    session.calibration_attempts += 1

    # Removed strict range validation:
    # If the candidate only moves their eyes and not their head, their raw head-pose range
    # will be very small (e.g. < 5.0). By capturing this small range, the frontend
    # correctly sets a tight threshold for their specific behavior.

    # Validate sample count
    if body.sampleCount < 15:
        return CalibrationResponse(
            valid=False,
            reason="Not enough tracking data. Ensure good lighting and face the camera."
        )

    # All checks passed
    session.calibration_map = body.dict()
    session.calibration_complete = True
    return CalibrationResponse(valid=True, reason="Calibration successful.")

from datetime import datetime, timezone

# Deduplication windows (seconds) — prevent re-firing same event within window
DEDUP_WINDOWS = {
    "GAZE_AWAY": 5,
    "VOICE_DETECTED": 5,
    "SECOND_PERSON": 10,
    "PHONE_DETECTED": 0,  # log every detection
    "TAB_SWITCH": 0,  # log every tab switch — needed for answer correlation (Sprint 7)
}


def calculate_z_score(value: float, mean: float, std_dev: float) -> float:
    if std_dev == 0.0:
        return 0.0
    return (value - mean) / std_dev


def should_emit_event(
    event_type: str, last_event_times: dict[str, float], current_time: float
) -> bool:
    """Check if event should be emitted based on deduplication window."""
    if event_type not in DEDUP_WINDOWS:
        return True
    
    dedup_window = DEDUP_WINDOWS[event_type]
    if dedup_window == 0:  # Always emit
        return True
    
    last_time = last_event_times.get(event_type, 0.0)
    return (current_time - last_time) >= dedup_window


def detect_events(
    window_gaze: float,
    window_audio: float,
    baseline_gaze_mean: float,
    baseline_gaze_std: float,
    baseline_audio_mean: float,
    baseline_audio_std: float,
    speech_detected: bool = False,
    objects: list[str] | None = None,
    last_event_times: dict[str, float] | None = None,
    current_timestamp: float | None = None,
) -> list[dict]:
    """
    Detect events based on gaze, audio, and object detection with deduplication.
    
    Args:
        window_gaze: Mean gaze deviation for current window
        window_audio: Mean audio level for current window
        baseline_gaze_mean: Mean gaze deviation from baseline
        baseline_gaze_std: Std dev of gaze deviation from baseline
        baseline_audio_mean: Mean audio level from baseline
        baseline_audio_std: Std dev of audio level from baseline
        objects: List of detected objects (e.g., ["cell phone", "person"])
        last_event_times: Dict tracking last emit time for each event type
        current_timestamp: Current timestamp as float (Unix time)
    
    Returns:
        List of events that passed deduplication
    """
    events = []
    objects = objects or []
    last_event_times = last_event_times or {}
    
    if current_timestamp is None:
        current_timestamp = datetime.now(timezone.utc).timestamp()
    
    now_iso = datetime.fromtimestamp(current_timestamp, timezone.utc).isoformat()
    
    # 1. Check GAZE_AWAY via Z-score
    gaze_z = calculate_z_score(window_gaze, baseline_gaze_mean, baseline_gaze_std)
    if abs(gaze_z) > 2.5:
        if should_emit_event("GAZE_AWAY", last_event_times, current_timestamp):
            events.append({
                "type": "GAZE_AWAY",
                "severity": "Moderate",
                "timestamp": now_iso,
                "details": f"Gaze deviation z-score {gaze_z:.2f} exceeds threshold of 2.5",
            })
            last_event_times["GAZE_AWAY"] = current_timestamp
    
    # 2. Check VOICE_DETECTED via positive audio spike plus speech activity
    audio_z = calculate_z_score(window_audio, baseline_audio_mean, baseline_audio_std)
    if speech_detected and audio_z > 2.5:
        if should_emit_event("VOICE_DETECTED", last_event_times, current_timestamp):
            events.append({
                "type": "VOICE_DETECTED",
                "severity": "Moderate",
                "timestamp": now_iso,
                "details": f"Audio level z-score {audio_z:.2f} exceeds threshold of 2.5 while speech is active",
            })
            last_event_times["VOICE_DETECTED"] = current_timestamp
    
    # 3. Check PHONE_DETECTED
    if "cell phone" in objects:
        if should_emit_event("PHONE_DETECTED", last_event_times, current_timestamp):
            events.append({
                "type": "PHONE_DETECTED",
                "severity": "High",
                "timestamp": now_iso,
                "details": "Cell phone detected in frame",
            })
            last_event_times["PHONE_DETECTED"] = current_timestamp
    
    # 4. Check SECOND_PERSON
    person_count = objects.count("person")
    if person_count > 1:
        if should_emit_event("SECOND_PERSON", last_event_times, current_timestamp):
            events.append({
                "type": "SECOND_PERSON",
                "severity": "High",
                "timestamp": now_iso,
                "details": f"Multiple people detected in frame (count: {person_count})",
            })
            last_event_times["SECOND_PERSON"] = current_timestamp
    
    return events

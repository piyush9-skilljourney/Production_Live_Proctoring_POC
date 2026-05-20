from datetime import datetime, timezone

# Deduplication windows (seconds) — prevent re-firing same event within window
DEDUP_WINDOWS = {
    "GAZE_AWAY": 5,
    "VOICE_DETECTED": 5,
    "SECOND_PERSON": 10,
    "PHONE_DETECTED": 0,  # log every detection
    "TAB_SWITCH": 0,      # log every tab switch
    "CORROBORATED_ANOMALY": 5,
}


def calculate_z_score(value: float, mean: float, std_dev: float) -> float:
    effective_std = max(std_dev, 0.01)
    return (value - mean) / effective_std


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


def check_anomaly_duration(
    recent_frames: list,
    new_frames_count: int,
    condition_fn,
    max_gap_ms: float = 2000.0
) -> bool:
    """
    Checks if any frame in the newly added batch is part of a continuous
    anomaly sequence that spans at least 3.0 seconds.
    """
    if not recent_frames:
        return False
        
    start_idx = len(recent_frames) - new_frames_count
    if start_idx < 0:
        start_idx = 0
        
    for idx in range(start_idx, len(recent_frames)):
        if not condition_fn(recent_frames[idx]):
            continue
            
        oldest_idx = idx
        for i in range(idx - 1, -1, -1):
            # Check gap
            gap = recent_frames[i+1].timestamp - recent_frames[i].timestamp
            if gap > max_gap_ms:
                break
            if condition_fn(recent_frames[i]):
                oldest_idx = i
            else:
                break
                
        duration_ms = recent_frames[idx].timestamp - recent_frames[oldest_idx].timestamp
        if duration_ms >= 3000.0:
            return True
            
    return False


def detect_events(
    recent_frames: list,
    new_frames_count: int,
    baseline_gaze_mean: float,
    baseline_gaze_std: float,
    baseline_audio_mean: float,
    baseline_audio_std: float,
    last_event_times: dict[str, float] | None = None,
    current_timestamp: float | None = None,
) -> list[dict]:
    """
    Detect events based on gaze, audio, and object detection with deduplication and duration guards.
    """
    events = []
    last_event_times = last_event_times or {}
    
    if current_timestamp is None:
        current_timestamp = datetime.now(timezone.utc).timestamp()
    
    now_iso = datetime.fromtimestamp(current_timestamp, timezone.utc).isoformat()
    
    # Define frame helpers
    def get_gaze_deviation(frame) -> float:
        return (frame.head_pose.yaw**2 + frame.head_pose.pitch**2) ** 0.5

    # 1. Check PHONE_DETECTED
    phone_cond = lambda f: "cell phone" in f.objects
    if check_anomaly_duration(recent_frames, new_frames_count, phone_cond):
        if should_emit_event("PHONE_DETECTED", last_event_times, current_timestamp):
            events.append({
                "type": "PHONE_DETECTED",
                "severity": "High",
                "timestamp": now_iso,
                "details": "Cell phone detected in frame for >= 3s",
            })
            last_event_times["PHONE_DETECTED"] = current_timestamp

    # 2. Check SECOND_PERSON
    second_person_cond = lambda f: f.objects.count("person") > 1
    if check_anomaly_duration(recent_frames, new_frames_count, second_person_cond):
        if should_emit_event("SECOND_PERSON", last_event_times, current_timestamp):
            events.append({
                "type": "SECOND_PERSON",
                "severity": "High",
                "timestamp": now_iso,
                "details": "Multiple people detected in frame for >= 3s",
            })
            last_event_times["SECOND_PERSON"] = current_timestamp

    # 3. Check GAZE_AWAY
    gaze_cond = lambda f: abs(calculate_z_score(get_gaze_deviation(f), baseline_gaze_mean, baseline_gaze_std)) > 2.5
    if check_anomaly_duration(recent_frames, new_frames_count, gaze_cond):
        if should_emit_event("GAZE_AWAY", last_event_times, current_timestamp):
            # Calculate the current z-score to show in details
            last_dev = get_gaze_deviation(recent_frames[-1])
            gaze_z = calculate_z_score(last_dev, baseline_gaze_mean, baseline_gaze_std)
            events.append({
                "type": "GAZE_AWAY",
                "severity": "Moderate",
                "timestamp": now_iso,
                "details": f"Gaze deviation z-score {gaze_z:.2f} exceeds threshold of 2.5 for >= 3s",
            })
            last_event_times["GAZE_AWAY"] = current_timestamp

    # 4. Check VOICE_DETECTED
    voice_cond = lambda f: f.vad_speech and calculate_z_score(f.audio_level, baseline_audio_mean, baseline_audio_std) > 2.5
    if check_anomaly_duration(recent_frames, new_frames_count, voice_cond):
        if should_emit_event("VOICE_DETECTED", last_event_times, current_timestamp):
            last_audio_z = calculate_z_score(recent_frames[-1].audio_level, baseline_audio_mean, baseline_audio_std)
            events.append({
                "type": "VOICE_DETECTED",
                "severity": "Moderate",
                "timestamp": now_iso,
                "details": f"Audio level z-score {last_audio_z:.2f} exceeds threshold of 2.5 with speech active for >= 3s",
            })
            last_event_times["VOICE_DETECTED"] = current_timestamp

    # 5. Check CORROBORATED_ANOMALY (D2 Multi-modal)
    corrob_cond = lambda f: f.vad_speech and get_gaze_deviation(f) > 0.7
    if check_anomaly_duration(recent_frames, new_frames_count, corrob_cond):
        if should_emit_event("CORROBORATED_ANOMALY", last_event_times, current_timestamp):
            events.append({
                "type": "CORROBORATED_ANOMALY",
                "severity": "High",
                "timestamp": now_iso,
                "details": "Multi-modal anomaly: gaze deviation > 0.7 AND speech detected for >= 3s",
            })
            last_event_times["CORROBORATED_ANOMALY"] = current_timestamp

    return events

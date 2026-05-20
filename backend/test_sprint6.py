import json
import time
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_BASE = "http://127.0.0.1:8000/api"
SESSION_ID = f"test-sprint6-session-{int(time.time())}"

def post_request(url: str, data: dict) -> dict:
    payload = json.dumps(data).encode("utf-8")
    req = Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        sys.exit(1)
    except Exception as e:
        print(f"Connection Error: {e}")
        sys.exit(1)

def make_frame(timestamp_ms: int, gaze_zone: str = "CENTER", yaw: float = 0.0, pitch: float = 0.0,
               face_visible: bool = True, audio_level: float = 0.01, vad_speech: bool = False,
               objects: list = None) -> dict:
    return {
        "timestamp": timestamp_ms,
        "gaze_zone": gaze_zone,
        "head_pose": {"yaw": yaw, "pitch": pitch},
        "face_visible": face_visible,
        "fps": 15.0,
        "audio_level": audio_level,
        "vad_speech": vad_speech,
        "objects": objects or [],
    }

def main():
    print(f"=== Starting Sprint 6 Validation on Session: {SESSION_ID} ===")

    # 1. Establish baseline (12 batches of 10 frames = 120 frames)
    # Each batch is spaced by 1 second (100ms per frame)
    current_time_ms = int(time.time() * 1000)
    print("Accumulating baseline stats...")
    for b in range(12):
        frames = []
        for f in range(10):
            t = current_time_ms + b * 1000 + f * 100
            frames.append(make_frame(t, gaze_zone="CENTER", yaw=0.0, pitch=0.0, audio_level=0.02))
        
        sync_res = post_request(f"{API_BASE}/sync", {
            "session_id": SESSION_ID,
            "frames": frames
        })
        
        # Verify indices A, E, I are returned
        assert "attentiveness" in sync_res, "attentiveness field missing"
        assert "environment" in sync_res, "environment field missing"
        assert "integrity" in sync_res, "integrity field missing"
        
        if b == 11:
            assert sync_res["baseline"]["is_ready"] is True, "Baseline should be ready after 12 batches"
            print(f"Baseline is ready! Mean Gaze: {sync_res['baseline']['gaze_deviation']['mean']}")
            print(f"Initial indices: A={sync_res['attentiveness']}, E={sync_res['environment']}, I={sync_res['integrity']}")

    print("\n--- Testing Threshold Guard (D1: duration < 3s shouldn't persist) ---")
    # Send a short anomaly run: 2 seconds of cell phone detection (20 frames)
    # We will send 2 batches, each containing 10 frames with phone. Total = 2.0s
    current_time_ms = int(time.time() * 1000) + 15000
    for b in range(2):
        frames = []
        for f in range(10):
            t = current_time_ms + b * 1000 + f * 100
            frames.append(make_frame(t, objects=["cell phone"]))
        
        sync_res = post_request(f"{API_BASE}/sync", {
            "session_id": SESSION_ID,
            "frames": frames
        })
        # Check if events were generated (should not, since duration is < 3.0s)
        phone_events = [e for e in sync_res.get("events", []) if e["type"] == "PHONE_DETECTED"]
        assert len(phone_events) == 0, f"Phone event emitted too early! Duration was only {(b+1)*1.0}s"
    print("SUCCESS: 2s phone anomaly was suppressed correctly by duration guard.")

    print("\n--- Testing Threshold Guard (D1: duration >= 3s should persist) ---")
    # Continue sending the phone anomaly for another 2 seconds (total 4.0s)
    current_time_ms += 2000
    detected_event = None
    for b in range(2):
        frames = []
        for f in range(10):
            t = current_time_ms + b * 1000 + f * 100
            frames.append(make_frame(t, objects=["cell phone"]))
        
        sync_res = post_request(f"{API_BASE}/sync", {
            "session_id": SESSION_ID,
            "frames": frames
        })
        phone_events = [e for e in sync_res.get("events", []) if e["type"] == "PHONE_DETECTED"]
        if phone_events:
            detected_event = phone_events[0]
            print(f"Detected event: {detected_event}")
    
    assert detected_event is not None, "Phone event should have persisted after 3s!"
    print("SUCCESS: Phone event persisted successfully after crossing 3s threshold.")

    print("\n--- Testing Multi-modal Corroboration (D2: gaze > 0.7 + vad_speech) ---")
    # Send gaze deviation (yaw = 1.0, pitch = 0.0 -> deviation = 1.0 > 0.7) and vad_speech = True for 4 seconds
    current_time_ms += 3000
    corrob_event = None
    for b in range(4):
        frames = []
        for f in range(10):
            t = current_time_ms + b * 1000 + f * 100
            frames.append(make_frame(t, gaze_zone="LEFT", yaw=1.0, pitch=0.0, vad_speech=True))
        
        sync_res = post_request(f"{API_BASE}/sync", {
            "session_id": SESSION_ID,
            "frames": frames
        })
        events = [e for e in sync_res.get("events", []) if e["type"] == "CORROBORATED_ANOMALY"]
        if events:
            corrob_event = events[0]
            print(f"Detected corroborated event: {corrob_event}")

    assert corrob_event is not None, "CORROBORATED_ANOMALY event should have triggered after 3s!"
    print("SUCCESS: Multi-modal CORROBORATED_ANOMALY triggered successfully.")

    print("\n--- Testing Scoring Indices (D3 / D4 formulas) ---")
    # A should be low, E should be low because of recent speech + objects + off-gaze
    print(f"Latest metrics: A={sync_res['attentiveness']}, E={sync_res['environment']}, I={sync_res['integrity']}")
    assert sync_res["attentiveness"] < 100.0, "Attentiveness should have dropped due to off-gaze frames"
    assert sync_res["environment"] < 100.0, "Environment score should have dropped due to phone/speech"
    assert sync_res["integrity"] < 100.0, "Integrity score should have adjusted downward"
    print("SUCCESS: A, E, I formulas calculated and validated.")

    print("\n--- Testing Answer Correlation Endpoint (D5: POST /api/correlate-answer) ---")
    # We will correlate a question submitted just now, with a duration of 8 seconds.
    # This window covers the phone and corroborated events we generated!
    corr_res = post_request(f"{API_BASE}/correlate-answer", {
        "session_id": SESSION_ID,
        "question_id": "q-101",
        "difficulty": "Hard",
        "is_correct": True,
        "time_taken_s": 8
    })
    print(f"Correlation response: {json.dumps(corr_res, indent=2)}")
    assert corr_res["suspicion_level"] in ["HIGH", "MEDIUM", "LOW"], "Invalid suspicion level"
    assert len(corr_res["contributing_events"]) > 0, "No contributing events found"
    print("SUCCESS: Answer correlation endpoint works and reports suspicion details.")

    print("\n--- Testing Session End Endpoint (POST /api/session/end) ---")
    end_res = post_request(f"{API_BASE}/session/end", {
        "session_id": SESSION_ID
    })
    print(f"Session end response: {json.dumps(end_res, indent=2)}")
    assert end_res["verdict"] in ["HIGH", "MODERATE", "LOW"], "Invalid overall session verdict"
    assert end_res["integrity"] == sync_res["integrity"], "Final integrity does not match last sync"
    print("SUCCESS: Session end endpoint works and calculates final summaries.")

    print("\n=== SPRINT 6 BACKEND VALIDATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()

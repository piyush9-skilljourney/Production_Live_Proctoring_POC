import json
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

API_URL = "http://127.0.0.1:8000/api/sync"


def make_frame(index: int) -> dict:
    return {
        "timestamp": int(time.time() * 1000) + index,
        "gaze_zone": "CENTER",
        "head_pose": {"yaw": 0.0, "pitch": 0.0},
        "face_visible": True,
        "fps": 15.0,
        "audio_level": 0.01,
        "vad_speech": False,
        "objects": [],
    }


def post_session(session_index: int) -> int:
    total = 0
    session_id = f"load-session-{session_index}"

    for batch_index in range(5):
        frames = [make_frame(batch_index * 10 + frame_index) for frame_index in range(10)]
        payload = json.dumps(
            {
                "session_id": session_id,
                "frames": frames,
            }
        ).encode("utf-8")
        request = Request(
            API_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urlopen(request, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            total += data["received_count"]

    return total


def main() -> None:
    with ThreadPoolExecutor(max_workers=5) as executor:
        totals = list(executor.map(post_session, range(1, 6)))

    print(f"sessions=5 total_frames={sum(totals)} per_session={totals}")


if __name__ == "__main__":
    main()

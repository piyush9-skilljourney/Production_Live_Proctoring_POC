TARGET_FPS = 15.0


def calculate_confidence(*, avg_fps: float, visibility_ratio: float) -> float:
    fps_ratio = min(max(avg_fps / TARGET_FPS, 0.0), 1.0)
    visibility = min(max(visibility_ratio, 0.0), 1.0)
    confidence = (fps_ratio * 0.4) + (visibility * 0.6)
    return round(confidence * 100, 2)

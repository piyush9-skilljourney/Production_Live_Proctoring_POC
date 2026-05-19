import React, { useEffect, useRef, useState } from 'react';
import type {
  CalibrationMap,
  CalibrationPointId,
  CalibrationPointSample,
  CalibrationTrackingSample,
  HeadPose,
} from '../types';

const PAUSE_MS = 2000;
const SAMPLE_INTERVAL_MS = 60;
const SAMPLES_PER_POINT = 20;
const TRAVEL_MS = 900;
const TRACKING_MS = 15000;
const TRACKING_INTERVAL_MS = 100;

interface CalibrationPoint {
  id: CalibrationPointId;
  label: string;
  x: string;
  y: string;
}

const POINTS: CalibrationPoint[] = [
  { id: 'top_left', label: 'Top left', x: '5%', y: '7%' },
  { id: 'top_right', label: 'Top right', x: '95%', y: '7%' },
  { id: 'bottom_right', label: 'Bottom right', x: '95%', y: '93%' },
  { id: 'bottom_left', label: 'Bottom left', x: '5%', y: '93%' },
  { id: 'center', label: 'Center', x: '50%', y: '50%' },
];

interface Props {
  isActive: boolean;
  latestPoseRef: React.MutableRefObject<HeadPose>;
  onComplete: (calibrationMap: CalibrationMap) => void;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
};

const round = (value: number) => Math.round(value * 100) / 100;

const buildCalibrationMap = (
  pointSamples: CalibrationPointSample[],
  trackingSamples: CalibrationTrackingSample[],
): CalibrationMap => {
  const centerSample =
    pointSamples.find((sample) => sample.point === 'center') ?? pointSamples[0];
  const yawValues = pointSamples.map((sample) => sample.yaw);
  const pitchValues = pointSamples.map((sample) => sample.pitch);
  const yawRange = Math.max(...yawValues) - Math.min(...yawValues);
  const pitchRange = Math.max(...pitchValues) - Math.min(...pitchValues);

  return {
    centerYaw: round(centerSample?.yaw ?? 0),
    centerPitch: round(centerSample?.pitch ?? 0),
    yawRange: round(yawRange || 1),
    pitchRange: round(pitchRange || 1),
    sampleCount: trackingSamples.length,
    pointSamples,
    trackingSamples,
  };
};

const CalibrationOverlay: React.FC<Props> = ({
  isActive,
  latestPoseRef,
  onComplete,
}) => {
  const [pointIndex, setPointIndex] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [phase, setPhase] = useState<'moving' | 'sampling' | 'tracking'>(
    'moving',
  );
  const [trackingElapsedMs, setTrackingElapsedMs] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const collectedRef = useRef<CalibrationPointSample[]>([]);
  const trackingRef = useRef<CalibrationTrackingSample[]>([]);

  const currentPoint = POINTS[pointIndex];
  const totalSamples = POINTS.length * SAMPLES_PER_POINT;
  const completedSamples = pointIndex * SAMPLES_PER_POINT + sampleCount;
  const pointProgress = Math.min((completedSamples / totalSamples) * 100, 100);
  const trackingProgress = Math.min((trackingElapsedMs / TRACKING_MS) * 100, 100);
  const progress = phase === 'tracking' ? 50 + trackingProgress / 2 : pointProgress / 2;
  const trackingPosition = getFigureEightPosition(trackingElapsedMs);

  useEffect(() => {
    if (!isActive || isDone || !currentPoint) return;

    let pauseId = 0;
    let intervalId = 0;
    const travelId = window.setTimeout(() => {
      setPhase('sampling');
      pauseId = window.setTimeout(() => {
        intervalId = window.setInterval(() => {
          const pose = latestPoseRef.current;
          collectedRef.current.push({
            point: currentPoint.id,
            yaw: pose.yaw,
            pitch: pose.pitch,
          });

          setSampleCount((count) => {
            const nextCount = count + 1;

            if (nextCount >= SAMPLES_PER_POINT) {
              window.clearInterval(intervalId);
              setPointIndex((index) => {
                const nextIndex = index + 1;

                if (nextIndex >= POINTS.length) {
                  setPhase('tracking');
                  return index;
                }

                setSampleCount(0);
                setPhase('moving');
                return nextIndex;
              });
            }

            return Math.min(nextCount, SAMPLES_PER_POINT);
          });
        }, SAMPLE_INTERVAL_MS);
      }, PAUSE_MS);
    }, TRAVEL_MS);

    return () => {
      window.clearTimeout(travelId);
      window.clearTimeout(pauseId);
      window.clearInterval(intervalId);
    };
  }, [currentPoint, isActive, isDone, latestPoseRef]);

  useEffect(() => {
    if (!isActive || isDone || phase !== 'tracking') return;

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const clampedElapsed = Math.min(elapsed, TRACKING_MS);
      const position = getFigureEightPosition(clampedElapsed);
      const pose = latestPoseRef.current;

      setTrackingElapsedMs(clampedElapsed);
      trackingRef.current.push({
        timestamp: Date.now(),
        targetX: position.x,
        targetY: position.y,
        yaw: pose.yaw,
        pitch: pose.pitch,
      });

      if (elapsed >= TRACKING_MS) {
        window.clearInterval(intervalId);
        const pointSamples = POINTS.map((point) => {
          const samples = collectedRef.current.filter(
            (sample) => sample.point === point.id,
          );

          return {
            point: point.id,
            yaw: round(median(samples.map((sample) => sample.yaw))),
            pitch: round(median(samples.map((sample) => sample.pitch))),
          };
        });

        setIsDone(true);
        onComplete(buildCalibrationMap(pointSamples, trackingRef.current));
      }
    }, TRACKING_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isActive, isDone, latestPoseRef, onComplete, phase]);

  if (!isActive || isDone || !currentPoint) return null;

  return (
    <div style={styles.overlay}>
      <div
        style={{
          ...styles.ball,
          left: phase === 'tracking' ? `${trackingPosition.x}%` : currentPoint.x,
          top: phase === 'tracking' ? `${trackingPosition.y}%` : currentPoint.y,
          transition:
            phase === 'tracking'
              ? 'left 100ms linear, top 100ms linear'
              : styles.ball.transition,
        }}
      />
      <div style={styles.hud}>
        <div style={styles.title}>Calibration</div>
        <div style={styles.copy}>
          {phase === 'tracking'
            ? 'Follow the figure-8 path smoothly'
            : phase === 'moving'
              ? `Follow the dot to ${currentPoint.label}`
              : `Hold your gaze on ${currentPoint.label}`}
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <div style={styles.meta}>
          {phase === 'tracking'
            ? `Tracking ${(TRACKING_MS - trackingElapsedMs) / 1000}s`
            : `Point ${pointIndex + 1}/${POINTS.length} · ${phase} · Samples ${sampleCount}/${SAMPLES_PER_POINT}`}
        </div>
      </div>
    </div>
  );
};

const getFigureEightPosition = (elapsedMs: number) => {
  const progress = elapsedMs / TRACKING_MS;
  const radians = progress * Math.PI * 2 * 2;

  return {
    x: 50 + Math.sin(radians) * 34,
    y: 50 + Math.sin(radians * 2) * 22,
  };
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    pointerEvents: 'auto',
    background: '#0f172a',
  } as React.CSSProperties,

  ball: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: '50%',
    background: '#22c55e',
    border: '3px solid #ffffff',
    boxShadow:
      '0 0 0 12px rgba(34, 197, 94, 0.16), 0 14px 36px rgba(15, 23, 42, 0.5)',
    transition:
      'left 900ms cubic-bezier(0.22, 1, 0.36, 1), top 900ms cubic-bezier(0.22, 1, 0.36, 1)',
  } as React.CSSProperties,

  hud: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 'min(420px, calc(100vw - 32px))',
    transform: 'translate(-50%, -50%)',
    padding: '12px 14px',
    background: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    border: '1px solid rgba(226, 232, 240, 0.9)',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  title: {
    fontSize: 11,
    fontWeight: 800,
    color: '#0f172a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
  } as React.CSSProperties,

  copy: {
    marginTop: 4,
    fontSize: 13,
    color: '#334155',
    fontWeight: 600,
  } as React.CSSProperties,

  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    background: '#e2e8f0',
    overflow: 'hidden',
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: '#22c55e',
    transition: 'width 120ms linear',
  } as React.CSSProperties,

  meta: {
    marginTop: 8,
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  } as React.CSSProperties,
};

export default CalibrationOverlay;

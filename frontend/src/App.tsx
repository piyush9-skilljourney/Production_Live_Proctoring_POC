import React, { useCallback, useEffect, useRef, useState } from 'react';

import { isBrowserSupported, useCamera } from './hooks/useCamera';
import { useAudio } from './hooks/useAudio';
import { useFrameBuffer } from './hooks/useFrameBuffer';
import { useInference } from './hooks/useInference';
import { useSyncLoop } from './hooks/useSyncLoop';

import AudioBar from './components/AudioBar';
import CalibrationOverlay from './components/CalibrationOverlay';
import CameraPermission from './components/CameraPermission';
import SignalQualityBadge from './components/SignalQualityBadge';
import LiveEventLog from './components/LiveEventLog';
import type { CalibrationMap, FaceLandmark, GazeZone } from './types';

const SESSION_ID_STORAGE_KEY = 'pie_session_id';
const PROCTORING_TOKEN_STORAGE_KEY = 'pie_proctoring_token';

const ZONE_COLORS: Record<GazeZone, string> = {
  CENTER: '#d1fae5',
  LEFT: '#fef3c7',
  RIGHT: '#fef3c7',
  UP: '#fef3c7',
  DOWN: '#fef3c7',
  MISSING: '#fee2e2',
};

const ZONE_TEXT: Record<GazeZone, string> = {
  CENTER: '#065f46',
  LEFT: '#92400e',
  RIGHT: '#92400e',
  UP: '#92400e',
  DOWN: '#92400e',
  MISSING: '#991b1b',
};

const searchParams = new URLSearchParams(window.location.search);
const storedSessionId = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
const storedToken = window.localStorage.getItem(PROCTORING_TOKEN_STORAGE_KEY);
const SESSION_ID =
  searchParams.get('session_id') ??
  storedSessionId ??
  `session-${crypto.randomUUID()}`;
const PROCTORING_TOKEN = searchParams.get('token') ?? storedToken;
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
const IS_DEV_MODE = searchParams.get('dev') === '1';

window.localStorage.setItem(SESSION_ID_STORAGE_KEY, SESSION_ID);
if (PROCTORING_TOKEN) {
  window.localStorage.setItem(PROCTORING_TOKEN_STORAGE_KEY, PROCTORING_TOKEN);
} else {
  window.localStorage.removeItem(PROCTORING_TOKEN_STORAGE_KEY);
}

const DEV_CALIBRATION_MAP: CalibrationMap = {
  centerYaw: 0,
  centerPitch: 0,
  yawRange: 100,
  pitchRange: 80,
  sampleCount: 20,
  pointSamples: [],
  trackingSamples: [],
};
const CENTERING_YAW_LIMIT = 15;
const CENTERING_PITCH_LIMIT = 12;

function App() {
  const [isActive, setIsActive] = useState(false);
  const [isInstructionAccepted, setIsInstructionAccepted] = useState(false);
  const [isFullscreenReady, setIsFullscreenReady] = useState(false);
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const [calibrationAttempt, setCalibrationAttempt] = useState(0);
  const [calibrationMap, setCalibrationMap] = useState<CalibrationMap | null>(
    null,
  );
  const shouldShowInstructions = isActive && !isInstructionAccepted;
  const shouldShowFullscreenGate =
    isActive && isInstructionAccepted && !isFullscreenReady;
  const shouldShowCenteringGate =
    isActive &&
    isInstructionAccepted &&
    isFullscreenReady &&
    calibrationMap === null &&
    !isFaceCentered;
  const isCalibrating =
    isActive &&
    isInstructionAccepted &&
    isFullscreenReady &&
    isFaceCentered &&
    calibrationMap === null;
  const isProctoringActive = isActive && calibrationMap !== null;

  const { permission, micPermission, mediaStream, videoRef, requestAccess } =
    useCamera();
  const { gazeData, fps, landmarks, objects, latestPoseRef } = useInference(
    videoRef,
    isActive,
    calibrationMap,
    isProctoringActive,
  );
  const isFaceReady =
    landmarks.length >= 468 &&
    Math.abs(gazeData.pose.yaw) <= CENTERING_YAW_LIMIT &&
    Math.abs(gazeData.pose.pitch) <= CENTERING_PITCH_LIMIT;
  const { audioData } = useAudio(isProctoringActive, mediaStream);
  const { frameBufferRef, bufferSize, collectedCount, maxBufferSize } =
    useFrameBuffer(isProctoringActive, {
      gazeData,
      fps,
      audioData,
      objects,
    });
  const {
    lastSyncCount,
    totalSynced,
    syncStatus,
    lastError,
    confidence,
    retryCount,
    events,
  } =
    useSyncLoop(isProctoringActive, SESSION_ID, frameBufferRef);

  const handleGranted = async () => {
    await requestAccess();
    setIsActive(true);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenReady(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleCalibrationComplete = useCallback(async (map: CalibrationMap) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/calibrate?session_id=${SESSION_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(map),
        }
      ).then((r) => r.json());

      if (res.valid) {
        setCalibrationMap(map); // use for gaze offset
      } else {
        // Reset and force retry
        setIsFaceCentered(false);
        setCalibrationAttempt((a) => a + 1);
        alert(`Calibration failed: ${res.reason}\n\nPlease try again.`);
      }
    } catch (err) {
      console.error('[Calibration] request failed:', err);
      setIsFaceCentered(false);
      setCalibrationAttempt((a) => a + 1);
      alert('Network error during calibration. Please try again.');
    }
  }, []);

  const handleEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreenReady(true);
    } catch (err: unknown) {
      console.error('[Fullscreen] request failed:', err);
      setIsFullscreenReady(true);
    }
  };

  const handleSkipCalibration = () => {
    setIsInstructionAccepted(true);
    setIsFullscreenReady(true);
    setCalibrationMap(DEV_CALIBRATION_MAP);
  };

  if (!isBrowserSupported() || permission !== 'granted') {
    return (
      <CameraPermission
        permission={permission}
        micPermission={micPermission}
        onRequest={handleGranted}
      />
    );
  }

  return (
    <div style={styles.page}>
      {shouldShowInstructions && (
        <InstructionGate
          isDevMode={IS_DEV_MODE}
          onContinue={() => setIsInstructionAccepted(true)}
          onSkip={handleSkipCalibration}
        />
      )}
      {shouldShowFullscreenGate && (
        <FullscreenGate onStart={handleEnterFullscreen} />
      )}
      {shouldShowCenteringGate && (
        <FaceCenteringGate isReady={isFaceReady} onStart={() => setIsFaceCentered(true)} />
      )}
      <CalibrationOverlay
        key={calibrationAttempt}
        isActive={isCalibrating}
        latestPoseRef={latestPoseRef}
        onComplete={handleCalibrationComplete}
      />
      <nav style={styles.nav}>
        <div style={styles.navBrand}>
          <div style={styles.navIcon}>PIE</div>
          <div>
            <div style={styles.navTitle}>PIE v2</div>
            <div style={styles.navSub}>Sprint 1 - Capture Layer</div>
          </div>
        </div>
        <div style={styles.fpsChip}>
          {fps} FPS {fps >= 15 ? 'ok' : 'low'}
        </div>
      </nav>

      <main style={styles.main}>
        <div style={styles.videoCard}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={styles.video}
          />
          <LandmarkOverlay landmarks={landmarks} />

          <div
            style={{
              ...styles.gazeBadge,
              background: ZONE_COLORS[gazeData.zone],
              color: ZONE_TEXT[gazeData.zone],
            }}
          >
            {gazeData.zone}
          </div>

          <div style={styles.fpsBadge}>{fps} fps</div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Live Signals</div>

          <div style={styles.row}>
            <span style={styles.rowLabel}>Calibrated Yaw</span>
            <span style={styles.rowValue}>
              {gazeData.pose.yaw.toFixed(1)} deg
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Calibrated Pitch</span>
            <span style={styles.rowValue}>
              {gazeData.pose.pitch.toFixed(1)} deg
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Zone</span>
            <span
              style={{
                ...styles.rowValue,
                color: ZONE_TEXT[gazeData.zone],
              }}
            >
              {gazeData.zone}
            </span>
          </div>

          <div style={styles.divider} />

          <AudioBar level={audioData.level} isSpeaking={audioData.isSpeaking} />

          <div style={styles.divider} />

          <SignalQualityBadge confidence={confidence} />

          <div style={styles.divider} />

          <div style={styles.statusRow}>
            <StatusDot label="Camera" ok={permission === 'granted'} />
            <StatusDot label="Microphone" ok={micPermission === 'granted'} />
            <StatusDot label="FaceMesh" ok={fps > 0} />
            <StatusDot label="Landmarks" ok={landmarks.length >= 468} />
          </div>

          <div style={styles.divider} />

          <div style={styles.row}>
            <span style={styles.rowLabel}>Calibration</span>
            <span style={styles.rowValue}>
              {calibrationMap === null ? 'RUNNING' : 'DONE'}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Point Samples</span>
            <span style={styles.rowValue}>
              {calibrationMap === null
                ? '--'
                : `${calibrationMap.pointSamples.length} medians`}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Tracking</span>
            <span style={styles.rowValue}>
              {calibrationMap === null
                ? '--'
                : `${calibrationMap.trackingSamples.length} samples`}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Center</span>
            <span style={styles.rowValue}>
              {calibrationMap === null
                ? '--'
                : `${calibrationMap.centerYaw}/${calibrationMap.centerPitch}`}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Range</span>
            <span style={styles.rowValue}>
              {calibrationMap === null
                ? '--'
                : `${calibrationMap.yawRange}/${calibrationMap.pitchRange}`}
            </span>
          </div>

          <div style={styles.divider} />

          <div style={styles.row}>
            <span style={styles.rowLabel}>Frame Buffer</span>
            <span style={styles.rowValue}>
              {bufferSize}/{maxBufferSize}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Collected</span>
            <span style={styles.rowValue}>{collectedCount}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Last Sync</span>
            <span style={styles.rowValue}>{lastSyncCount}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Total Synced</span>
            <span style={styles.rowValue}>{totalSynced}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Confidence</span>
            <span style={styles.rowValue}>
              {confidence === null ? '--' : `${confidence.toFixed(1)}%`}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Sync Status</span>
            <span
              style={{
                ...styles.rowValue,
                color: syncStatus === 'error' ? '#dc2626' : '#065f46',
              }}
              title={lastError ?? undefined}
            >
              {syncStatus.toUpperCase()}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Reconnects</span>
            <span style={styles.rowValue}>{retryCount}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Session</span>
            <span style={{ ...styles.rowValue, fontSize: 10 }}>
              {SESSION_ID.slice(0, 18)}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.rowLabel}>Token</span>
            <span style={{ ...styles.rowValue, fontSize: 10 }}>
              {PROCTORING_TOKEN ? 'present' : 'dev generated'}
            </span>
          </div>

          <LiveEventLog events={events} />
        </div>
      </main>
    </div>
  );
}

const LandmarkOverlay = ({ landmarks }: { landmarks: FaceLandmark[] }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (landmarks.length === 0) return;

    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    for (const point of landmarks) {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks]);

  return <canvas ref={canvasRef} style={styles.canvas} aria-hidden="true" />;
};

const StatusDot = ({ label, ok }: { label: string; ok: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: ok ? '#10b981' : '#e2e8f0',
      }}
    />
    <span style={{ fontSize: 12, color: ok ? '#065f46' : '#94a3b8' }}>
      {label}
    </span>
  </div>
);

const InstructionGate = ({
  isDevMode,
  onContinue,
  onSkip,
}: {
  isDevMode: boolean;
  onContinue: () => void;
  onSkip: () => void;
}) => (
  <div style={styles.fullscreenGate}>
    <div style={styles.fullscreenPanel}>
      <div style={styles.fullscreenTitle}>Prepare for Calibration</div>
      <div style={styles.fullscreenCopy}>
        Sit comfortably, keep your face visible, and follow the dot with your
        eyes. The next step will switch to full screen so PIE can learn your
        screen boundaries.
      </div>
      <button type="button" style={styles.fullscreenButton} onClick={onContinue}>
        Continue
      </button>
      {isDevMode && (
        <button type="button" style={styles.skipButton} onClick={onSkip}>
          Skip Calibration
        </button>
      )}
    </div>
  </div>
);

const FullscreenGate = ({ onStart }: { onStart: () => void }) => (
  <div style={styles.fullscreenGate}>
    <div style={styles.fullscreenPanel}>
      <div style={styles.fullscreenTitle}>Enter Full Screen</div>
      <div style={styles.fullscreenCopy}>
        Calibration uses the corners of your exam screen. Please enter full
        screen before following the calibration dot.
      </div>
      <button type="button" style={styles.fullscreenButton} onClick={onStart}>
        Start Calibration
      </button>
    </div>
  </div>
);

const FaceCenteringGate = ({
  isReady,
  onStart,
}: {
  isReady: boolean;
  onStart: () => void;
}) => (
  <div style={styles.fullscreenGate}>
    <div style={styles.fullscreenPanel}>
      <div style={styles.fullscreenTitle}>Center Your Face</div>
      <div style={styles.fullscreenCopy}>
        Sit straight, keep your face visible, and look at the center of the
        screen. Calibration will start once your face is centered.
      </div>
      <div
        style={{
          ...styles.centerStatus,
          color: isReady ? '#065f46' : '#92400e',
          background: isReady ? '#d1fae5' : '#fef3c7',
        }}
      >
        {isReady ? 'Face centered' : 'Waiting for centered face'}
      </div>
      <button
        type="button"
        style={{
          ...styles.fullscreenButton,
          opacity: isReady ? 1 : 0.45,
          cursor: isReady ? 'pointer' : 'not-allowed',
        }}
        onClick={onStart}
        disabled={!isReady}
      >
        Start Gaze Calibration
      </button>
    </div>
  </div>
);

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,

  fullscreenGate: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'grid',
    placeItems: 'center',
    background: '#0f172a',
    padding: 24,
  } as React.CSSProperties,

  fullscreenPanel: {
    width: 'min(420px, 100%)',
    background: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    padding: 24,
    textAlign: 'center' as const,
  } as React.CSSProperties,

  fullscreenTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  } as React.CSSProperties,

  fullscreenCopy: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.5,
    color: '#475569',
  } as React.CSSProperties,

  fullscreenButton: {
    marginTop: 18,
    width: '100%',
    border: 0,
    borderRadius: 8,
    padding: '12px 16px',
    background: '#0f172a',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  } as React.CSSProperties,

  skipButton: {
    marginTop: 10,
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '12px 16px',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 800,
    cursor: 'pointer',
  } as React.CSSProperties,

  centerStatus: {
    marginTop: 16,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  } as React.CSSProperties,

  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    background: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
  } as React.CSSProperties,

  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  navIcon: {
    width: 40,
    height: 40,
    background: '#ede9fe',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    color: '#4f46e5',
  } as React.CSSProperties,

  navTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
  } as React.CSSProperties,

  navSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  } as React.CSSProperties,

  fpsChip: {
    fontSize: 12,
    fontFamily: 'monospace',
    background: '#f1f5f9',
    borderRadius: 8,
    padding: '4px 12px',
    color: '#475569',
  } as React.CSSProperties,

  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: 32,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: 24,
    alignItems: 'start',
  } as React.CSSProperties,

  videoCard: {
    background: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    aspectRatio: '4/3',
  } as React.CSSProperties,

  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  } as React.CSSProperties,

  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  } as React.CSSProperties,

  gazeBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
  } as React.CSSProperties,

  fpsBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
    padding: '4px 10px',
    borderRadius: 6,
  } as React.CSSProperties,

  panel: {
    background: '#fff',
    borderRadius: 20,
    padding: 24,
    border: '1px solid #f1f5f9',
  } as React.CSSProperties,

  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    marginBottom: 16,
  } as React.CSSProperties,

  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  } as React.CSSProperties,

  rowLabel: {
    fontSize: 13,
    color: '#64748b',
  } as React.CSSProperties,

  rowValue: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#0f172a',
  } as React.CSSProperties,

  divider: {
    borderTop: '1px solid #f1f5f9',
    margin: '16px 0',
  } as React.CSSProperties,

  statusRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,
};

export default App;

import React from 'react';
import type { PermissionState } from '../types';

interface Props {
  permission: PermissionState;
  micPermission: PermissionState;
  onRequest: () => void;
}

const CameraPermission: React.FC<Props> = ({
  permission,
  micPermission,
  onRequest,
}) => {
  if (typeof window !== 'undefined' && !isSupported()) {
    return (
      <Screen
        tone="warning"
        title="Unsupported Browser"
        body="PIE v2 requires Google Chrome or Microsoft Edge for AI-powered proctoring. Please reopen this page in a supported browser."
      />
    );
  }

  if (permission === 'denied') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconBox('#fee2e2')}>!</div>
          <h2 style={styles.title}>Camera or Microphone Blocked</h2>
          <p style={styles.body}>
            PIE v2 requires camera and microphone access to conduct a proctored
            assessment. Please allow access in your browser settings and reload
            the page.
          </p>
          <div style={styles.stepBox}>
            <p style={styles.stepText}>
              Chrome or Edge: click the lock icon in the address bar, allow
              camera and microphone, then reload.
            </p>
          </div>
          <button style={styles.button} onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (permission === 'requesting') {
    return (
      <Screen
        tone="neutral"
        title="Requesting Access"
        body="Please allow camera and microphone access when prompted by your browser."
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconBox('#ede9fe')}>PIE</div>
        <h2 style={styles.title}>PIE v2 - Proctoring Intelligence Engine</h2>
        <p style={styles.body}>
          This assessment is AI-proctored. We need access to your camera and
          microphone to monitor your environment during the test.
        </p>

        <div style={styles.permissionRow}>
          <PermissionBadge label="Camera" state={permission} />
          <PermissionBadge label="Microphone" state={micPermission} />
        </div>

        <button style={styles.button} onClick={onRequest}>
          Grant Access and Continue
        </button>

        <p style={styles.footer}>
          No video is recorded or stored. Only behavioral signals are used in
          this proof of concept.
        </p>
      </div>
    </div>
  );
};

const Screen = ({
  tone,
  title,
  body,
}: {
  tone: 'neutral' | 'warning';
  title: string;
  body: string;
}) => (
  <div style={styles.container}>
    <div style={styles.card}>
      <div style={styles.iconBox(tone === 'warning' ? '#fef3c7' : '#ede9fe')}>
        {tone === 'warning' ? '!' : 'PIE'}
      </div>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.body}>{body}</p>
    </div>
  </div>
);

const PermissionBadge = ({
  label,
  state,
}: {
  label: string;
  state: PermissionState;
}) => {
  const color =
    state === 'granted'
      ? '#d1fae5'
      : state === 'denied'
        ? '#fee2e2'
        : '#f3f4f6';
  const textColor =
    state === 'granted'
      ? '#065f46'
      : state === 'denied'
        ? '#991b1b'
        : '#6b7280';
  const icon = state === 'granted' ? 'OK' : state === 'denied' ? 'NO' : 'WAIT';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: color,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        color: textColor,
      }}
    >
      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{icon}</span>
      {label}
    </div>
  );
};

function isSupported() {
  const ua = navigator.userAgent;
  return (
    (/Chrome/.test(ua) && /Google Inc/.test(navigator.vendor)) ||
    /Edg\//.test(ua)
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: 24,
  } as React.CSSProperties,

  card: {
    background: '#ffffff',
    borderRadius: 16,
    padding: '48px 40px',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    border: '1px solid #f1f5f9',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
  } as React.CSSProperties,

  iconBox: (bg: string): React.CSSProperties => ({
    width: 72,
    height: 72,
    background: bg,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: 800,
  }),

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 12px',
  } as React.CSSProperties,

  body: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 1.7,
    margin: '0 0 24px',
  } as React.CSSProperties,

  permissionRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  } as React.CSSProperties,

  stepBox: {
    background: '#f8fafc',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 24,
    textAlign: 'left',
  } as React.CSSProperties,

  stepText: {
    fontSize: 13,
    color: '#475569',
    margin: 0,
    lineHeight: 1.6,
  } as React.CSSProperties,

  button: {
    width: '100%',
    background: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '14px 24px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 16,
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  footer: {
    fontSize: 12,
    color: '#94a3b8',
    margin: 0,
  } as React.CSSProperties,
};

export default CameraPermission;

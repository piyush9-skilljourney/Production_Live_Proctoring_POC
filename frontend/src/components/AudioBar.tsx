import React from 'react';

interface Props {
  level: number;
  isSpeaking: boolean;
}

const AudioBar: React.FC<Props> = ({ level, isSpeaking }) => {
  const pct = Math.min(100, Math.round(level * 400));

  return (
    <div style={styles.wrapper}>
      <div style={styles.label}>
        <span style={styles.labelText}>Microphone</span>
        <span
          style={{
            ...styles.badge,
            background: isSpeaking ? '#d1fae5' : '#f1f5f9',
            color: isSpeaking ? '#065f46' : '#94a3b8',
          }}
        >
          {isSpeaking ? 'VOICE DETECTED' : 'SILENT'}
        </span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${pct}%`,
            background: isSpeaking ? '#10b981' : '#6366f1',
          }}
        />
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #f1f5f9',
  } as React.CSSProperties,

  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  } as React.CSSProperties,

  labelText: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  } as React.CSSProperties,

  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: '0.08em',
  } as React.CSSProperties,

  track: {
    width: '100%',
    height: 6,
    background: '#e2e8f0',
    borderRadius: 99,
    overflow: 'hidden',
  } as React.CSSProperties,

  fill: {
    height: '100%',
    borderRadius: 99,
    transition: 'width 0.1s ease',
  } as React.CSSProperties,
};

export default AudioBar;

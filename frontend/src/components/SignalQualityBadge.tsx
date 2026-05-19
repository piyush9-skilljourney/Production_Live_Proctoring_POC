import React from 'react';

interface Props {
  confidence: number | null;
}

const getQuality = (confidence: number | null) => {
  if (confidence === null) {
    return {
      label: 'Waiting',
      background: '#f1f5f9',
      color: '#64748b',
    };
  }

  if (confidence >= 80) {
    return {
      label: 'Good',
      background: '#d1fae5',
      color: '#065f46',
    };
  }

  if (confidence >= 50) {
    return {
      label: 'Fair',
      background: '#fef3c7',
      color: '#92400e',
    };
  }

  return {
    label: 'Poor',
    background: '#fee2e2',
    color: '#991b1b',
  };
};

const SignalQualityBadge: React.FC<Props> = ({ confidence }) => {
  const quality = getQuality(confidence);

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>Signal Quality</span>
      <span
        style={{
          ...styles.badge,
          background: quality.background,
          color: quality.color,
        }}
      >
        {quality.label}
      </span>
    </div>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #f1f5f9',
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  } as React.CSSProperties,

  badge: {
    fontSize: 11,
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: 6,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
};

export default SignalQualityBadge;

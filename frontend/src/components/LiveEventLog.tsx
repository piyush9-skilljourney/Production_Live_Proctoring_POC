import React from 'react';
import type { PIEEvent } from '../types';

interface Props {
  events: PIEEvent[];
}

const LiveEventLog: React.FC<Props> = ({ events }) => {
  if (events.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Recent Events</div>
      <div style={styles.list}>
        {events.map((event, i) => (
          <div
            key={`${event.timestamp}-${i}`}
            style={{
              ...styles.eventItem,
              borderLeftColor:
                event.severity === 'High' || event.severity === 'Critical'
                  ? '#ef4444'
                  : event.severity === 'Moderate'
                  ? '#f59e0b'
                  : '#3b82f6',
            }}
          >
            <div style={styles.header}>
              <span style={styles.type}>{event.type.replace(/_/g, ' ')}</span>
              <span style={styles.time}>
                {new Date(event.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
            <div style={styles.details}>{event.details}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    marginTop: 20,
    background: '#fff',
    borderRadius: 16,
    padding: 16,
    border: '1px solid #f1f5f9',
  } as React.CSSProperties,
  title: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    marginBottom: 12,
  } as React.CSSProperties,
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,
  eventItem: {
    background: '#f8fafc',
    padding: '8px 12px',
    borderRadius: 6,
    borderLeft: '4px solid #3b82f6',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  } as React.CSSProperties,
  type: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
  } as React.CSSProperties,
  time: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  details: {
    fontSize: 11,
    color: '#475569',
  } as React.CSSProperties,
};

export default LiveEventLog;

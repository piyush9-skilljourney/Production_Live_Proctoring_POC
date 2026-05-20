import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { PIEEvent } from '../types';

interface TimelineDataPoint {
  time: string;
  integrity: number;
  attentiveness: number;
  environment: number;
}

interface RecruiterDashboardProps {
  sessionId: string;
  attentiveness: number;
  environment: number;
  integrity: number;
  events: PIEEvent[];
  timelineData: TimelineDataPoint[];
  confidence: number | null;
}

interface CorrelationResult {
  suspicion_level: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  contributing_events: PIEEvent[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export default function RecruiterDashboard({
  sessionId,
  attentiveness,
  environment,
  integrity,
  events,
  timelineData,
  confidence,
}: RecruiterDashboardProps) {
  // Simulator State
  const [questionId, setQuestionId] = useState('q-101');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Hard');
  const [isCorrect, setIsCorrect] = useState(true);
  const [timeTaken, setTimeTaken] = useState(8);
  const [loading, setLoading] = useState(false);
  const [corrResult, setCorrResult] = useState<CorrelationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulateCorrelation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/correlate-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: questionId,
          difficulty,
          is_correct: isCorrect,
          time_taken_s: timeTaken,
        }),
      });

      if (!res.ok) {
        throw new Error(`Correlation failed with code ${res.status}`);
      }

      const data = (await res.json()) as CorrelationResult;
      setCorrResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getSuspicionColor = (level: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (level) {
      case 'HIGH':
        return '#ef4444';
      case 'MEDIUM':
        return '#f97316';
      case 'LOW':
        return '#10b981';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>Hyrai Proctoring Intelligence Engine (PIE)</h2>
          <p style={styles.subtitle}>Session: {sessionId} (Active Monitoring)</p>
        </div>
        <div style={styles.sessionStatus}>
          <span style={styles.statusBadge}>
            <span style={styles.pulseDot} />
            Live Feed
          </span>
          {confidence !== null && (
            <span style={styles.confidenceBadge}>
              Quality: {confidence.toFixed(0)}%
            </span>
          )}
        </div>
      </header>

      {/* Live Gauges Row */}
      <section style={styles.gaugesRow}>
        <Gauge
          value={integrity}
          label="Integrity Index"
          description="Composite index representing overall exam credibility."
          color={integrity >= 80 ? '#10b981' : integrity >= 50 ? '#f97316' : '#ef4444'}
        />
        <Gauge
          value={attentiveness}
          label="Attentiveness"
          description="Visual focus ratio based on gaze and head pose."
          color={attentiveness >= 80 ? '#6366f1' : attentiveness >= 50 ? '#eab308' : '#ef4444'}
        />
        <Gauge
          value={environment}
          label="Environment"
          description="Integrity of audio and vision surroundings."
          color={environment >= 80 ? '#06b6d4' : environment >= 50 ? '#a855f7' : '#ef4444'}
        />
      </section>

      {/* Real-time Timeline Section */}
      <section style={styles.chartSection}>
        <h3 style={styles.sectionTitle}>Real-time Indices History</h3>
        <div style={styles.chartContainer}>
          {timelineData.length === 0 ? (
            <div style={styles.noData}>Waiting for telemetry updates...</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Line
                  type="monotone"
                  dataKey="integrity"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  name="Integrity"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="attentiveness"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  name="Attentiveness"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="environment"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  name="Environment"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Grid: Events and Answer Correlation Tool */}
      <div style={styles.grid}>
        {/* Event Logs Card */}
        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>Persistent Anomalies ({events.length})</h3>
          <div style={styles.eventsList}>
            {events.length === 0 ? (
              <div style={styles.emptyEvents}>No verified anomalies detected.</div>
            ) : (
              [...events].reverse().map((e, index) => (
                <div key={index} style={styles.eventItem}>
                  <div style={styles.eventHeader}>
                    <span
                      style={{
                        ...styles.eventBadge,
                        background:
                          e.severity === 'Critical' || e.severity === 'High'
                            ? '#fee2e2'
                            : '#fef3c7',
                        color:
                          e.severity === 'Critical' || e.severity === 'High'
                            ? '#991b1b'
                            : '#92400e',
                      }}
                    >
                      {e.type}
                    </span>
                    <span style={styles.eventTime}>
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={styles.eventDesc}>{e.details}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Answer Correlation Tool Card */}
        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>Behavior-Answer Correlation Tool</h3>
          <form onSubmit={handleSimulateCorrelation} style={styles.form}>
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Question ID</label>
                <input
                  type="text"
                  value={questionId}
                  onChange={(e) => setQuestionId(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')
                  }
                  style={styles.select}
                >
                  <option value="Easy">Easy (1.0x)</option>
                  <option value="Medium">Medium (1.2x)</option>
                  <option value="Hard">Hard (1.5x)</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Result</label>
                <select
                  value={isCorrect ? 'true' : 'false'}
                  onChange={(e) => setIsCorrect(e.target.value === 'true')}
                  style={styles.select}
                >
                  <option value="true">Correct (1.5x mult)</option>
                  <option value="false">Incorrect (1.0x mult)</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Answering Window (sec)</label>
                <input
                  type="number"
                  value={timeTaken}
                  onChange={(e) => setTimeTaken(Number(e.target.value))}
                  style={styles.input}
                  min={1}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Correlating...' : 'Analyze Suspicion & Correlate'}
            </button>
          </form>

          {error && <div style={styles.errorText}>Error: {error}</div>}

          {corrResult && (
            <div style={styles.resultBox}>
              <div style={styles.resultHeader}>
                <span style={styles.resultLabel}>Suspicion Verdict:</span>
                <span
                  style={{
                    ...styles.resultValue,
                    color: getSuspicionColor(corrResult.suspicion_level),
                  }}
                >
                  {corrResult.suspicion_level}
                </span>
              </div>
              <p style={styles.resultReason}>{corrResult.reason}</p>
              {corrResult.contributing_events.length > 0 && (
                <div style={styles.contribBox}>
                  <p style={styles.contribTitle}>Contributing Events:</p>
                  <ul style={styles.contribList}>
                    {corrResult.contributing_events.map((e, index) => (
                      <li key={index} style={styles.contribItem}>
                        <strong>{e.type}</strong> ({e.severity}): {e.details}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Custom SVG Gauge Component
function Gauge({
  value,
  label,
  description,
  color,
}: {
  value: number;
  label: string;
  description: string;
  color: string;
}) {
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div style={styles.gaugeCard}>
      <div style={styles.gaugeGraphic}>
        <svg height={radius * 2} width={radius * 2} style={styles.gaugeSvg}>
          <circle
            stroke="#f1f5f9"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <span style={{ ...styles.gaugeValue, color }}>{value.toFixed(0)}</span>
      </div>
      <div style={styles.gaugeText}>
        <h4 style={styles.gaugeLabel}>{label}</h4>
        <p style={styles.gaugeDesc}>{description}</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 24,
    maxWidth: 1200,
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 16,
  } as React.CSSProperties,

  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 13,
    color: '#64748b',
    margin: '4px 0 0 0',
  } as React.CSSProperties,

  sessionStatus: {
    display: 'flex',
    gap: 12,
  } as React.CSSProperties,

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#d1fae5',
    color: '#065f46',
    padding: '6px 12px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,

  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#10b981',
    animation: 'pulse 1.5s infinite',
  } as React.CSSProperties,

  confidenceBadge: {
    background: '#f1f5f9',
    color: '#475569',
    padding: '6px 12px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,

  gaugesRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    marginBottom: 24,
  } as React.CSSProperties,

  gaugeCard: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 20,
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as React.CSSProperties,

  gaugeGraphic: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  gaugeSvg: {
    transform: 'rotate(-90deg)',
  } as React.CSSProperties,

  gaugeValue: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: 800,
  } as React.CSSProperties,

  gaugeText: {
    flex: 1,
  } as React.CSSProperties,

  gaugeLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  } as React.CSSProperties,

  gaugeDesc: {
    fontSize: 12,
    color: '#64748b',
    margin: '4px 0 0 0',
    lineHeight: 1.4,
  } as React.CSSProperties,

  chartSection: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 20,
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
    marginBottom: 24,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 16px 0',
  } as React.CSSProperties,

  chartContainer: {
    width: '100%',
    height: 280,
  } as React.CSSProperties,

  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8',
    fontSize: 14,
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: 24,
  } as React.CSSProperties,

  card: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 24,
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
    minHeight: 320,
  } as React.CSSProperties,

  eventsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    maxHeight: 280,
    overflowY: 'auto' as const,
    paddingRight: 6,
  } as React.CSSProperties,

  emptyEvents: {
    textAlign: 'center' as const,
    color: '#94a3b8',
    fontSize: 13,
    paddingTop: 40,
  } as React.CSSProperties,

  eventItem: {
    padding: 12,
    borderRadius: 8,
    border: '1px solid #f1f5f9',
    background: '#f8fafc',
  } as React.CSSProperties,

  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  } as React.CSSProperties,

  eventBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  eventTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  eventDesc: {
    fontSize: 13,
    color: '#475569',
    margin: 0,
    lineHeight: 1.4,
  } as React.CSSProperties,

  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  } as React.CSSProperties,

  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  } as React.CSSProperties,

  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
  } as React.CSSProperties,

  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    color: '#1e293b',
    background: '#f8fafc',
  } as React.CSSProperties,

  select: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    color: '#1e293b',
    background: '#f8fafc',
  } as React.CSSProperties,

  button: {
    background: '#0f172a',
    color: '#ffffff',
    border: 0,
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties,

  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 8,
  } as React.CSSProperties,

  resultBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  } as React.CSSProperties,

  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  } as React.CSSProperties,

  resultLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
  } as React.CSSProperties,

  resultValue: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '0.05em',
  } as React.CSSProperties,

  resultReason: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.5,
    margin: '0 0 10px 0',
  } as React.CSSProperties,

  contribBox: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  } as React.CSSProperties,

  contribTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    margin: '0 0 6px 0',
  } as React.CSSProperties,

  contribList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 12,
    color: '#334155',
  } as React.CSSProperties,

  contribItem: {
    marginBottom: 4,
  } as React.CSSProperties,
};

import { useEffect, useRef, useState } from 'react';
import type { FramePayload, PIEEvent, SyncResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
const SYNC_INTERVAL_MS = 5000;

export const useSyncLoop = (
  isActive: boolean,
  sessionId: string,
  frameBufferRef: React.MutableRefObject<FramePayload[]>,
) => {
  const [lastSyncCount, setLastSyncCount] = useState(0);
  const [totalSynced, setTotalSynced] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [events, setEvents] = useState<PIEEvent[]>([]);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;

    const syncFrames = async () => {
      if (isSyncingRef.current || frameBufferRef.current.length === 0) return;

      const batch = frameBufferRef.current.slice();
      isSyncingRef.current = true;

      try {
        const response = await fetch(`${API_BASE_URL}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            frames: batch,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync failed with ${response.status}`);
        }

        const data = (await response.json()) as SyncResponse;
        frameBufferRef.current.splice(0, batch.length);
        setLastSyncCount(data.received_count);
        setTotalSynced((count) => count + data.received_count);
        setConfidence(data.confidence);
        const newEvents = data.events || [];
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents].slice(-10)); // Keep last 10
        }
        setSyncStatus('ok');
        setLastError(null);
        setRetryCount(0);
      } catch (err: unknown) {
        setSyncStatus('error');
        setLastError(err instanceof Error ? err.message : String(err));
        setRetryCount((count) => count + 1);
      } finally {
        isSyncingRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void syncFrames();
    }, SYNC_INTERVAL_MS);

    void syncFrames();

    return () => window.clearInterval(intervalId);
  }, [frameBufferRef, isActive, sessionId]);

  return {
    lastSyncCount,
    totalSynced,
    syncStatus,
    lastError,
    confidence,
    retryCount,
    events,
  };
};

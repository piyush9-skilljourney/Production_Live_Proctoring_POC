import { useEffect, useRef, useState } from 'react';
import type { AudioData, FramePayload, GazeData } from '../types';

const COLLECT_INTERVAL_MS = 100;
const MAX_BUFFER_SECONDS = 5;
const MAX_BUFFER_SIZE = (1000 / COLLECT_INTERVAL_MS) * MAX_BUFFER_SECONDS;

interface FrameSource {
  gazeData: GazeData;
  fps: number;
  audioData: AudioData;
  objects?: string[];
}

export const useFrameBuffer = (isActive: boolean, source: FrameSource) => {
  const frameBufferRef = useRef<FramePayload[]>([]);
  const latestSourceRef = useRef(source);
  const [bufferSize, setBufferSize] = useState(0);
  const [collectedCount, setCollectedCount] = useState(0);

  useEffect(() => {
    latestSourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (!isActive) return;

    const intervalId = window.setInterval(() => {
      const latest = latestSourceRef.current;
      const frame: FramePayload = {
        timestamp: Date.now(),
        gaze_zone: latest.gazeData.zone,
        head_pose: latest.gazeData.pose,
        face_visible: latest.gazeData.zone !== 'MISSING',
        fps: latest.fps,
        audio_level: latest.audioData.level,
        vad_speech: latest.audioData.isSpeaking,
        objects: latest.objects || [],
      };

      frameBufferRef.current.push(frame);

      if (frameBufferRef.current.length > MAX_BUFFER_SIZE) {
        frameBufferRef.current.splice(
          0,
          frameBufferRef.current.length - MAX_BUFFER_SIZE,
        );
      }

      setBufferSize(frameBufferRef.current.length);
      setCollectedCount((count) => count + 1);
    }, COLLECT_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isActive]);

  return {
    frameBufferRef,
    bufferSize,
    collectedCount,
    maxBufferSize: MAX_BUFFER_SIZE,
  };
};

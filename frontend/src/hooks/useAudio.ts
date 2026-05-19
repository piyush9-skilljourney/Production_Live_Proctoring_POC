import { useEffect, useRef, useState } from 'react';
import type { AudioData } from '../types';

const VAD_THRESHOLD = 0.05;

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export const useAudio = (isActive: boolean, mediaStream: MediaStream | null) => {
  const [audioData, setAudioData] = useState<AudioData>({
    level: 0,
    isSpeaking: false,
  });
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !mediaStream) return;

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    const AudioCtx =
      window.AudioContext || (window as BrowserWindow).webkitAudioContext;

    if (!AudioCtx) {
      console.error('[useAudio] Web Audio API is not supported in this browser.');
      return;
    }

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    const audioOnlyStream = new MediaStream(audioTracks);
    const source = ctx.createMediaStreamSource(audioOnlyStream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    ctxRef.current = ctx;
    analyser.fftSize = 256;
    source.connect(analyser);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);

      const rms = Math.sqrt(
        dataArray.reduce(
          (sum: number, value: number) => sum + (value / 255) ** 2,
          0,
        ) / dataArray.length,
      );

      setAudioData({ level: rms, isSpeaking: rms > VAD_THRESHOLD });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void ctx.close();
      ctxRef.current = null;
    };
  }, [isActive, mediaStream]);

  return { audioData };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PermissionState } from '../types';

export const isBrowserSupported = (): boolean => {
  const ua = navigator.userAgent;
  const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
  const isEdge = /Edg\//.test(ua);
  return isChrome || isEdge;
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const useCamera = () => {
  const [permission, setPermission] = useState<PermissionState>('idle');
  const [micPermission, setMicPermission] = useState<PermissionState>('idle');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestAccess = useCallback(async () => {
    setPermission('requesting');
    setMicPermission('requesting');
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMediaStream(null);

    try {
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: true,
        });
      } catch (firstErr: unknown) {
        if (!(firstErr instanceof DOMException) || firstErr.name !== 'AbortError') {
          throw firstErr;
        }

        await wait(500);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      streamRef.current = stream;
      setMediaStream(stream);
      setPermission('granted');
      setMicPermission('granted');
    } catch (err: unknown) {
      console.error('[Camera] Access error:', getErrorMessage(err));
      setPermission('denied');
      setMicPermission('denied');
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaStream || permission !== 'granted') return;

    video.srcObject = mediaStream;
    void video.play().catch((err: unknown) => {
      console.error('[Camera] Video playback error:', getErrorMessage(err));
    });
  }, [mediaStream, permission]);

  const stopAccess = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMediaStream(null);
    setPermission('idle');
    setMicPermission('idle');
  }, []);

  return {
    permission,
    micPermission,
    mediaStream,
    videoRef,
    streamRef,
    requestAccess,
    stopAccess,
  };
};

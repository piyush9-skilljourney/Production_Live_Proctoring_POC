import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalibrationMap, FaceLandmark, GazeData, GazeZone } from '../types';

interface FaceMeshResults {
  multiFaceLandmarks?: FaceLandmark[][];
}

interface FaceMeshInstance {
  setOptions(options: {
    maxNumFaces: number;
    refineLandmarks: boolean;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }): void;
  onResults(callback: (results: FaceMeshResults) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

interface FaceMeshConstructor {
  new (config: { locateFile: (file: string) => string }): FaceMeshInstance;
}

interface CocoPrediction {
  class: string;
  score: number;
}

interface CocoSsdModel {
  detect(video: HTMLVideoElement): Promise<CocoPrediction[]>;
}

interface CocoSsdGlobal {
  load(): Promise<CocoSsdModel>;
}

declare global {
  interface Window {
    FaceMesh?: FaceMeshConstructor;
    tf?: unknown;
    cocoSsd?: CocoSsdGlobal;
  }
}

const DEFAULT_YAW_THRESHOLD = 35;
const DEFAULT_PITCH_THRESHOLD = 20;
const MIN_YAW_THRESHOLD = 12;
const MIN_PITCH_THRESHOLD = 10;
const RANGE_THRESHOLD_RATIO = 0.32;
const OBJECT_DETECTION_INTERVAL_MS = 1000;
const PHONE_CLASS = 'cell phone';
const PERSON_CLASS = 'person';
const OTHER_OBJECT_CLASS = 'other_object';

const normalizeDetectedClasses = (predictions: CocoPrediction[]): string[] => {
  const personDetections = predictions.filter(
    (prediction) =>
      prediction.class.toLowerCase() === PERSON_CLASS && prediction.score > 0.55,
  );
  const phoneDetected = predictions.some(
    (prediction) =>
      prediction.class.toLowerCase() === PHONE_CLASS && prediction.score > 0.65,
  );
  const otherDetected = predictions.some((prediction) => {
    const lowerClass = prediction.class.toLowerCase();
    return (
      lowerClass !== PERSON_CLASS &&
      lowerClass !== PHONE_CLASS &&
      prediction.score > 0.65
    );
  });

  const normalized = [
    ...personDetections.map(() => PERSON_CLASS),
    ...(phoneDetected ? [PHONE_CLASS] : []),
  ];

  if (normalized.length === 0 && otherDetected) {
    normalized.push(OTHER_OBJECT_CLASS);
  }

  return normalized;
};

export const useInference = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
  calibrationMap: CalibrationMap | null = null,
  enableObjectDetection: boolean = false,
) => {
  const centerYaw = calibrationMap?.centerYaw ?? 0;
  const centerPitch = calibrationMap?.centerPitch ?? 0;
  const enableObjectDetectionRef = useRef(enableObjectDetection);
  const [gazeData, setGazeData] = useState<GazeData>({
    zone: 'CENTER',
    pose: { yaw: 0, pitch: 0 },
  });
  const [objects, setObjects] = useState<string[]>([]);
  const previousObjectsRef = useRef<string[]>([]);
  const latestPoseRef = useRef({ yaw: 0, pitch: 0 });
  const [fps, setFps] = useState(0);
  const [landmarks, setLandmarks] = useState<FaceLandmark[]>([]);
  const faceMeshRef = useRef<FaceMeshInstance | null>(null);
  const cocoSsdModelRef = useRef<CocoSsdModel | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTime = useRef<number>(0);
  const isDetecting = useRef(false);

  useEffect(() => {
    enableObjectDetectionRef.current = enableObjectDetection;
  }, [enableObjectDetection]);

  const classifyZone = useCallback(
    (rawYaw: number, rawPitch: number): GazeZone => {
      const yaw = rawYaw - centerYaw;
      const pitch = rawPitch - centerPitch;
      const yawThreshold = calibrationMap
        ? Math.max(calibrationMap.yawRange * RANGE_THRESHOLD_RATIO, MIN_YAW_THRESHOLD)
        : DEFAULT_YAW_THRESHOLD;
      const pitchThreshold = calibrationMap
        ? Math.max(calibrationMap.pitchRange * RANGE_THRESHOLD_RATIO, MIN_PITCH_THRESHOLD)
        : DEFAULT_PITCH_THRESHOLD;

      if (yaw > yawThreshold) return 'RIGHT';
      if (yaw < -yawThreshold) return 'LEFT';
      if (pitch > pitchThreshold) return 'UP';
      if (pitch < -pitchThreshold) return 'DOWN';
      return 'CENTER';
    },
    [calibrationMap, centerPitch, centerYaw],
  );

  useEffect(() => {
    if (!isActive) return;
    if (!window.FaceMesh) {
      console.error(
        '[useInference] FaceMesh global not found. Add the FaceMesh CDN script to index.html',
      );
      return;
    }

    let rafId = 0;
    let isRunning = true;
    let isProcessing = false;
    let objectDetectionIntervalId = 0;

    const initCocoSsd = async () => {
      try {
        if (!window.cocoSsd) {
          console.warn('[useInference] COCO-SSD not available, skipping object detection');
          return;
        }
        const model = await window.cocoSsd.load();
        cocoSsdModelRef.current = model;
        console.log('[useInference] COCO-SSD model loaded');
      } catch (err) {
        console.error('[useInference] Failed to load COCO-SSD:', err);
      }
    };

    const detectObjects = async () => {
      if (
        !cocoSsdModelRef.current ||
        !videoRef.current ||
        isDetecting.current ||
        !enableObjectDetectionRef.current
      ) {
        return;
      }

      isDetecting.current = true;
      try {
        const predictions = await cocoSsdModelRef.current.detect(videoRef.current);
        const detectedClasses = normalizeDetectedClasses(predictions);

        const previousClasses = [...previousObjectsRef.current].sort().join(',');
        const nextClasses = [...detectedClasses].sort().join(',');
        const classesChanged = previousClasses !== nextClasses;

        if (classesChanged) {
          console.log(
            '[COCO-SSD] Objects detected:',
            detectedClasses,
            `(person count: ${detectedClasses.filter((value) => value === 'person').length})`,
          );
          previousObjectsRef.current = detectedClasses;
          setObjects(detectedClasses);
        }
      } catch (err) {
        console.error('[useInference] Object detection error:', err);
      } finally {
        isDetecting.current = false;
      }
    };

    const fm = new window.FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    fm.onResults((results: FaceMeshResults) => {
      frameCountRef.current += 1;
      const now = Date.now();

      if (lastFpsTime.current === 0) lastFpsTime.current = now;
      if (now - lastFpsTime.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTime.current = now;
      }

      const faceLandmarks = results.multiFaceLandmarks?.[0];
      if (!faceLandmarks) {
        setLandmarks([]);
        setGazeData({ zone: 'MISSING', pose: { yaw: 0, pitch: 0 } });
        return;
      }

      setLandmarks(faceLandmarks);

      const nose = faceLandmarks[1];
      const leftEar = faceLandmarks[234];
      const rightEar = faceLandmarks[454];
      const forehead = faceLandmarks[10];
      const chin = faceLandmarks[152];

      if (!nose || !leftEar || !rightEar || !forehead || !chin) return;

      const midEarX = (leftEar.x + rightEar.x) / 2;
      const rawYaw = (nose.x - midEarX) * 500;
      const midVertY = (forehead.y + chin.y) / 2;
      const rawPitch = (nose.y - midVertY) * 500;
      const zone = classifyZone(rawYaw, rawPitch);

      console.log(
        `[Gaze] zone=${zone} yaw=${rawYaw.toFixed(1)} pitch=${rawPitch.toFixed(1)}`,
      );

      latestPoseRef.current = { yaw: rawYaw, pitch: rawPitch };
      setGazeData({
        zone,
        pose: {
          yaw: rawYaw - centerYaw,
          pitch: rawPitch - centerPitch,
        },
      });
    });

    faceMeshRef.current = fm;

    void initCocoSsd().then(() => {
      if (isRunning && cocoSsdModelRef.current) {
        objectDetectionIntervalId = window.setInterval(
          detectObjects,
          OBJECT_DETECTION_INTERVAL_MS,
        );
      }
    });

    const processFrame = async () => {
      const video = videoRef.current;

      if (
        isRunning &&
        !isProcessing &&
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        isProcessing = true;

        try {
          await fm.send({ image: video });
        } catch (err: unknown) {
          isRunning = false;
          setFps(0);
          setLandmarks([]);
          setObjects([]);
          setGazeData({ zone: 'MISSING', pose: { yaw: 0, pitch: 0 } });
          console.error('[useInference] FaceMesh frame error:', err);
        } finally {
          isProcessing = false;
        }
      }

      if (isRunning) {
        rafId = requestAnimationFrame(processFrame);
      }
    };

    rafId = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
      if (objectDetectionIntervalId) {
        window.clearInterval(objectDetectionIntervalId);
      }
      setLandmarks([]);
      setObjects([]);
      setFps(0);
      fm.close();
      faceMeshRef.current = null;
      cocoSsdModelRef.current = null;
      lastFpsTime.current = 0;
      frameCountRef.current = 0;
      previousObjectsRef.current = [];
    };
  }, [centerPitch, centerYaw, classifyZone, isActive, videoRef]);

  return { gazeData, fps, landmarks, objects, latestPoseRef };
};

// Shared types used across hooks and components

export type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied';

export type GazeZone = 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'MISSING';

export interface HeadPose {
  yaw: number;
  pitch: number;
}

export interface GazeData {
  zone: GazeZone;
  pose: HeadPose;
}

export interface AudioData {
  level: number;      // 0.0 – 1.0 RMS
  isSpeaking: boolean;
}

export interface FramePayload {
  timestamp: number;
  gaze_zone: GazeZone;
  head_pose: HeadPose;
  face_visible: boolean;
  audio_level: number;
  vad_speech: boolean;
  objects: string[];
}
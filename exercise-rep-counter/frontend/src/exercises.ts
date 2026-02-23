// ─────────────────────────────────────────────────────────────────────────────
// exercises.ts
// All exercise definitions live here. To add a new exercise:
//   1. Add a key to ExerciseKey
//   2. Add a config entry in EXERCISES
// ─────────────────────────────────────────────────────────────────────────────

export type ExerciseKey = 'bicep' | 'squat' | 'pushup' | 'shoulderpress';

export interface ExerciseConfig {
  label: string;
  // MediaPipe landmark indices: [pointA, joint, pointC]
  // Full landmark map: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
  landmarks: [number, number, number];
  upThreshold: number;   // angle < this  → "up"   phase
  downThreshold: number; // angle > this  → "down" phase
  holdFrames: number;    // consecutive frames needed to confirm a phase change (debounce)
  hint: string;
}

export const EXERCISES: Record<ExerciseKey, ExerciseConfig> = {
  bicep: {
    label: '💪 Bicep Curl',
    landmarks: [11, 13, 15], // left shoulder → elbow → wrist
    upThreshold: 50,
    downThreshold: 150,
    holdFrames: 12,
    hint: 'Left arm visible. Full extension = "down", full curl = "up".',
  },
  squat: {
    label: '🦵 Squat',
    landmarks: [23, 25, 27], // left hip → knee → ankle
    upThreshold: 100,
    downThreshold: 160,
    holdFrames: 15,
    hint: 'Stand side-on to camera. Standing = "down", deep squat = "up".',
  },
  pushup: {
    label: '🤸 Push-up',
    landmarks: [11, 13, 15], // left shoulder → elbow → wrist (side-on)
    upThreshold: 90,
    downThreshold: 155,
    holdFrames: 12,
    hint: 'Camera side-on. Arms extended = "down", chest to floor = "up".',
  },
  shoulderpress: {
    label: '🏋️ Shoulder Press',
    landmarks: [11, 13, 15], // left shoulder → elbow → wrist
    upThreshold: 160,        // arm fully extended overhead
    downThreshold: 90,       // elbow at ~90° (start position)
    holdFrames: 12,
    hint: 'Face camera. Arms at 90° = "down", fully pressed overhead = "up".',
  },
};
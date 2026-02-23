// ─────────────────────────────────────────────────────────────────────────────
// exercises.ts
// All exercise definitions live here. To add a new exercise:
//   1. Add a key to ExerciseKey
//   2. Add a config entry in EXERCISES
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type ExerciseKey = 'bicep' | 'squat' | 'pushup' | 'shoulderpress';

export interface FormCheck {
  name: string;
  condition: (lm: NormalizedLandmark[]) => boolean;
  message: string;
}

export interface ExerciseConfig {
  label: string;
  landmarks: [number, number, number]; // [pointA, joint, pointC]
  upThreshold: number;    // angle < this  → "up" phase
  downThreshold: number;  // angle > this  → "down" phase
  holdFrames: number;     // frames needed to confirm phase change (debounce)
  hint: string;
  formChecks?: FormCheck[];
}

// ── Shared helper for frontal-plane angle (used in form checks) ───────────────
function frontalAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  // Only uses x/y (ignores z) — good for detecting lateral deviation
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let ang = Math.abs((radians * 180.0) / Math.PI);
  if (ang > 180.0) ang = 360 - ang;
  return ang;
}

export const EXERCISES: Record<ExerciseKey, ExerciseConfig> = {
  bicep: {
    label: '💪 Bicep Curl',
    landmarks: [11, 13, 15], // left shoulder → elbow → wrist
    upThreshold: 50,
    downThreshold: 150,
    holdFrames: 12,
    hint: 'Left arm visible. Full extension = "down", full curl = "up".',
    formChecks: [
      {
        name: 'Elbow drift',
        // Elbow (13) should stay close to body — check it doesn't drift forward (z axis is unreliable
        // so we use x deviation: elbow x should roughly align with shoulder x)
        condition: (lm) => {
          const shoulder = lm[11];
          const elbow = lm[13];
          if (!shoulder || !elbow) return false;
          return Math.abs(elbow.x - shoulder.x) > 0.15;
        },
        message: 'Keep elbow close to your body',
      },
      {
        name: 'Wrist drop',
        // Wrist should be above elbow when curled (y is inverted in MediaPipe)
        condition: (lm) => {
          const elbow = lm[13];
          const wrist = lm[15];
          if (!elbow || !wrist) return false;
          // In "up" phase, wrist should be higher than elbow (lower y value)
          return wrist.y > elbow.y + 0.05;
        },
        message: 'Curl all the way up — wrist above elbow',
      },
    ],
  },

  squat: {
    label: '🦵 Squat',
    landmarks: [23, 25, 27], // left hip → knee → ankle
    upThreshold: 100,
    downThreshold: 160,
    holdFrames: 15,
    hint: 'Stand side-on to camera. Standing = "down", deep squat = "up".',
    formChecks: [
      {
        name: 'Knee valgus',
        // Knee caving inward: knee x should be between hip x and ankle x (roughly)
        condition: (lm) => {
          const hip = lm[23];
          const knee = lm[25];
          const ankle = lm[27];
          if (!hip || !knee || !ankle) return false;
          return frontalAngle(hip, knee, ankle) < 155;
        },
        message: "Don't let knees cave inward",
      },
      {
        name: 'Forward lean',
        // Shoulder should roughly stay over hip — check if shoulder x drifts too far from hip x
        condition: (lm) => {
          const shoulder = lm[11];
          const hip = lm[23];
          if (!shoulder || !hip) return false;
          return Math.abs(shoulder.x - hip.x) > 0.2;
        },
        message: 'Keep your chest up — reduce forward lean',
      },
    ],
  },

  pushup: {
    label: '🤸 Push-up',
    landmarks: [11, 13, 15], // left shoulder → elbow → wrist (side-on)
    upThreshold: 90,
    downThreshold: 155,
    holdFrames: 12,
    hint: 'Camera side-on. Arms extended = "down", chest to floor = "up".',
    formChecks: [
      {
        name: 'Hip sag',
        // Hip (23) should stay roughly level with shoulder (11) — not drop below
        condition: (lm) => {
          const shoulder = lm[11];
          const hip = lm[23];
          const ankle = lm[27];
          if (!shoulder || !hip || !ankle) return false;
          // If hip y is significantly more than shoulder y, hips are sagging
          return hip.y > shoulder.y + 0.1;
        },
        message: 'Keep your hips up — maintain a straight body line',
      },
      {
        name: 'Elbow flare',
        // Elbow should not flare too wide — check elbow x vs shoulder x
        condition: (lm) => {
          const shoulder = lm[11];
          const elbow = lm[13];
          if (!shoulder || !elbow) return false;
          return Math.abs(elbow.x - shoulder.x) > 0.2;
        },
        message: 'Keep elbows tucked — avoid flaring out',
      },
    ],
  },

  shoulderpress: {
    label: '🏋️ Shoulder Press',
    landmarks: [11, 13, 15], // left shoulder → elbow → wrist
    upThreshold: 160,        // arm fully extended overhead
    downThreshold: 90,       // elbow at ~90° (start position)
    holdFrames: 12,
    hint: 'Face camera. Arms at 90° = "down", fully pressed overhead = "up".',
    formChecks: [
      {
        name: 'Wrist alignment',
        // Wrist should stay roughly above elbow — check horizontal drift
        condition: (lm) => {
          const elbow = lm[13];
          const wrist = lm[15];
          if (!elbow || !wrist) return false;
          return Math.abs(wrist.x - elbow.x) > 0.15;
        },
        message: 'Keep wrists directly above elbows',
      },
      {
        name: 'Elbow drop',
        // In bottom position, elbows should be roughly at shoulder height
        condition: (lm) => {
          const shoulder = lm[11];
          const elbow = lm[13];
          if (!shoulder || !elbow) return false;
          // Elbow dropping below shoulder level
          return elbow.y > shoulder.y + 0.12;
        },
        message: 'Raise elbows to shoulder height at the bottom',
      },
    ],
  },
};
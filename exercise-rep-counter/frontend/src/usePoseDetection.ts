// ─────────────────────────────────────────────────────────────────────────────
// usePoseDetection.ts
// Custom hook that owns:
//   - MediaPipe model loading
//   - Camera stream management (with HD/mobile resolution detection)
//   - Per-frame detection + angle calculation
//   - Smoothing (moving average) + debounced rep counting state machine
//   - Form check evaluation per frame
//   - Workout session saving to localStorage
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { EXERCISES, type ExerciseKey } from './exercises';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const ANGLE_HISTORY_SIZE = 5;

// ── Workout session type ──────────────────────────────────────────────────────
export interface WorkoutSession {
  date: string;
  exercise: ExerciseKey;
  reps: number;
}

const STORAGE_KEY = 'workoutSessions';

export function loadSessions(): WorkoutSession[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSession(exercise: ExerciseKey, reps: number) {
  if (reps === 0) return;
  const sessions = loadSessions();
  sessions.push({ date: new Date().toISOString(), exercise, reps });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ── Hook options ──────────────────────────────────────────────────────────────
interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  exerciseKey: ExerciseKey;
}

export function usePoseDetection({ videoRef, canvasRef, exerciseKey }: UsePoseDetectionOptions) {
  // Status
  const [modelReady, setModelReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live display
  const [reps, setReps] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  const [angle, setAngle] = useState(0);
  const [formAlert, setFormAlert] = useState<string>('');

  // Refs for rAF loop (no stale closures, no effect restarts)
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const stageRef = useRef<string | null>(null);
  const repsRef = useRef<number>(0);
  const holdCountRef = useRef<number>(0);
  const exerciseRef = useRef<ExerciseKey>(exerciseKey);
  const angleHistoryRef = useRef<number[]>([]);

  // Keep exerciseRef in sync with prop
  useEffect(() => {
    exerciseRef.current = exerciseKey;
  }, [exerciseKey]);

  // ── 1. Load MediaPipe model once ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const initModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = poseLandmarker;
          setModelReady(true);
        }
      } catch (err) {
        console.error('Model load failed:', err);
        if (!cancelled) setError('Pose model failed to load. Check console.');
      }
    };
    initModel();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
    };
  }, []);

  // ── 2. Start camera — button triggered ─────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      // Request HD on desktop, standard on mobile
      const isMobile = window.innerWidth < 768;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: 'user',
        },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Match canvas size to actual video resolution for accurate landmark drawing
      videoRef.current.addEventListener('play', () => {
        if (videoRef.current && canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }
      }, { once: true });

      setCameraStarted(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Go to chrome://settings/content/camera, remove the localhost block, and reload.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another app.');
      } else {
        setError(`Camera error: ${err.message}`);
      }
    }
  }, [videoRef, canvasRef]);

  // ── 3. Angle between 3 landmarks ────────────────────────────────────────────
  const calculateAngle = useCallback(
    (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number => {
      const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let ang = Math.abs((radians * 180.0) / Math.PI);
      if (ang > 180.0) ang = 360 - ang;
      return ang;
    },
    []
  );

  // ── 4. Detection loop — starts once, never restarts ─────────────────────────
  useEffect(() => {
    if (!cameraStarted) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const runLoop = () => {
      const landmarker = landmarkerRef.current;

      if (landmarker && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        if (!cameraReady) setCameraReady(true);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let results: PoseLandmarkerResult;
          try {
            results = landmarker.detectForVideo(video, performance.now());
          } catch {
            animFrameRef.current = requestAnimationFrame(runLoop);
            return;
          }

          if (results.landmarks.length > 0) {
            // Draw skeleton
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawLandmarks(results.landmarks[0], { color: '#00FF88', lineWidth: 2, radius: 4 });
            drawingUtils.drawConnectors(results.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, { color: '#00FF88', lineWidth: 3 });

            const lm = results.landmarks[0];
            const cfg = EXERCISES[exerciseRef.current];
            const [ai, bi, ci] = cfg.landmarks;
            const a = lm[ai];
            const b = lm[bi];
            const c = lm[ci];

            // ── Form checks ────────────────────────────────────────────────
            let currentAlert = '';
            if (cfg.formChecks) {
              for (const check of cfg.formChecks) {
                if (check.condition(lm)) {
                  currentAlert = check.message;
                  break;
                }
              }
            }
            setFormAlert(currentAlert);

            // ── Angle + rep counting (only if landmarks clearly visible) ──
            if (a && b && c && (a.visibility ?? 1) > 0.5 && (b.visibility ?? 1) > 0.5 && (c.visibility ?? 1) > 0.5) {
              const rawAngle = calculateAngle(a, b, c);

              // Rolling average to reduce jitter
              const history = angleHistoryRef.current;
              history.push(rawAngle);
              if (history.length > ANGLE_HISTORY_SIZE) history.shift();
              const smoothedAngle = history.reduce((sum, v) => sum + v, 0) / history.length;
              setAngle(Math.round(smoothedAngle));

              // Debounced state machine
              if (smoothedAngle > cfg.downThreshold) {
                holdCountRef.current += 1;
                if (holdCountRef.current >= cfg.holdFrames) {
                  if (stageRef.current === 'up') {
                    repsRef.current += 1;
                    setReps(repsRef.current);
                  }
                  if (stageRef.current !== 'down') {
                    stageRef.current = 'down';
                    setStage('down');
                  }
                  holdCountRef.current = 0;
                }
              } else if (smoothedAngle < cfg.upThreshold) {
                holdCountRef.current += 1;
                if (holdCountRef.current >= cfg.holdFrames) {
                  if (stageRef.current !== 'up') {
                    stageRef.current = 'up';
                    setStage('up');
                  }
                  holdCountRef.current = 0;
                }
              } else {
                holdCountRef.current = 0;
              }
            } else {
              // Landmarks not visible enough — pause
              holdCountRef.current = 0;
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(runLoop);
    };

    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      runLoop();
    } else {
      video.addEventListener('loadeddata', runLoop, { once: true });
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      video.removeEventListener('loadeddata', runLoop);
      const stream = video.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStarted, calculateAngle, videoRef, canvasRef]);

  // ── 5. Save session + reset counters ────────────────────────────────────────
  const resetCounters = useCallback(() => {
    // Save current session before resetting
    saveSession(exerciseRef.current, repsRef.current);

    repsRef.current = 0;
    stageRef.current = null;
    holdCountRef.current = 0;
    angleHistoryRef.current = [];
    setReps(0);
    setStage(null);
    setAngle(0);
    setFormAlert('');
  }, []);

  return {
    modelReady, cameraStarted, cameraReady, error, setError,
    startCamera, resetCounters,
    reps, stage, angle, formAlert,
  };
}
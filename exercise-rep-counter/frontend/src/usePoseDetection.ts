// ─────────────────────────────────────────────────────────────────────────────
// usePoseDetection.ts
// Custom hook that owns:
//   - MediaPipe model loading
//   - Camera stream management
//   - Per-frame detection + angle calculation
//   - Smoothing (moving average) + debounced rep counting state machine
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { EXERCISES, type ExerciseKey } from './exercises';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const ANGLE_HISTORY_SIZE = 5; // frames to average for angle smoothing

interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  exerciseKey: ExerciseKey;
}

export function usePoseDetection({ videoRef, canvasRef, exerciseKey }: UsePoseDetectionOptions) {
  // ── Model & camera status ──────────────────────────────────────────────────
  const [modelReady, setModelReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Rep counter display state ──────────────────────────────────────────────
  const [reps, setReps] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  const [angle, setAngle] = useState(0);

  // ── Refs used inside the rAF loop (avoids stale closure issues) ───────────
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const stageRef = useRef<string | null>(null);
  const repsRef = useRef<number>(0);
  const holdCountRef = useRef<number>(0);
  const exerciseRef = useRef<ExerciseKey>(exerciseKey);
  const angleHistoryRef = useRef<number[]>([]);

  // Keep exerciseRef in sync when the selected exercise changes
  useEffect(() => {
    exerciseRef.current = exerciseKey;
  }, [exerciseKey]);

  // ── 1. Load MediaPipe model once on mount ─────────────────────────────────
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

  // ── 2. Start camera (called by a button click for browser permission UX) ──
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
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
  }, [videoRef]);

  // ── 3. Angle calculation between 3 landmarks ──────────────────────────────
  // Returns the angle (0–180°) at point B given points A, B, C
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

  // ── 4. Detection loop — starts once camera is ready, never restarts ───────
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
            // Draw skeleton overlay
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawLandmarks(results.landmarks[0], { color: '#00FF88', lineWidth: 2, radius: 4 });
            drawingUtils.drawConnectors(results.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, { color: '#00FF88', lineWidth: 3 });

            // Get the 3 relevant landmarks for the current exercise
            const lm = results.landmarks[0];
            const cfg = EXERCISES[exerciseRef.current];
            const [ai, bi, ci] = cfg.landmarks;
            const a = lm[ai];
            const b = lm[bi];
            const c = lm[ci];

            // Only count if landmarks are clearly visible (visibility > 0.5)
            if (a && b && c && a.visibility! > 0.5 && b.visibility! > 0.5 && c.visibility! > 0.5) {
              const rawAngle = calculateAngle(a, b, c);

              // Smooth using a rolling average to reduce jitter
              const history = angleHistoryRef.current;
              history.push(rawAngle);
              if (history.length > ANGLE_HISTORY_SIZE) history.shift();
              const smoothedAngle = history.reduce((sum, v) => sum + v, 0) / history.length;
              setAngle(Math.round(smoothedAngle));

              // Debounced state machine
              // A phase change is only confirmed after holdFrames consecutive frames
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
                // Mid-range — reset hold counter so partial movements don't accumulate
                holdCountRef.current = 0;
              }
            } else {
              // Landmarks not visible enough — pause counting
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

  // ── 5. Reset counters (called on exercise switch or manual reset) ──────────
  const resetCounters = useCallback(() => {
    repsRef.current = 0;
    stageRef.current = null;
    holdCountRef.current = 0;
    angleHistoryRef.current = [];
    setReps(0);
    setStage(null);
    setAngle(0);
  }, []);

  return {
    // Status
    modelReady,
    cameraStarted,
    cameraReady,
    error,
    setError,
    // Actions
    startCamera,
    resetCounters,
    // Live data
    reps,
    stage,
    angle,
  };
}
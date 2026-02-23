// ─────────────────────────────────────────────────────────────────────────────
// App.tsx
// Pure UI layer — no detection logic here.
// Features:
//   - Exercise selector with swipe gesture support
//   - Mirror mode (flip video + canvas)
//   - Real-time form alert banner
//   - Workout history modal with chart
//   - Touch-optimized controls
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';
import { EXERCISES, type ExerciseKey } from './exercises';
import { usePoseDetection } from './usePoseDetection';
import HistoryModal from './HistoryModal.tsx';
import './App.css';

const EXERCISE_KEYS = Object.keys(EXERCISES) as ExerciseKey[];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [exercise, setExercise] = useState<ExerciseKey>('bicep');
  const [mirror, setMirror] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Touch swipe state
  const touchStartX = useRef<number | null>(null);

  const {
    modelReady, cameraStarted, cameraReady, error, setError,
    startCamera, resetCounters,
    reps, stage, angle, formAlert,
  } = usePoseDetection({ videoRef, canvasRef, exerciseKey: exercise });

  const handleExerciseChange = (key: ExerciseKey) => {
    if (key === exercise) return;
    resetCounters(); // saves current session before switching
    setExercise(key);
  };

  // Swipe to switch exercise
  const switchExercise = (dir: 'next' | 'prev') => {
    const idx = EXERCISE_KEYS.indexOf(exercise);
    const next = dir === 'next'
      ? EXERCISE_KEYS[(idx + 1) % EXERCISE_KEYS.length]
      : EXERCISE_KEYS[(idx - 1 + EXERCISE_KEYS.length) % EXERCISE_KEYS.length];
    handleExerciseChange(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) switchExercise(delta < 0 ? 'next' : 'prev');
    touchStartX.current = null;
  };

  const statusMsg = !modelReady
    ? '⏳ Loading pose model…'
    : !cameraStarted
    ? '📷 Ready — click Start to begin'
    : !cameraReady
    ? '⏳ Waiting for camera feed…'
    : '🟢 Detecting — go!';

  if (error) {
    return (
      <div className="error-page">
        <div className="error-box">
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <p>{error}</p>
          <button className="btn" onClick={() => setError(null)}>Dismiss</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <h1 className="title">Fitness Rep Counter</h1>
        <button className="btn icon-btn" onClick={() => setShowHistory(true)} title="Workout history">
          📈
        </button>
      </div>

      <p className="subtitle">{statusMsg}</p>

      {/* Exercise selector */}
      <div className="selector-row">
        {EXERCISE_KEYS.map((key) => (
          <button
            key={key}
            className={`exercise-btn ${exercise === key ? 'active' : ''}`}
            onClick={() => handleExerciseChange(key)}
          >
            {EXERCISES[key].label}
          </button>
        ))}
      </div>

      {/* Video + canvas — swipeable */}
      <div
        className="video-container"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video"
          style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="canvas"
          style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
        />

        {/* Form alert banner */}
        {cameraStarted && formAlert && (
          <div className="form-alert">
            ⚠️ {formAlert}
          </div>
        )}

        {/* Live stats */}
        {cameraStarted && (
          <div className="stats-overlay">
            <div className="stat-row">
              <span className="stat-label">REPS</span>
              <span className="stat-value accent big">{reps}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">STAGE</span>
              <span className="stat-value">{stage ?? '—'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">ANGLE</span>
              <span className="stat-value">{angle}°</span>
            </div>
          </div>
        )}

        {/* Start button */}
        {!cameraStarted && (
          <div className="start-overlay">
            <button
              className="start-btn"
              onClick={startCamera}
              disabled={!modelReady}
            >
              {modelReady ? '▶ Start Camera' : '⏳ Loading Model…'}
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {cameraStarted && (
        <div className="controls">
          <button className="btn" onClick={resetCounters}>🔄 Reset & Save</button>
          <button
            className={`btn ${mirror ? 'active-btn' : ''}`}
            onClick={() => setMirror((m) => !m)}
          >
            🪞 Mirror {mirror ? 'On' : 'Off'}
          </button>
        </div>
      )}

      <p className="hint">
        {EXERCISES[exercise].hint}
        {cameraStarted && ' · Swipe left/right to switch exercise.'}
      </p>

      {/* History modal */}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}
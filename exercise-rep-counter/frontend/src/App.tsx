// ─────────────────────────────────────────────────────────────────────────────
// App.tsx
// Pure UI layer — no detection logic here.
// Wires together:
//   - usePoseDetection hook  (all the CV + rep counting logic)
//   - EXERCISES config       (exercise definitions)
//   - JSX + styles           (what the user sees)
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';
import { EXERCISES, type ExerciseKey } from './exercises';
import { usePoseDetection } from './usePoseDetection';import './App.css';


export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [exercise, setExercise] = useState<ExerciseKey>('bicep');

  const {
    modelReady, cameraStarted, cameraReady, error, setError,
    startCamera, resetCounters,
    reps, stage, angle,
  } = usePoseDetection({ videoRef, canvasRef, exerciseKey: exercise });

  const handleExerciseChange = (key: ExerciseKey) => {
    setExercise(key);
    resetCounters();
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
      <h1 className="title">Fitness Rep Counter</h1>
      <p className="subtitle">{statusMsg}</p>

      {/* Exercise selector */}
      <div className="selector-row">
        {(Object.keys(EXERCISES) as ExerciseKey[]).map((key) => (
          <button
            key={key}
            className={`exercise-btn ${exercise === key ? 'active' : ''}`}
            onClick={() => handleExerciseChange(key)}
          >
            {EXERCISES[key].label}
          </button>
        ))}
      </div>

      {/* Video feed + skeleton overlay */}
      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline muted className="video" />
        <canvas ref={canvasRef} width={640} height={480} className="canvas" />

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

        {/* Start button — shown until camera is running */}
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

      {/* Reset */}
      {cameraStarted && (
        <div className="controls">
          <button className="btn" onClick={resetCounters}>🔄 Reset Reps</button>
        </div>
      )}

      <p className="hint">{EXERCISES[exercise].hint}</p>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// HistoryModal.tsx
// Shows past workout sessions from localStorage as a bar chart.
// Uses Recharts (already available in the React artifact environment).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { loadSessions, type WorkoutSession } from './usePoseDetection';
import type { ExerciseKey } from './exercises';

const EXERCISE_COLORS: Record<ExerciseKey, string> = {
  bicep: '#00FF88',
  squat: '#00BFFF',
  pushup: '#FF8C00',
  shoulderpress: '#DA70D6',
};

interface Props {
  onClose: () => void;
}

export default function HistoryModal({ onClose }: Props) {
  const [sessions, setSessions] = useState<WorkoutSession[]>(loadSessions);

  const clearHistory = () => {
    if (window.confirm('Clear all workout history?')) {
      localStorage.removeItem('workoutSessions');
      setSessions([]);
    }
  };

  const chartData = sessions.slice(-20).map((s) => ({
    date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    reps: s.reps,
    exercise: s.exercise,
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📈 Workout History</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {sessions.length === 0 ? (
          <p className="modal-empty">No sessions yet. Complete a workout and reset to save!</p>
        ) : (
          <>
            {/* Chart */}
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    formatter={(value: number | undefined) => [`${value ?? 0} reps`, 'Reps'] as [string, string]}
                  />
                  <Bar dataKey="reps" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={EXERCISE_COLORS[entry.exercise as ExerciseKey] ?? '#00FF88'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="legend">
              {(Object.entries(EXERCISE_COLORS) as [ExerciseKey, string][]).map(([key, color]) => (
                <span key={key} className="legend-item">
                  <span className="legend-dot" style={{ background: color }} />
                  {key}
                </span>
              ))}
            </div>

            {/* Session list */}
            <div className="session-list">
              {[...sessions].reverse().slice(0, 10).map((s, i) => (
                <div key={i} className="session-row">
                  <span
                    className="session-exercise"
                    style={{ color: EXERCISE_COLORS[s.exercise] }}
                  >
                    {s.exercise}
                  </span>
                  <span className="session-reps">{s.reps} reps</span>
                  <span className="session-date">
                    {new Date(s.date).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>

            <button className="btn danger" onClick={clearHistory}>🗑 Clear All History</button>
          </>
        )}
      </div>
    </div>
  );
}
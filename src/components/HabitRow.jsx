import { useRef } from 'react';
import { PILLARS } from '../lib/game';

export default function HabitRow({ habit, done, onToggle }) {
  const file = useRef(null);
  const P = PILLARS[habit.pillar];
  return (
    <div className={`habit ${done ? 'done' : ''}`}>
      <span className="hicon">{habit.icon}</span>
      <div className="hinfo">
        <div className="hname">{habit.name}</div>
        <div className="hmeta">
          <span className="xp" style={{ color: P.color, background: P.color + '22' }}>+{habit.xp} XP</span>
          <span>+{habit.stat} {P.short}</span>
          {done?.photo && <span className="xp" style={{ color: '#a855f7' }}>📷 +25%</span>}
        </div>
      </div>
      {/* Evidencia fotográfica opcional: +25% XP */}
      <input ref={file} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { if (e.target.files[0] && !done) onToggle(habit, true); e.target.value = ''; }} />
      <button className="icon-btn" title="Adjuntar foto (+25% XP)" onClick={() => file.current.click()}>📷</button>
      <button className="check" aria-label="Completar" onClick={() => onToggle(habit, false)}>{done ? '✓' : ''}</button>
    </div>
  );
}

import Avatar from '../components/Avatar';
import HabitRow from '../components/HabitRow';
import { useGame } from '../context/GameContext';
import { PILLARS, STAT_MAX, getHabits, todayKey, xpForLevel } from '../lib/game';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

export default function Home({ goPillar }) {
  const { data: s, toggle } = useGame();
  const now = new Date();
  const habits = getHabits(s);
  const today = s.log[todayKey()] || {};
  const doneCount = habits.filter((h) => today[h.id]).length;
  const pct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;
  const need = xpForLevel(s.level);

  return (
    <>
      <header className="top">
        <div className="av-ring"><Avatar p={s.profile} size={56} /><span className="lvl">LVL {s.level}</span></div>
        <div className="grow">
          <div className="row"><b className="uname">{s.profile.name}</b><span className="streak">🔥 {s.streak} días</span></div>
          <div className="row sub"><span>Barra de XP</span><b className="xpnum">{s.xp.toLocaleString('es-CO')} / {need.toLocaleString('es-CO')} XP</b></div>
          <div className="bar xpbar"><i style={{ width: `${(s.xp / need) * 100}%` }} /></div>
        </div>
      </header>

      <section className="stats">
        {s.pillars.map((k) => {
          const P = PILLARS[k];
          return (
            <div key={k} className="stat" style={{ '--c': P.color }}>
              <div className="row"><span>{P.icon} {P.short}</span><b style={{ color: P.color }}>{s.stats[k]}</b></div>
              <div className="bar"><i style={{ width: `${(s.stats[k] / STAT_MAX) * 100}%`, background: P.color }} /></div>
              <small>{s.stats[k]} / {STAT_MAX} pts</small>
            </div>
          );
        })}
      </section>

      <section className="day">
        <div className="row">
          <div>
            <h3>{DIAS[now.getDay()]}, {now.getDate()} De {MESES[now.getMonth()]}</h3>
            <small className="sub">{doneCount}/{habits.length} hábitos completados</small>
          </div>
          <div className="ring" style={{ '--p': pct }}><span>{pct}%</span></div>
        </div>

        {s.pillars.map((k) => {
          const P = PILLARS[k], list = habits.filter((h) => h.pillar === k);
          const d = list.filter((h) => today[h.id]).length;
          return (
            <div key={k}>
              <div className="sec-head" style={{ color: P.color }}>
                <span>{P.icon} <b>{P.short}</b> <small>· {d}/{list.length}</small></span>
                <hr style={{ borderColor: P.color + '44' }} />
                <button onClick={() => goPillar(k)} style={{ color: P.color }}>Ver módulo →</button>
              </div>
              {list.map((h) => <HabitRow key={h.id} habit={h} done={today[h.id]} onToggle={toggle} />)}
            </div>
          );
        })}
      </section>
    </>
  );
}

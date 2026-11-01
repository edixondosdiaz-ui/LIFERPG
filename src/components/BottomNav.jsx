const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'pilares', label: 'Pilares', icon: '⚡' },
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'perfil', label: 'Perfil', icon: '⚙️' },
];

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
          <span className="ni">{t.icon}</span>{t.label}
        </button>
      ))}
    </nav>
  );
}

// Fuente única del piloto: Tailwind y componentes SVG comparten estos tokens.
export const tokens = {
  colors: {
    background: { violet: '#100c22', midnight: '#071527' },
    surface: { DEFAULT: '#201b35', raised: '#29223f', inset: '#17182d' },
    text: { primary: '#f8f7ff', secondary: '#b9b4ce' },
    border: { DEFAULT: '#716a8f', glass: 'rgba(224,212,255,.13)' },
    brand: { DEFAULT: '#a855f7', light: '#dab8ff', dark: '#7431b6', pressed: '#592096' },
    success: '#8ee0b2', warning: '#f3ce8b', error: '#ffb2c1', errorStrong: '#972c45',
    strength: '#ffaaa8', health: '#76e4b0', education: '#8cdbff', finance: '#f5ce75',
    hydration: '#8cdbff', sleep: '#b9b5ff', nutrition: '#ffc195', protein: '#ffb2c1', carbs: '#f5ce75', fat: '#9fc6ff',
    fire: { light: '#ffd18a', warm: '#ff975c', ink: '#32180d', idle: '#716a8f' },
    grid: 'rgba(224,212,255,.10)', track: 'rgba(224,212,255,.12)', clear: 'transparent',
    soft: 'rgba(224,212,255,.05)', subtle: 'rgba(224,212,255,.03)',
    achievement: { idle: 'rgba(224,212,255,.02)', done: 'rgba(245,206,117,.16)', progress: 'rgba(168,85,247,.20)' },
  },
  backgrounds: {
    world: 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(168,85,247,.14), transparent 75%), linear-gradient(155deg, #100c22 0%, #111228 45%, #071527 100%)',
    surface: 'linear-gradient(145deg, rgba(224,212,255,.045), rgba(224,212,255,.005))',
    hero: 'radial-gradient(ellipse at 95% 0%, rgba(168,85,247,.18), transparent 65%), linear-gradient(135deg, #29223f, #201b35)',
    header: 'linear-gradient(115deg, #29223f, #17182d)',
  },
  shadows: {
    card: '0 18px 40px -22px rgba(3,4,18,.85), inset 0 1px 0 rgba(255,255,255,.05)',
    hero: '0 22px 48px -25px rgba(0,0,0,.8)',
    button: '0 8px 24px -10px rgba(116,49,182,.65)',
    nav: '0 12px 36px -14px rgba(3,4,18,.8)',
    selected: 'inset 0 0 0 1px rgba(168,85,247,.28)',
    swatch: '0 0 0 3px rgba(168,85,247,.85)',
  },
  radii: { card: '24px', hero: '28px', button: '16px', small: '12px' },
  spacing: { header: '84px' },
  dropShadows: { fire: '0 0 4px rgba(255,151,92,.25)' },
  motion: { duration: '180ms', enter: '220ms', press: '.98' },
  blur: { glass: '6px' },
  fonts: { display: ['Plus Jakarta Sans Variable','system-ui','sans-serif'], body: ['Inter Variable','system-ui','sans-serif'] },
}

// Colores de ilustración ya guardados en perfiles: se conservan sin cambiar el contrato SQL.
export const avatarTokens = {
  skin: ['#f6d7bd','#ecbf98','#d29a6c','#b27849','#8a5733','#5d3a22','#fbe6d4','#40291f'],
  hair: ['#14100d','#3a2515','#6b4423','#a5773f','#d9b66a','#cfcfd2','#7c3aed','#be3b45'],
  eyes: ['#2b1d12','#5b3a1c','#2f6f4f','#3b6ea8','#6b7280','#9a683b'],
  shirt: ['#2d2a45','#8b91a5','#111827','#7c4a1d'],
  aesthetics: {
    atleta: {label:'Atleta',bg:['#2a1b4d','#0f0b1c'],shirt:'#2d2a45',accent:'#a855f7'},
    minimal: {label:'Minimal',bg:['#2b2f3a','#12141b'],shirt:'#8b91a5',accent:'#e5e7eb'},
    noche: {label:'Noche',bg:['#10243a','#070d16'],shirt:'#111827',accent:'#38bdf8'},
    solar: {label:'Solar',bg:['#4a2a12','#170d06'],shirt:'#7c4a1d',accent:'#e6b43c'},
  },
  ink: {white:'#ffffff',sclera:'#f8fafc',pupil:'#0b0b0f',brow:'#8b8b92',watch:'#0b1220',watchFace:'#1f2937',metal:'#e5e7eb',gold:'#e6b43c'},
}
export const palette = tokens.colors
export const pillarThemes = {
  fuerza: { color: palette.strength, classes: 'pillar-strength' },
  vitalidad: { color: palette.health, classes: 'pillar-health' },
  intelecto: { color: palette.education, classes: 'pillar-education' },
  finanzas: { color: palette.finance, classes: 'pillar-finance' },
}

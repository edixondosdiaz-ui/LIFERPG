import { useId } from 'react'
import { AESTHETICS, normalizeAvatar } from '../lib/avatar'

// Dibuja el avatar. `equipped` = lista de data{} de objetos de tienda equipados.
// view: 'head' (listas) · 'bust' (tarjetas) · 'full' (editor / perfil)
const VIEWBOX = { head: '34 4 132 132', bust: '20 6 160 160', full: '0 0 200 250' }

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, v + amt))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`
}

function Face({ shape, ...p }) {
  if (shape === 'redondo') return <ellipse cx="100" cy="80" rx="38" ry="38" {...p} />
  if (shape === 'alargado') return <ellipse cx="100" cy="80" rx="30" ry="46" {...p} />
  if (shape === 'cuadrado') return <rect x="65" y="38" width="70" height="82" rx="24" {...p} />
  return <ellipse cx="100" cy="80" rx="34" ry="42" {...p} />
}

export default function Avatar({ avatar, equipped = [], size = 96, view = 'bust', rounded = true, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const a = normalizeAvatar(avatar)
  const aes = AESTHETICS[a.aesthetic] || AESTHETICS.atleta
  const item = (slot) => equipped.find((e) => e?.slot === slot)
  const top = item('top'), face = item('face'), back = item('back'), wrist = item('wrist')
  const frame = item('frame'), fx = item('fx')
  const full = view === 'full'
  const skinDark = shade(a.skin, -28)
  const shirt = top?.color || aes.shirt
  const accent = top?.accent || aes.accent
  const hair = a.hairColor
  const faceTop = a.face === 'alargado' ? 34 : a.face === 'redondo' ? 42 : 38
  const ratio = full ? 200 / 250 : 1

  return (
    <svg viewBox={VIEWBOX[view]} width={size * (full ? ratio : 1)} height={size} className={className}
      style={{ borderRadius: rounded ? (view === 'head' ? '50%' : 28) : 0, display: 'block' }} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={aes.bg[0]} /><stop offset="1" stopColor={aes.bg[1]} /></linearGradient>
        <radialGradient id={`fx${uid}`}><stop offset="0" stopColor={fx?.color || '#a855f7'} stopOpacity=".55" /><stop offset="1" stopColor={fx?.color || '#a855f7'} stopOpacity="0" /></radialGradient>
        <linearGradient id={`fr${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={frame?.color || '#fff'} /><stop offset="1" stopColor={frame?.color2 || frame?.color || '#fff'} /></linearGradient>
        <clipPath id={`face${uid}`}><Face shape={a.face} /></clipPath>
        <clipPath id={`shirt${uid}`}><path d={full ? 'M62 166 C70 146 86 140 100 140 C114 140 130 146 138 166 L142 246 L58 246Z' : 'M34 200 C40 150 70 138 100 138 C130 138 160 150 166 200Z'} /></clipPath>
      </defs>

      <rect x="-50" y="-10" width="300" height="300" fill={`url(#bg${uid})`} />
      {fx && <circle cx="100" cy="90" r="95" fill={`url(#fx${uid})`} />}
      {fx?.style === 'sparks' && [[40, 60], [160, 50], [30, 120], [170, 110], [60, 24], [140, 28]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6 + (i % 3) * 0.6} fill={fx.color} opacity=".85" />
      ))}

      {/* mochila (detrás del cuerpo) */}
      {back && <>
        <rect x="52" y="128" width="96" height="76" rx="22" fill={shade(back.color, -20)} />
        <rect x="64" y="176" width="72" height="22" rx="8" fill={shade(back.color, 14)} />
      </>}

      {/* pelo trasero */}
      {a.hair === 'largo' && <path d="M62 70 C56 118 58 150 68 168 L92 150 L92 80Z M138 70 C144 118 142 150 132 168 L108 150 L108 80Z" fill={hair} />}
      {a.hair === 'rizado' && <g fill={hair}><circle cx="62" cy="86" r="11" /><circle cx="138" cy="86" r="11" /><circle cx="66" cy="104" r="8" /><circle cx="134" cy="104" r="8" /></g>}

      {/* cuerpo */}
      {full && <>
        <path d="M70 168 L52 178 C40 184 38 196 40 214 L44 232 L60 232 L62 206 L70 190Z" fill={a.skin} />
        <path d="M130 168 L148 178 C160 184 162 196 160 214 L156 232 L140 232 L138 206 L130 190Z" fill={a.skin} />
        <rect x="44" y="224" width="16" height="20" rx="8" fill={a.skin} />
        <rect x="140" y="224" width="16" height="20" rx="8" fill={a.skin} />
      </>}
      <rect x="86" y="108" width="28" height="30" rx="10" fill={skinDark} />
      <path d={full ? 'M62 166 C70 146 86 140 100 140 C114 140 130 146 138 166 L142 246 L58 246Z' : 'M34 200 C40 150 70 138 100 138 C130 138 160 150 166 200Z'} fill={shirt} />
      {top?.style === 'hoodie' && <>
        <path d="M76 142 C84 156 116 156 124 142 C118 138 82 138 76 142Z" fill={shade(shirt, -22)} />
        <path d="M97 152 L97 176 M103 152 L103 176" stroke={shade(shirt, 40)} strokeWidth="1.6" strokeLinecap="round" />
      </>}
      {top?.style === 'armor' && <>
        <path d="M70 146 L100 160 L130 146 L130 190 L70 190Z" fill={shade(shirt, 14)} />
        <path d="M100 160 L100 190" stroke={accent} strokeWidth="2.4" /><path d="M72 150 L100 163 L128 150" stroke={accent} strokeWidth="2.4" fill="none" />
      </>}
      {top?.style === 'uniform' && <g clipPath={`url(#shirt${uid})`}>
        <path d="M30 176 L170 176" stroke={accent} strokeWidth="5" /><path d="M30 188 L170 188" stroke={accent} strokeWidth="2" />
      </g>}
      {(!top || top.style === 'tee') && <path d="M84 140 C92 152 108 152 116 140" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {back && <>
        <path d="M74 144 L70 200 M126 144 L130 200" stroke={shade(back.color, 22)} strokeWidth="7" strokeLinecap="round" />
      </>}
      {/* reloj */}
      {full && wrist && <g>
        <rect x="139" y="212" width="20" height="9" rx="4" fill={wrist.color} />
        <rect x="143" y="210" width="12" height="13" rx="3" fill={wrist.style === 'pulse' ? '#0b1220' : '#1f2937'} stroke={wrist.color} strokeWidth="1.6" />
        <circle cx="149" cy="216.5" r="1.8" fill={wrist.style === 'pulse' ? wrist.color : '#e5e7eb'} />
      </g>}

      {/* orejas */}
      <ellipse cx={a.face === 'redondo' ? 62 : 65} cy="84" rx="5" ry="8" fill={a.skin} />
      <ellipse cx={a.face === 'redondo' ? 138 : 135} cy="84" rx="5" ry="8" fill={a.skin} />
      {a.accessory === 'aro' && <circle cx={a.face === 'redondo' ? 61 : 64} cy="95" r="3" fill="none" stroke="#e6b43c" strokeWidth="1.6" />}

      {/* rostro */}
      <Face shape={a.face} fill={a.skin} />
      <g clipPath={`url(#face${uid})`}>
        <ellipse cx="100" cy="125" rx="46" ry="14" fill={skinDark} opacity=".28" />
        {a.beard === 'sombra' && <path d="M60 86 L140 86 L140 130 L60 130Z" fill={hair} opacity=".22" />}
        {a.beard === 'corta' && <path d="M60 92 C66 100 76 100 84 100 C92 106 108 106 116 100 C124 100 134 100 140 92 L140 130 L60 130Z" fill={hair} opacity=".92" />}
        {a.beard === 'completa' && <path d="M58 82 C62 96 72 98 80 100 C90 94 110 94 120 100 C128 98 138 96 142 82 L146 136 L54 136Z" fill={hair} />}
      </g>
      {(a.beard === 'corta' || a.beard === 'completa') && <path d="M90 107 C96 110 104 110 110 107" stroke={shade(a.skin, -50)} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {(a.beard === 'ninguna' || a.beard === 'sombra') && <path d="M91 106 C96 110 104 110 109 106" stroke={shade(a.skin, -55)} strokeWidth="2" fill="none" strokeLinecap="round" />}

      {/* ojos y cejas */}
      <g>
        <ellipse cx="86" cy="80" rx="5.6" ry="4" fill="#f8fafc" /><ellipse cx="114" cy="80" rx="5.6" ry="4" fill="#f8fafc" />
        <circle cx="86" cy="80" r="2.9" fill={a.eyes} /><circle cx="114" cy="80" r="2.9" fill={a.eyes} />
        <circle cx="86" cy="80" r="1.1" fill="#0b0b0f" /><circle cx="114" cy="80" r="1.1" fill="#0b0b0f" />
        <path d="M78 71 C83 68 90 68 94 71 M106 71 C110 68 117 68 122 71" stroke={hair === '#cfcfd2' ? '#8b8b92' : hair} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M100 82 L98 94 C99 96 101 96 102 94" stroke={shade(a.skin, -32)} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>

      {/* gafas de tienda */}
      {face?.style === 'round' && <g fill="none" stroke={face.color} strokeWidth="2.2"><circle cx="86" cy="80" r="10" /><circle cx="114" cy="80" r="10" /><path d="M96 80 L104 80 M76 80 L66 77 M124 80 L134 77" /></g>}
      {face?.style === 'sport' && <g><path d="M70 72 H130 L127 86 C124 92 106 92 102 86 L100 84 L98 86 C94 92 76 92 73 86Z" fill={face.color} opacity=".9" /><path d="M72 74 H128" stroke={face.accent} strokeWidth="1.8" /></g>}

      {/* pelo frontal */}
      {a.hair === 'rapado' && <path d="M65 70 C64 44 82 34 100 34 C118 34 136 44 135 70 C128 56 116 50 100 50 C84 50 72 56 65 70Z" fill={hair} opacity=".55" />}
      {a.hair === 'corto' && <path d="M62 74 C58 40 80 26 100 26 C122 26 142 40 138 74 C132 58 120 50 100 50 C80 50 68 58 62 74Z" fill={hair} />}
      {a.hair === 'texturizado' && <g fill={hair}><path d="M62 74 C56 38 80 24 102 24 C124 24 144 40 138 74 C132 58 120 50 100 50 C80 50 68 58 62 74Z" /><path d="M72 36 L80 22 L88 34 L98 18 L106 33 L118 20 L122 36Z" /></g>}
      {a.hair === 'largo' && <path d="M60 80 C54 36 80 24 100 24 C122 24 146 38 140 80 C136 60 124 48 108 46 C92 50 70 56 60 80Z" fill={hair} />}
      {a.hair === 'rizado' && <g fill={hair}><circle cx="72" cy="46" r="14" /><circle cx="90" cy="36" r="15" /><circle cx="112" cy="36" r="15" /><circle cx="130" cy="48" r="14" /><circle cx="100" cy="46" r="16" /></g>}
      {a.hair === 'monio' && <g fill={hair}><circle cx="100" cy="16" r="12" /><path d="M62 74 C58 40 80 28 100 28 C122 28 142 40 138 74 C132 58 120 50 100 50 C80 50 68 58 62 74Z" /></g>}

      {/* accesorios base */}
      {a.accessory === 'cinta' && <path d={`M${a.face === 'cuadrado' ? 65 : 64} ${faceTop + 18} C80 ${faceTop + 8} 120 ${faceTop + 8} ${a.face === 'cuadrado' ? 135 : 136} ${faceTop + 18} L${a.face === 'cuadrado' ? 135 : 136} ${faceTop + 27} C120 ${faceTop + 17} 80 ${faceTop + 17} ${a.face === 'cuadrado' ? 65 : 64} ${faceTop + 27}Z`} fill={aes.accent} />}
      {a.accessory === 'audifonos' && <g fill="none" stroke="#e5e7eb" strokeWidth="5" strokeLinecap="round"><path d="M64 84 C58 30 142 30 136 84" /><rect x="58" y="78" width="10" height="20" rx="5" fill="#e5e7eb" stroke="none" /><rect x="132" y="78" width="10" height="20" rx="5" fill="#e5e7eb" stroke="none" /></g>}

      {/* marco */}
      {frame && (() => {
        const [vx, vy, vw, vh] = VIEWBOX[view].split(' ').map(Number)
        const sw = view === 'head' ? 6 : 7
        return <rect x={vx + sw / 2} y={vy + sw / 2} width={vw - sw} height={vh - sw} rx={view === 'head' ? vw / 2 : 26}
          fill="none" stroke={`url(#fr${uid})`} strokeWidth={sw} />
      })()}
    </svg>
  )
}

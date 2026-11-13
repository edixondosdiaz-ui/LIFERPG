import { useState } from 'react'
import OwnedAvatarItems from './OwnedAvatarItems'
import Avatar from './Avatar'
import { haptic } from '../lib/ui'
import {
  AESTHETICS, BEARDS, EYE_COLORS, FACES, HAIRS, HAIR_COLORS, SKINS, SHIRT_COLORS, normalizeAvatar, randomAvatar,
} from '../lib/avatar'

const TABS = [
  { id: 'rostro', label: 'Rostro' },
  { id: 'pelo', label: 'Cabello' },
  { id: 'ojos', label: 'Ojos' },
  { id: 'barba', label: 'Barba' },
  { id: 'estetica', label: 'Ropa base' },
]

function Swatches({ colors, value, onPick }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {colors.map((c) => (
        <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => onPick(c)}
          className={`h-10 w-10 rounded-full border-2 transition active:scale-press ${value === c ? 'border-white shadow-swatch' : 'border-white/15'}`}
          style={{ background: c }} />
      ))}
    </div>
  )
}

function Chips({ options, value, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onPick(o.id)}
          className={`rounded-2xl border px-3.5 py-2.5 text-[13px] font-bold transition active:scale-press ${value === o.id ? 'border-pu bg-pu/20 text-pu-light' : 'border-white/[.08] bg-white/[.04] text-sub hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const Group = ({ title, children }) => (
  <div className="space-y-2.5"><p className="text-xs font-bold text-sub">{title}</p>{children}</div>
)

// Editor con vista previa en vivo. `equipped` = objetos de tienda ya equipados (se ven en la previa).
export default function AvatarEditor({ value, onChange, equipped = [], canShop = false }) {
  const [tab, setTab] = useState('rostro')
  const a = normalizeAvatar(value)
  const set = (k) => (v) => { haptic(); onChange({ ...a, [k]: v }) }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto grid place-items-center overflow-hidden rounded-hero border border-white/[.08] bg-card py-4">
        <Avatar avatar={a} equipped={equipped} view="full" size={250} rounded />
      </div>
      <button type="button" className="w-full rounded-2xl border border-pu/30 py-3 text-sm font-bold text-pu-light" onClick={() => onChange(randomAvatar())}>Aleatorio</button>
      <p className="text-xs text-sub">Los rasgos base se pueden editar gratis. Los objetos equipados se muestran encima de la ropa y peinado base.</p>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => { haptic(4); setTab(t.id) }}
            className={`flex-none rounded-full px-4 py-2 text-[13px] font-bold transition active:scale-press ${tab === t.id ? 'bg-gradient-to-b from-pu-dark to-pu-pressed text-white' : 'bg-white/[.05] text-sub'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="surface min-h-[170px] space-y-5 p-4">
        {tab === 'rostro' && <>
          <Group title="Forma del rostro"><Chips options={FACES} value={a.face} onPick={set('face')} /></Group>
          <Group title="Tono de piel"><Swatches colors={SKINS} value={a.skin} onPick={set('skin')} /></Group>
        </>}
        {tab === 'pelo' && <>
          <Group title="Peinado"><Chips options={HAIRS} value={a.hair} onPick={set('hair')} /></Group>
          <Group title="Color de cabello"><Swatches colors={HAIR_COLORS} value={a.hairColor} onPick={set('hairColor')} /></Group>
        </>}
        {tab === 'ojos' && <Group title="Color de ojos"><Swatches colors={EYE_COLORS} value={a.eyes} onPick={set('eyes')} /></Group>}
        {tab === 'barba' && <Group title="Barba"><Chips options={BEARDS} value={a.beard} onPick={set('beard')} /></Group>}
        {tab === 'estetica' && <><Group title="Color de ropa base"><Swatches colors={SHIRT_COLORS} value={a.shirtColor} onPick={set('shirtColor')} /></Group><Group title="Estética general">
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(AESTHETICS).map(([id, e]) => (
              <button key={id} type="button" onClick={() => set('aesthetic')(id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-bold transition active:scale-press ${a.aesthetic === id ? 'border-pu bg-pu/15' : 'border-white/[.08] bg-white/[.03]'}`}>
                <span className="h-9 w-9 flex-none rounded-xl" style={{ background: `linear-gradient(135deg, ${e.bg[0]}, ${e.accent})` }} />
                {e.label}
              </button>
            ))}
          </div>
        </Group></>}
      </div>
      {canShop && <OwnedAvatarItems />}
    </div>
  )
}

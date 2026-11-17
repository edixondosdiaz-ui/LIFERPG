import { Link } from 'react-router-dom'
import { LEGAL_DOCUMENTS } from '../lib/legalContent'
import { LEGAL_VERSION } from '../lib/registration'

export default function LegalDocument({kind}){
  const document=LEGAL_DOCUMENTS[kind]
  return <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-5 py-8 text-ink">
    <header className="space-y-3"><h1 className="text-2xl font-extrabold">{document.title}</h1><p className="text-xs text-sub">Versión {LEGAL_VERSION} · 16 de noviembre de 2026</p><p className="text-sm text-sub">Los datos entre corchetes están pendientes de completar por el responsable de LifeRPG.</p><nav className="flex flex-wrap gap-3" aria-label="Documentos legales"><Link to="/terminos" className="pilot-secondary">Términos</Link><Link to="/privacidad" className="pilot-secondary">Privacidad</Link></nav></header>
    {document.sections.map(([title,...paragraphs])=><section key={title} className="surface space-y-3 p-5"><h2 className="text-lg font-bold">{title}</h2>{paragraphs.map((paragraph,i)=><p key={i} className="break-words text-sm leading-relaxed text-sub">{paragraph}</p>)}</section>)}
    <section className="surface space-y-3 p-5"><h2 className="font-bold">Referencia normativa</h2><a href="https://cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm text-pu-light underline">Ley 1581 de 2012 · fuente oficial</a><p className="text-sm text-sub">Si abriste esta página desde el registro, cierra esta pestaña para volver: lo que escribiste sigue en la pestaña original.</p><Link to="/" className="pilot-secondary w-full">Volver al acceso</Link></section>
  </main>
}

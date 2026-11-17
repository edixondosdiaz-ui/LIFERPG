import Tutorial from './pages/Tutorial'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Strength from './pages/Strength'
import Habits from './pages/Habits'
import Salud, { HealthView } from './pages/Salud'
import Educacion, { EducationView } from './pages/Educacion'
import Finanzas, { FinanceView } from './pages/Finanzas'
import Pilares from './pages/Pilares'
import Ranking from './pages/Ranking'
import Perfil from './pages/Perfil'
import Amigos from './pages/Amigos'
import FriendProfile from './pages/FriendProfile'
import Onboarding from './pages/Onboarding'
import Progreso from './pages/Progreso'
import Tienda from './pages/perfil/Tienda'
import Ajustes from './pages/perfil/Ajustes'
import Recovery from './pages/Recovery'
import Premium from './pages/Premium'
import Running from './pages/Running'
import LegalDocument from './pages/LegalDocument'

// Si no hay sesión muestra el login; si la hay, muestra la app con su menú
function Gate() {
  const { user, profile, loading } = useAuth()
  if (loading) return <p className="p-6 text-center text-slate-400">Cargando…</p>
  if (!user) return <Auth />
  // Registro paso 2 y 3: usuario único + versión futura
  if (!profile?.onboarding_completed) return <Onboarding />
  if(profile?.tutorial_seen===false)return <Tutorial onboarding/>
  return <Layout />
}

function TutorialRoute(){const {user,profile,loading}=useAuth();if(loading)return <p className="p-6 text-sub">Cargando…</p>;if(!user || !profile?.onboarding_completed)return <Navigate to="/" replace/>;return <Tutorial onboarding={profile?.tutorial_seen===false}/>}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="tutorial" element={<TutorialRoute/>}/>
        <Route path="terminos" element={<LegalDocument kind="terminos" />} />
        <Route path="privacidad" element={<LegalDocument kind="privacidad" />} />
        <Route path="recuperar" element={<Recovery />} />
        <Route path="restablecer" element={<Recovery reset />} />
        <Route element={<Gate />}>
          <Route index element={<Dashboard />} />
          <Route path="pilares" element={<Pilares />} />
          <Route path="pilares/fuerza" element={<Strength />} />
          <Route path="pilares/salud" element={<Salud/>}><Route index element={<Navigate to="correr" replace/>}/>{['correr','hidratacion','sueno'].map(view=><Route key={view} path={view} element={<HealthView view={view}/>}/>)}</Route>
          <Route path="pilares/educacion" element={<Educacion/>}><Route index element={<Navigate to="estudiar" replace/>}/>{['estudiar','tareas','progreso'].map(view=><Route key={view} path={view} element={<EducationView view={view}/>}/>)}</Route>
          <Route path="pilares/finanzas" element={<Finanzas/>}><Route index element={<Navigate to="movimientos" replace/>}/>{['movimientos','historial','resumen','metas','deudas'].map(view=><Route key={view} path={view} element={<FinanceView view={view}/>}/>)}</Route>
          <Route path="pilares/habitos" element={<Habits />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="progreso" element={<Progreso />} />
          <Route path="tienda" element={<Tienda />} />
          <Route path="configuracion" element={<Ajustes />} />
          <Route path="premium" element={<Premium />} />
          <Route path="amigos" element={<Amigos />} />
          <Route path="u/:username" element={<FriendProfile />} />
          <Route path="perfil/:tab?" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

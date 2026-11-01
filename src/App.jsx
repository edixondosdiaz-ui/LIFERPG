import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Strength from './pages/Strength'
import Habits from './pages/Habits'
import Salud from './pages/Salud'
import Educacion from './pages/Educacion'
import Finanzas from './pages/Finanzas'
import Pilares from './pages/Pilares'
import Ranking from './pages/Ranking'
import Perfil from './pages/Perfil'
import Amigos from './pages/Amigos'
import FriendProfile from './pages/FriendProfile'
import Onboarding from './pages/Onboarding'

// Si no hay sesión muestra el login; si la hay, muestra la app con su menú
function Gate() {
  const { user, profile, loading } = useAuth()
  if (loading) return <p className="p-6 text-center text-slate-400">Cargando…</p>
  if (!user) return <Auth />
  // Registro paso 2 y 3: usuario único + versión futura
  if (!profile?.onboarding_completed) return <Onboarding />
  return <Layout />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Gate />}>
          <Route index element={<Dashboard />} />
          <Route path="pilares" element={<Pilares />} />
          <Route path="pilares/fuerza" element={<Strength />} />
          <Route path="pilares/salud" element={<Salud />} />
          <Route path="pilares/educacion" element={<Educacion />} />
          <Route path="pilares/finanzas" element={<Finanzas />} />
          <Route path="pilares/habitos" element={<Habits />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="amigos" element={<Amigos />} />
          <Route path="u/:username" element={<FriendProfile />} />
          <Route path="perfil/:tab?" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

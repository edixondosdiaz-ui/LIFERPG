import { Navigate, useParams } from 'react-router-dom'
import Resumen from './perfil/Resumen'

export default function Perfil() {
  const { tab } = useParams()
  const legacy = { logros: '/progreso', tienda: '/tienda', ajustes: '/configuracion' }
  if (legacy[tab]) return <Navigate to={legacy[tab]} replace />
  return <Resumen />
}

# LifeRPG

PWA gamificada de hábitos y fuerza (React + Vite + TailwindCSS + Supabase).

## Cómo correrlo

```bash
npm install
npm run dev
```

Necesitas `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Base de datos (orden de ejecución en Supabase → SQL Editor)

1. `supabase/01_modulos.sql` (ya ejecutado en tu proyecto)
2. `supabase/02_liferpg_v2.sql` — usuario único, avatar, amigos, logros, tienda/inventario, ranking por usuario y tablas de Finanzas/Educación/Salud. Es idempotente.

## Flujo de registro

1. `Auth.jsx` — correo + contraseña
2. `Onboarding.jsx` paso 1 — nombre de usuario único (+ nombre visible opcional)
3. `Onboarding.jsx` paso 2 — "Crea tu versión futura" (editor de avatar en vivo)
4. Resumen → `complete_onboarding()` guarda todo y regala 150 monedas

## Estado

- Todo se persiste en Supabase; la app ya no usa `localStorage`.
- Cerrar sesión: Perfil → Configuración.
- Pendiente: módulos de Salud, Educación y Finanzas (las tablas ya existen), pagos reales en la tienda, fotos de evidencia, notificaciones.

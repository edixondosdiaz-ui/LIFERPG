# Aplicación manual · Fases 1 y 2

Rama: `codex/fases-1-2`. El código depende del esquema que ya usa la app y de `03_pilares.sql`.

## Orden

1. En Supabase → SQL Editor, ejecutar **una vez** `supabase/04_hoy_perfil.sql`, después de las migraciones que ya tiene el proyecto. Este archivo agrega tablas, índices, políticas, un trigger y RPC; no actualiza ni elimina registros existentes al aplicarlo. No se ejecutó durante la implementación.
2. Desplegar los cambios de esta rama. No hace falta volver a ejecutar los scripts anteriores si ya están aplicados.
3. Configurar recuperación de contraseña como se indica abajo y hacer las verificaciones manuales.

## Supabase Auth

1. Authentication → URL Configuration → **Site URL**: `https://liferpg-blush.vercel.app`.
2. Agregar estas **Redirect URLs**:
   - `https://liferpg-blush.vercel.app/restablecer`
   - `http://localhost:5173`
   - `http://localhost:5173/restablecer`
3. Authentication → Email Templates → Reset Password: asunto `Restablece tu contraseña de LifeRPG` y cuerpo, por ejemplo:

   ```html
   <h2>Restablece tu contraseña</h2>
   <p>Recibimos una solicitud para cambiar tu contraseña de LifeRPG.</p>
   <p><a href="{{ .ConfirmationURL }}">Crear una nueva contraseña</a></p>
   <p>Si no fuiste tú, ignora este correo.</p>
   ```

4. Configurar SMTP propio y un remitente verificado antes de producción. Probar entrega, spam, enlace válido, vencido y reutilizado. El mensaje de solicitud es genérico para evitar revelar cuentas.

Referencias: [recuperación](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls), [plantillas](https://supabase.com/docs/guides/auth/auth-email-templates).

## Decisiones y límites

- Los valores de interfaz están en `src/lib/product.js`: Pomodoro 25/5, descanso entre series de 90 s y meta inicial de agua de 2 L. El servidor establece esa meta inicial mediante `log_water_quick`; conserva los objetivos existentes. El cupo inicial de un cambio de usuario se configura en `app_product_settings` dentro del SQL. Las fórmulas de XP siguen en las RPC existentes.
- Los temporizadores de entrenamiento, enfoque y descanso se guardan en Supabase. Recargar recupera su estado. En enfoque, las pausas no cuentan y el Pomodoro limita el tiempo recompensado a su duración configurada. Al completar, comienza un descanso; el siguiente bloque se inicia manualmente. El registro manual de estudio admite minutos declarados por el usuario.
- El resumen de entrenamiento cuenta volumen y ejercicios con récord de peso desde el inicio; el XP mostrado corresponde al incremento de Fuerza durante ese periodo, incluyendo otras pestañas de la misma cuenta.
- Progreso muestra actividad agrupada por fecha y pilar de los últimos 90 días; los resúmenes semanal y mensual usan los periodos actuales. Las rachas por pilar se calculan en esa ventana; la racha general consulta todo el historial. Las estadísticas de Perfil son de por vida.
- La privacidad controla el perfil completo: por defecto solo amigos. Usuario, avatar y XP continúan visibles en el ranking existente. No se exponen correos ni ubicación de otros usuarios.
- Unidades y permisos de recordatorios se guardan por usuario. Los recordatorios funcionan con la app abierta y permiso del navegador; push con la app cerrada, Premium, términos y política de privacidad muestran **Disponible pronto**. Hace falta publicar los textos legales propios antes de lanzar el producto.
- El botón de eliminación llama una RPC que elimina realmente al usuario de Auth y sus registros por las llaves foráneas existentes con cascada. El SQL solo define esa función; no elimina cuentas al ejecutarse. La interfaz exige escribir `ELIMINAR`.
- Los módulos activos dejaron de usar localStorage para sus temporizadores. No se alteraron los archivos antiguos de la app local que no importa `src/main.jsx`.

## Verificación manual pendiente

No se probaron las RPC, RLS ni los flujos de navegador con cuentas reales, porque la nueva migración debe aplicarla el dueño.

- Con una cuenta de prueba: login, onboarding existente, cierre de sesión, menú, rutas nuevas y enlaces antiguos de Perfil.
- Hoy: agua en un toque; rutina y Pomodoro activos al entrar; movimiento financiero con monto, tipo y guardar.
- Fuerza: precarga de última sesión, repetir serie, descanso automático, edición por día, notas/RPE opcionales, resumen y recarga del cronómetro. Comparar XP con los resultados de las RPC.
- Educación: pausa/reanudación, recarga, fin automático, descanso sin XP, registro manual, última categoría, tareas, horas e historial. Abrir dos pestañas y comprobar que no se guarda dos veces el mismo temporizador.
- Salud: agua, metas existentes, sueño cruzando medianoche, alimentación y bienestar 1–10, tendencias y preferencias de notificaciones.
- Finanzas: ingreso/gasto/ahorro, categorías recientes, movimientos periódicos, metas, gráficos e historial.
- Perfil: posiciones, tres logros destacados, progreso completo, cambio de nombre y agotamiento del cupo; avatar e inventario existentes.
- Con dos cuentas: una no puede leer ni editar preferencias, bienestar, temporizadores o cambios de nombre de la otra. Verificar perfil público y solo amigos.
- Recuperación: mensaje genérico, espera de 60 s, enlace válido, vencido, usado, contraseñas diferentes y mínimo de ocho caracteres.
- Eliminación: verificar únicamente con una cuenta desechable que ya no exista en Authentication ni en sus tablas relacionadas.

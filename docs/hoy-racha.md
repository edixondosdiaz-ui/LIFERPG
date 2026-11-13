# Cabecera y racha de Hoy

La cabecera mide 84 px y concentra identidad, saludo, nivel y anillo de XP. El menú del perfil y el acceso a monedas conservan sus rutas. Se retiraron el objetivo diario, el enlace de hábitos rápidos y el antiguo hero; las consultas de actividad de los pilares siguen siendo necesarias.

Aplicar manualmente `supabase/09_hoy_racha_habitos.sql` completo en el editor SQL. Agrega únicamente `my_habit_week()`, disponible para usuarios autenticados, que filtra siempre por `auth.uid()`. No cambia tablas, registros, XP ni políticas existentes. Requiere las migraciones anteriores y `app_today()` (America/Bogota).

La semana va de lunes a domingo. Cuenta días distintos de `habit_logs.performed_at`; varios hábitos en una fecha cuentan como un día. La racha sigue vigente si el último día es hoy o ayer; se rompe si es anterior. No incluye entrenamientos ni registros de agua de otras tablas. Los días futuros nunca se iluminan.

Después de `logHabit` se vuelve a consultar sin recargar. También consulta al regresar a la pestaña, con Realtime si está disponible y cada 30 segundos mientras está visible (incluido cambio de fecha). No requiere habilitar nuevas publicaciones ni guarda datos en el navegador.

Verificación manual pendiente con una cuenta real:
- Sin registros: siete fuegos grises y racha 0.
- Tocar hoy → Registrar un hábito → completarlo → volver a Hoy: fuego cálido y detalle con el hábito.
- Registrar otro hábito hoy: aumenta el detalle, no los días consecutivos.
- Revisar fechas alrededor de medianoche de Bogotá y cambio de semana, sin heredar racha de actividad de otros pilares.
- Abrir/cerrar detalle con teclado y revisar menú, monedas y avatar a 360 y 430 px.

Vista de desarrollo sin datos personales: `/__visual?compact=1`.

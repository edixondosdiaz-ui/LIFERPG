# Fuerza: registro diario y migración 15

Aplicar **15_fuerza_registro_diario.sql completo**, después de 14, desde `begin` hasta `commit`. No fue ejecutado por el agente. Desplegar el frontend después de aplicar el SQL; la nueva pantalla necesita los RPC nuevos. No volver a ejecutar migraciones antiguas para actualizar esta versión: podrían restaurar funciones anteriores.

## Respaldo previo (a cargo del dueño)

Respaldar estructura, datos, funciones, vistas, permisos y políticas del esquema `public`. Como mínimo, conservar estas tablas: `workout_sets`, `exercises`, `routines`, `routine_days`, `routine_exercises`, `routine_entry_requests`, `profiles`, `xp_claims`, `weekly_xp`, `user_achievements` e `inventory`. Si se repite la migración, incluir también `strength_day_rewards`. Conviene un respaldo completo del proyecto por las relaciones de XP, economía y ranking. Este cambio no genera ni descarga respaldos.

## Datos e historial

- Añade `deleted_at` a series y rutinas, y `series_order` a las series. No borra ni reescribe las marcas existentes al aplicar la migración.
- Las series previas conservan su orden de lectura por `created_at,id` cuando no tienen `series_order`. No se inventa una secuencia histórica cuando los timestamps coinciden.
- La asociación histórica usa `workout_sets.routine_id`; para registros anteriores sin esa columna poblada, conserva la compatibilidad existente con `exercises.routine_id`. Si ambas faltan, conserva la serie sin adjudicarla a una rutina inventada.
- Guardar un ejercicio reemplaza atómicamente las series activas de esa rutina, ejercicio y día: las versiones anteriores reciben una marca de borrado lógico y las nuevas tienen una fila por serie. Un UUID de solicitud evita duplicados tras un reintento.
- Borrar un ejercicio quita su asociación con esa rutina y marca sus series de hoy como borradas; conserva otros días. Borrar una rutina la archiva, conserva sus asociaciones y todas sus marcas, y libera una plaza del plan.
- La última sesión se interpreta como el último día anterior con series activas de **esa misma rutina**, no necesariamente la semana anterior. Varias entradas del mismo día forman una sesión diaria. La fecha sale de la base de datos en `America/Bogota`.

## Lecturas y recompensas

`active_workout_sets` filtra las series borradas incluso para las funciones `SECURITY DEFINER`. La migración actualiza `user_metrics`, `get_friend_profile`, `timer_action`, `my_activity`, `activity_days_with_protection`, `premium_trends` y las consultas de marcas/récords. Una RLS restrictiva oculta las series borradas en consultas directas del cliente; las RLS de propietario siguen aplicando. Las columnas de borrado no quedan editables desde el cliente. No se abre acceso a datos de otro usuario.

**XP: una recompensa por ejercicio y día, en el primer guardado.** Incluye 5 XP por serie del primer lote, volumen con el tope existente y bonos diarios existentes de récord/sobrecarga. Las ediciones, nuevas series posteriores o reingresos del mismo ejercicio ese día dan 0 XP. Borrar no devuelve ni descuenta XP ni libera la recompensa. Los endpoints antiguos usan el mismo registro de recompensa para impedir eludirlo. Las fechas ya presentes se consideran recompensadas al aplicar la migración, sin calcular ni conceder XP retroactivo.

El ranking por XP conserva el XP ganado: no se reconstruye desde series ni se revierte al borrar. Los contadores y el progreso de logros excluyen series borradas; logros, monedas y premios ya entregados no se revocan. Las sesiones del cronómetro son registros independientes y siguen contando como actividad si existen, aunque se borren las series.

## Verificación manual pendiente

Con una cuenta de prueba propia: guardar 50 kg con 5/4/3 reps, salir y volver; editar peso/reps; comprobar que editar/borrar/reingresar no suma XP; reintentar la misma solicitud; probar dos pestañas; revisar volumen, logros y ranking. Cambiar miércoles por martes, archivar la rutina y confirmar que sus marcas siguen en el historial de ejercicios. Probar una sesión anterior de otra rutina para comprobar que no aparece mezclada y revisar el cambio de día de Bogotá. También probar acceso cruzado entre dos cuentas: los RPC deben rechazar IDs ajenos.

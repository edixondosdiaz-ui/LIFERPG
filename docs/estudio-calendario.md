# Calendario mensual de Estudio

Reemplaza el mapa de diez semanas de Educación por una cuadrícula mensual en es-CO, con lunes primero, fechas completas en los nombres accesibles, flechas, selector de mes/año y botón «Hoy». Incluye cinco intensidades (0, 1–29, 30–59, 60–119 y 120+ minutos), leyenda y borde de hoy. Las celdas miden al menos 44 px de alto y se mantiene el contraste AA.

El calendario consulta `edu_sessions` por el intervalo del mes y pagina todos sus resultados; no usa el recorte de 90 días ni el límite de 3000 filas de las gráficas existentes. Esas gráficas, tareas y cronómetro conservan sus consultas y comportamiento. Al guardar o borrar una sesión desde Educación se vuelve a consultar el mes mostrado.

`studied_on` es un DATE guardado por `app_today()` en America/Bogota: se usa sin reinterpretarlo como medianoche UTC. La aritmética del calendario se hace a mediodía UTC. Como respaldo, un timestamp sin DATE se convierte a Bogotá. El indicador de hoy se revisa cada minuto y al recuperar el foco, sin cambiar el mes que se está explorando.

El resumen mensual cuenta fechas activas distintas, minutos guardados y la mayor racha contenida en ese mes. El detalle muestra sesiones, temas, categorías, minutos, Pomodoros guardados y XP registrado. Por «Pomodoros completados» se entienden las sesiones guardadas con `mode='pomodoro'`, incluidas las terminadas manualmente; no se infiere que hayan agotado toda la duración configurada. Sesiones sin guardar no cuentan.

## SQL manual para el XP

Aplicar completo `supabase/13_estudio_calendario.sql` después de las migraciones existentes. **No se ejecutó.** La tabla actual no guardaba el XP devuelto por el registro, así que se agrega `xp_awarded` nullable. La función `log_study_session` conserva su fórmula, bonos y respuesta y guarda ese mismo resultado únicamente en la sesión recién creada, dentro de la transacción.

No se recalcula ni actualiza ninguna sesión histórica; su XP aparece como no disponible. Si un día mezcla sesiones antiguas y nuevas, se distingue el XP conocido del faltante. Las cifras se refieren a las sesiones que siguen guardadas, no a todo el XP del perfil ni a recompensas de tareas. Borrar una sesión conserva el comportamiento previo y no revierte XP.

Se conserva la RLS de propietario y se agregan políticas restrictivas que impiden INSERT/UPDATE directos desde clientes autenticados. El registro ya usa RPC con permisos del servidor; la lectura y el borrado propios permanecen. Así el cliente no puede inventar minutos ni `xp_awarded`. No se cambian monedas, premium, nombres ni datos de otros usuarios.

Sin aplicar el SQL, el calendario muestra un error amable al consultar la columna nueva; el resto de Educación conserva sus consultas existentes. El detalle técnico va a consola.

## Verificación

Pasaron 41 pruebas locales, incluidas semanas desde lunes, febrero bisiesto, meses de seis filas, cambio de año, límites de mes, medianoche de Bogotá, XP desconocido/cero, Pomodoros, rachas y contraste de las cinco intensidades.

Vista sin datos personales a 360 × 640: celdas de 45 × 44 px, sin desbordamiento horizontal; navegación a febrero de 2024, apertura del 29, cierre con Escape y regreso al mes actual con «Hoy». También se verificó ancho de 430 px. La vista de desarrollo no consulta ni crea sesiones: `/__visual?compact=1&pantalla=estudio`.

Pendiente con cuenta real después de aplicar el SQL:
1. Navegar a meses con sesiones antiguas y verificar sus días/minutos; su XP debe figurar como no disponible.
2. Guardar una sesión manual y un Pomodoro; revisar minutos, modo, XP y resumen del día sin recargar.
3. Comprobar que el XP de una sesión nueva coincide con la respuesta de su RPC, incluidos bonos diarios/semanales, y que el perfil sigue recibiendo las recompensas habituales.
4. Borrar una sesión y verificar que desaparece del calendario. Revisar dos sesiones cerca de medianoche de Bogotá y un cambio de mes/año.
5. Con otro usuario, comprobar que no puede leer sesiones ajenas ni insertar/alterar sesiones mediante la tabla. Probar Safari móvil y teclado. No se probaron SQL/RLS ni datos reales.

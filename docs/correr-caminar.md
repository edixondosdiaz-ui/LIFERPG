# Correr / Caminar · Fase 6

Aplicar manualmente `supabase/08_correr_caminar.sql` después de `07_premium_ranking.sql` y desplegar el código de `codex/correr-caminar`. No se ejecutó SQL.

Entradas: Hoy → Salud → Correr/Caminar, o desde el módulo Salud. Elegir Caminar/Correr. Antes de solicitar ubicación se explica su finalidad; el permiso se pide únicamente al iniciar o reanudar GPS. El registro manual no pide ubicación.

## Funcionamiento y límites

- `watchPosition` usa alta precisión y cero caché. Wake Lock se solicita durante la actividad; se libera al pausar, finalizar o salir. Si el navegador no permite mantener la pantalla encendida, se avisa. Se requiere HTTPS o localhost. Referencias: [Geolocalización](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) y [Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
- El borrador se guarda cada 30 segundos en Supabase y también al pausar/finalizar. Las peticiones se serializan y conservan su secuencia al reintentar; el servidor no duplica puntos ni XP. Recuperar el borrador lo pausa y cambia su token de escritura para impedir que otra pestaña siga sobreescribiéndolo.
- Mantener la pantalla encendida. Al ocultar la app se intenta pausar/guardar, sin prometer rastreo en segundo plano. Cerrar el proceso puede perder el tramo aún no sincronizado (normalmente hasta 30 s). Sin conexión, no cerrar la pantalla: los puntos pendientes solo están en memoria y se debe reintentar. No existe respaldo en localStorage. La captura continua con pantalla apagada requiere una futura integración nativa como Capacitor.
- El reloj del servidor limita cada intervalo de guardado a 40 segundos para no contar horas con la app cerrada. Recuperar un borrador conserva solo el tiempo ya guardado. Las interrupciones largas de red pueden reducir el tiempo validable y el XP; no se garantiza modo sin conexión. Al volver a tener red, revisar y finalizar el borrador.
- Haversine calcula distancia en cliente para la estimación en vivo y de nuevo en el servidor para la métrica final. Se filtran precisión mayor de 30 m, muestras repetidas, ruido estacionario, saltos mayores de 200 m y velocidades superiores a 3 m/s caminando u 8 m/s corriendo. Un intervalo mayor de 120 s abre otro segmento y no inventa la distancia perdida. Se toman muestras cada cinco segundos y se conservan hasta 10.000 puntos por actividad.
- El resumen final dibuja los segmentos en SVG sin mapas externos. No se dibuja una línea atravesando una pausa. Unidades km/mi se obtienen de la preferencia guardada, aunque el servidor siempre registra metros y segundos.
- Reglas en `running_rules`: GPS 10 XP/km, manual 2 XP/km, máximo 100 XP diarios conjuntos y 10 XP manuales. Menos de un minuto/100 m, un promedio imposible o demasiados puntos inválidos producen cero XP y una advertencia. Los puntos rechazados no aumentan distancia. El filtro no constituye una prueba de presencia física ni detecta toda falsificación de GPS.
- Distancia/duración manuales son declaraciones del usuario, identificadas como Manual, con tope reducido. No se simula una ruta. Los resúmenes semanales/mensuales, récords y rachas incluyen esos registros; el mejor ritmo excluye registros marcados sin validez.
- Se muestran las últimas 50 actividades; los agregados se calculan con todo el historial propio. La actividad finalizada cuenta para Salud en Progreso y la racha, y el XP nuevo se integra en el ranking semanal mediante el trigger existente.
- `running_sessions` y `running_points` solo permiten lectura propia por RLS y escritura mediante RPC. Ningún perfil público, resumen de ranking o RPC de amigos entrega rutas ni coordenadas. Borrar ruta elimina realmente sus puntos, conservando métricas y XP; descartar un borrador elimina borrador y ruta sin otorgar XP.

## Verificación

Pasaron seis pruebas con `node --test tests/running.test.mjs`: distancias conocidas y antimeridiano, validación de puntos, velocidades/saltos, interrupciones, segmentos SVG y formato de ritmo/unidades. La compilación final se informa en la entrega.

No se probaron GPS físico, permisos de navegador, Wake Lock, suspensión móvil, SQL, RLS ni RPC contra Supabase real. Después de aplicar el SQL, verificar:

1. En celular con HTTPS: aviso antes del permiso, aceptar/denegar, señal deficiente, caminar y correr al aire libre; comparar una distancia conocida.
2. Pausar/reanudar sin unir segmentos, finalizar, recargar el borrador después de más de 30 s, ocultar la app y apagar pantalla. Comprobar las limitaciones indicadas.
3. Cortar y recuperar red, reintentar el mismo lote y el mismo finalizado; confirmar que no se duplican puntos, actividades manuales o XP.
4. Abrir una segunda pestaña y recuperar: la primera debe perder su permiso de escritura sin sobrescribir la sesión nueva.
5. Registrar manualmente una actividad plausible e imposible; revisar topes diarios y que el XP venga del servidor. Verificar historial, unidades y agregados.
6. Con dos cuentas, intentar leer/editar sesiones y puntos ajenos. Revisar respuestas de perfiles públicos y ranking. Borrar una ruta y comprobar que sus puntos desaparecen.
7. Comprobar continuidad de Salud, hábitos, Fuerza, XP, logros, ligas y auth.

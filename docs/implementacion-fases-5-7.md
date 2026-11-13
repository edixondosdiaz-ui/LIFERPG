# Premium y ranking · Fases 5 y 7

Aplicar manualmente `07_premium_ranking.sql` después de `06_prueba_premium.sql` y desplegar la rama `codex/premium-ranking`. No se ejecutó SQL.

Premium conserva la prueba gratuita solicitada. Incluye descuento y cambios de nombre existentes, rutinas ilimitadas (Gratis: tres), tendencias mensuales de doce meses y marco/insignia incluidos mientras esté vigente. Valores ajustables en `feature_rules` y `economy_rules`. Los protectores conservan el máximo de dos para respetar el límite de la tienda. Las rutinas anteriores se conservan aunque superen el límite; solo se restringe crear nuevas. Eliminar una rutina conserva los ejercicios y sus series.

Las tendencias y el límite de rutinas se validan en el servidor. Los rasgos gratuitos y los cosméticos comprados se conservan al vencer Premium; el marco y la insignia incluidos dejan de renderizarse y no se pueden volver a equipar sin vigencia. Los objetos se equipan desde Tienda o Editar avatar. No hay pasarela ni suscripción de pago simulada.

Global y Amigos conservan el XP total. Mi Liga usa únicamente XP nuevo capturado por el servidor desde aplicar el SQL. No se reconstruyen ni inventan eventos anteriores. La interfaz muestra esa fecha. Abrir Ranking inscribe a la cuenta en Bronce; ligas: Bronce, Plata, Oro, Platino, Diamante y Maestro.

Las semanas empiezan el lunes en Colombia. Al consultar un ranking de una semana nueva, el servidor cierra de forma idempotente todas las pendientes, incluso si pasaron varias semanas. Con al menos cinco participantes en el nivel, asciende el 20 % superior con XP positivo y desciende el 20 % inferior. Los grupos empatados que cruzan el corte no se mueven. Se otorgan las monedas configuradas por cada ascenso una sola vez, registradas en el ledger. No necesita cron; el cierre es diferido hasta la siguiente consulta.

Tocar un usuario abre una hoja inferior con acciones de amistad. Un perfil privado ajeno muestra únicamente avatar, @usuario y nivel; métricas y logros se entregan solo al dueño, amigos o perfiles públicos. Los botones de relación se basan en la amistad real. No se entregan correos ni ubicación. Se preservan búsqueda y gestión de solicitudes existentes.

Pendiente de verificar tras aplicar SQL, con cuentas de prueba:

- Activar la prueba, verificar la comparación, descuento, cupo, rutinas cuarta y posteriores, tendencias y equipamiento incluido; verificar vencimiento y accesos directos a RPC sin Premium.
- Comprobar que una cuenta Gratis no pueda superar tres rutinas ni asociar ejercicios a una rutina de otro usuario. Confirmar continuidad del historial anterior.
- Probar Global/Amigos/Mi Liga, búsquedas, todas las relaciones y privacidad desde dos cuentas. Intentar leer métricas privadas llamando directamente la RPC.
- Verificar XP semanal exacto contra los nuevos incrementos, posiciones empatadas y ascensos/descensos con cinco o más miembros. Repetir el cierre y comprobar que no duplica historial ni monedas.
- Probar cierre de varias semanas pendientes, borde del lunes Colombia, paginación hasta 100 filas y posición propia fuera del listado.
- Regresión de hábitos, Fuerza, XP, logros y auth.

No se probaron SQL, RLS, concurrencia, cierres semanales ni navegador con cuentas reales. La compilación final se informa en la entrega.

# Aplicación manual · Fases 3 y 4

Rama: `codex/fases-3-4`. Esta etapa depende del código y del SQL de las Fases 1 y 2.

## Orden de aplicación

1. Si aún falta, aplicar `supabase/04_hoy_perfil.sql` después de las migraciones anteriores.
2. Ejecutar **una sola vez**, completo, `supabase/05_economia_avatar.sql` en Supabase → SQL Editor. No se ejecutó durante la implementación.
3. Desplegar el código de esta rama.

El SQL agrega estructura, catálogo y funciones; no recalcula saldos ni actualiza avatares, compras o nombres existentes al aplicarlo. Las funciones de compra, nombre y racha existentes conservan sus endpoints y reciben las reglas nuevas. Las modificaciones de saldos y nombres ocurren al usar las RPC, no al aplicar el archivo.

## Decisiones de producto

- `@usuario` es el único nombre visible. Los `display_name` anteriores se conservan en la base de datos y dejan de mostrarse. Los nombres se normalizan a minúsculas y se validan también en el servidor durante el onboarding.
- Un cambio gratis por cuenta, conservando el consumo anterior. Después se usa primero el beneficio Premium elegible y luego las tarjetas compradas. Se confirma antes de consumir. El nombre anterior queda reservado por 30 días para su dueño, incluso si otra persona intenta registrarlo.
- El bloqueo de palabras usa `blocked_username_terms`, incluye una lista inicial de términos reservados y ofensivos, y normaliza variantes comunes con números. No es un sistema exhaustivo de moderación: el dueño debe ampliar esa tabla según los casos de uso. No se publican reservas ni historial de otros usuarios.
- Tarjeta de cambio: 150 monedas. Protector: 200 monedas, máximo dos guardados. Los precios se editan en `shop_items`; los nuevos productos se agregan sin reemplazar el catálogo existente.
- El protector se usa manualmente desde Utilidades: cubre solo ayer si no hubo actividad y había racha anteayer. Se descuenta una unidad de forma atómica. Cuenta para la racha general y sus logros; no da XP ni cuenta como actividad para el premio de los cuatro pilares.
- Reglas en `economy_rules`: 15 monedas por nivel nuevo; 25 por racha de al menos siete días, máximo una vez cada siete días; 10 por registrar los cuatro pilares del día. Reclamos únicos y bloqueos por usuario evitan repetir premios con recargas o pestañas simultáneas. La primera visita reconoce únicamente el nivel actual si es mayor que uno; después reconoce cada nivel nuevo, incluyendo saltos de varios niveles.
- Los logros mantienen sus recompensas actuales en `achievements`. La bienvenida existente se conserva. El ledger registra estos créditos y las compras; los saldos anteriores se reconocen como apertura en la primera operación. No se intenta inventar su historial previo.
- El valor propuesto por ascenso de liga es 50 monedas, reservado en `economy_rules`; no se paga todavía porque no existe un evento de ascenso implementado. La UI lo marca **Disponible pronto**.
- Premium: descuento del 15 % y un cambio de usuario cada 90 días, en ventana móvil, solo para una concesión vigente de `premium_entitlements`. Esa tabla no permite escrituras del cliente. No se crea ninguna suscripción ni flujo de pago simulado; su concesión debe venir de una integración real futura. Configurar los valores en `economy_rules` y el cambio inicial en `app_product_settings`.
- Compras: confirmación del precio, comprobación del saldo y del precio confirmado en el servidor, recibo idempotente, entrega y ledger en una transacción. El servidor impide compras duplicadas de cosméticos y exceder el máximo de protectores. Las utilidades sí pueden comprarse repetidamente hasta sus límites.
- El creador ofrece 8 tonos de piel, 8 peinados, 8 colores de cabello, 6 ojos, 4 opciones de vello facial, 3 rostros y 4 colores de ropa, más Aleatorio y vista previa. Los rasgos base se editan gratis. Los avatares anteriores conservan su rostro y accesorios aunque ya no sean opciones del conjunto base; siguen dibujándose.
- Los objetos comprados se equipan desde la tienda o desde Editar avatar, sin cobrar por equipar. Una sola pieza por ranura. Los cambios de equipamiento no descartan el borrador de rasgos base. El servidor valida el JSON base y obtiene los cosméticos del inventario: un cliente no puede copiar un peinado pagado al JSON para evitar comprarlo.

## Verificación

Se probaron con `node --test tests/avatar.test.mjs` los tamaños del conjunto base, la concordancia entre opciones y validación SQL, 500 avatares aleatorios y la compatibilidad de rasgos antiguos. La compilación final se informa en la entrega.

No se ejecutaron SQL, pruebas de RLS, compras ni cambios con cuentas reales. Después de aplicar la migración, verificar con cuentas de prueba:

1. Comprar un cosmético, confirmar el precio, equipar/quitar y verificar que saldo, inventario, compra y ledger coincidan. Intentar compra sin saldo, duplicada, repetida con el mismo `request_id`, desde dos pestañas y con un precio desactualizado.
2. Verificar que cada crédito de logros, bienvenida, nivel, día completo y racha quede registrado una sola vez. Recargar y repetir las RPC no debe multiplicar premios. Confirmar que el saldo anterior no cambia al reconocerse como apertura.
3. Consumir el cambio gratis, comprar dos tarjetas y realizar cambios confirmados. Revisar que se descuente solo un cambio, el historial sea privado y sin cambios aparezca el enlace a Tienda. Cancelar nunca debe consumir.
4. Con dos cuentas, intentar registrar o cambiar a un nombre en uso, reservado, con distinta capitalización, reservado con sufijo numérico u ofensivo. El antiguo dueño puede recuperar su nombre durante la reserva; otro usuario no.
5. Probar el cupo y descuento Premium únicamente cuando exista una concesión legítima del servidor, incluyendo vencimiento y el límite de 90 días. No habilitar escrituras del cliente ni marcar compras como pagadas manualmente para simular pagos.
6. Comprar hasta dos protectores, intentar un tercero, consumir uno en un día elegible y comprobar la racha, logros e inventario. Un día no elegible o una segunda llamada no debe consumir otro protector.
7. Crear y guardar avatares con todas las opciones nuevas. Editar un avatar antiguo sin cambiar sus rasgos antiguos; equipar accesorios, expresión, peinado, ropa, fondo, marco y título; recargar y verificar su persistencia.
8. Intentar modificar saldo, ledger, inventario, cupos, concesión Premium y reservas desde un cliente autenticado: solo deben operar las RPC autorizadas. Otra cuenta no puede leer estos datos.
9. Verificar login, onboarding, hábitos, Fuerza, ranking, XP y logros existentes.

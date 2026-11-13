# Prueba gratuita Premium

Aplicar manualmente `supabase/06_prueba_premium.sql` después de `05_economia_avatar.sql`, y desplegar el código. No se ejecutó SQL desde Codex.

Desde el menú del avatar → Premium → **Adquirir prueba gratuita** → **Confirmar prueba gratuita**. Dura siete días, no solicita datos bancarios, no cobra ni renueva automáticamente. Una activación por cuenta, controlada por el servidor; repetir la RPC no extiende la fecha.

`premium_trial_settings` permite al dueño ajustar la duración (1–30 días) o deshabilitar nuevas activaciones. Esto no altera pruebas ya otorgadas. `premium_trials` conserva el uso y `premium_entitlements` concede acceso real a los beneficios implementados: descuento de tienda, artículos exclusivos y cupo adicional de nombre. El cliente no puede escribir estas tablas.

No se registran compras ni pagos ficticios. La suscripción de pago sigue como Disponible pronto. Al vencer, no se aplican beneficios nuevos y se conservan cosméticos comprados.

Verificar con cuentas de prueba: cancelar sin activar; confirmar; recargar; llamar la activación simultáneamente desde dos pestañas; revisar la misma fecha de vencimiento; comprobar descuento, artículos Premium y cambio de usuario; rechazar una segunda prueba; comprobar vencimiento y RLS con otra cuenta. No se probaron estos flujos contra Supabase real.

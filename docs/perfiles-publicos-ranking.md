# Perfiles públicos y ranking

## Aviso antes de aplicar

`supabase/12_perfiles_publicos_ranking.sql` **no se ejecutó**. Al agregar `is_public boolean not null default true` por primera vez, **todos los perfiles existentes quedan públicos**, incluso los que antes tenían «Solo amigos». También quedan públicos por defecto los nuevos perfiles al completar su usuario. Esto hace visibles su nivel, XP, racha, estadísticas y logros. No hace públicos correo, nombre personal, país, ubicación, rutas, monedas ni premium.

El archivo no actualiza ni borra filas previas. Si se vuelve a aplicar después, conserva los valores `is_public=false` elegidos por sus propietarios; la preferencia antigua `app_preferences.profile_visibility` queda conservada, pero deja de controlar el acceso. No se puede distinguir retrospectivamente si «Solo amigos» fue una elección explícita o el valor predeterminado anterior: no se intenta inferir consentimiento individual.

El dueño del proyecto debe revisar este efecto y decidir cuándo aplicar la migración completa, después de las anteriores. Para una persona que deba seguir privada, coordinar la activación del nuevo interruptor; no aplicar el archivo esperando que conserve automáticamente la restricción anterior.

## Límites de acceso

- `profiles` mantiene la lectura propia; una política restrictiva adicional evita abrir filas ajenas por otras políticas permisivas. El dueño conserva sus datos internos. No se agrega una política pública que permita hacer `select('*')` sobre perfiles ajenos.
- `public_profile_cards` permite lectura anónima/autenticada únicamente de `username`, `avatar`, `xp` y `level`, con filtro `is_public` y `security_barrier`. Se revocan las escrituras sobre esta proyección y la vista antigua `leaderboard`. La consulta pública de estadísticas usa `public_profile_summary`, con campos JSON explícitos y sin acceso a `auth.users`.
- RLS restringe filas, por eso el acceso público se separa de las columnas internas con una proyección limitada. La vista deliberadamente usa los permisos del dueño para leer solo esos campos y aplicar su filtro; no usa `security_invoker`, pues el usuario no debe tener acceso a filas ajenas de la tabla base. Revisar cualquier advertencia del asesor de Supabase considerando este diseño. Referencias: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y [opciones de seguridad de vistas en PostgreSQL](https://www.postgresql.org/docs/current/sql-createview.html).
- Un perfil privado devuelve solo `username`, `avatar` y el indicador `private`. Sus amigos tampoco reciben estadísticas. El propietario puede consultar su propio perfil completo.
- Se cierran también `get_friend_profile`, `visible_profile`, la vista antigua del ranking, búsqueda y lista de amigos: no basta con ocultar datos en el modal. Las funciones internas `compute_streak(uuid)` y `user_metrics(uuid)` no se pueden invocar directamente desde clientes.
- La posición en la clasificación se conserva para no alterar el orden del ranking; nivel y XP de un participante privado se ocultan. El modal y la comparación de perfiles no presentan métricas privadas. La búsqueda permite encontrar su identidad para gestionar amistades, sin nombre personal ni XP.

## Interfaz

Configuración tiene «Perfil privado», apagado por defecto para perfiles públicos. Guarda inmediatamente con `set_profile_public`, que solo actualiza el perfil de `auth.uid()`; no requiere pulsar «Guardar configuración». Si el guardado no se confirma, vuelve a consultar el perfil y muestra un mensaje. No se modifica XP, monedas, premium ni nombres desde el cliente.

La hoja inferior muestra avatar, usuario, nivel, XP total/semanal, racha, posición y logros destacados con su fecha disponible. La vista privada oculta todo salvo avatar, usuario y mensaje. Se vuelve a consultar al recuperar el foco y cada 15 segundos mientras está visible; el ranking se consulta al recuperar foco y cada 30 segundos. El servidor aplica el cambio de privacidad en la siguiente consulta; no es posible revocar información que otro usuario ya haya leído.

Ranking conserva Global, Amigos y Mi Liga, incluyendo empates y reglas de ascenso existentes. Agrega podio, trofeos SVG, números tabulares, fila propia resaltada y copia fija sobre la navegación únicamente cuando su fila no está completamente visible. El servidor incluye la fila propia aunque quede fuera de los primeros 100. Se reserva espacio inferior adicional y se respetan las reglas globales de movimiento reducido.

## Verificado y pendiente

Verificado localmente: 35 pruebas de lógica, incluido formato es-CO y ocultamiento de métricas privadas en la presentación; linter de tokens/importaciones; vista sin participantes a 360 × 640 y 430 × 640 sin desbordamiento; podio de alturas distintas y cifras tabulares. La fila fija aparece cuando su referencia queda fuera de pantalla, desaparece al verla y reaparece al seguir bajando. Vista de desarrollo: `/__visual?compact=1&pantalla=ranking`.

No se ejecutó la migración ni se probaron RLS, el interruptor, perfiles reales o cuentas nuevas contra Supabase. Pasos manuales:
1. Revisar el aviso de publicación de perfiles anteriores, aplicar el SQL completo y recargar la app.
2. Con cuenta A pública, abrir desde el ranking el perfil B: debe mostrar sus datos públicos sin bloqueo. Comprobar que un registro nuevo quede público al completar su usuario.
3. Con B, activar «Perfil privado» sin pulsar Guardar configuración. Consultarlo de nuevo desde A: solo avatar, usuario y mensaje. Repetir siendo amigos y abriendo la ruta de comparación directamente. Desactivar el interruptor y verificar que regresan sus datos.
4. Revisar ranking de tres ámbitos, posición propia fuera de los primeros 100, scroll, teclado, cierre del modal con Escape y safe area de iPhone.

## Verificación opcional de integración, sin escrituras

Preparado `scripts/check-profile-privacy.mjs`; solo se verificó su sintaxis, no se ejecutó. Requiere dos cuentas reales: A pública (lector), B privada (su propietario). Opcionalmente hacerlas amigas para probar que la amistad no permite saltarse la privacidad. Nunca usar service_role ni una clave secreta.

Configurar estas variables solo en la sesión local de terminal, sin guardarlas en Git ni compartir sus valores: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clave anon/publishable), `PRIVACY_VIEWER_JWT` (JWT de A), `PRIVACY_PRIVATE_OWNER_JWT` (JWT de B), `PRIVATE_USERNAME` (B) y `PUBLIC_USERNAME` (A), ambos sin `@` y en minúsculas. Ejecutar `node scripts/check-profile-privacy.mjs`.

Comprueba acceso a tabla base en ambas direcciones, proyección pública con/sin sesión, campos exactos del resumen privado, rutas antiguas de perfil, XP oculto en la vista antigua y búsqueda sin nombre personal. No imprime datos ni JWT, no cambia privacidad, no llama al ranking que liquida ligas y no guarda archivos de perfiles. Ejecutarlo después del SQL es necesario para validar los permisos reales de este proyecto; las pruebas unitarias no sustituyen esa verificación.

# Acceso y registro · versión 2026-11-16.1

## Alcance

Se reutilizan las clases de los formularios y los tokens actuales. `PasswordInput` añade solo el ojo de 44 px, con nombre accesible y foco visible; comienza oculto, se reinicia al cambiar de modo y al vaciar el valor. Login conserva contraseñas antiguas; las nuevas requieren 8 caracteres. Autocompletado: `current-password` al ingresar y `new-password` al registrar o cambiar contraseña.

El registro pide usuario único, nombre para mostrar (alias, no nombre legal), nacimiento y aceptación. No pide peso, estatura, objetivos de salud ni datos del representante. Se permite desde los **15 años cumplidos en Bogotá**. Entre 15 y 17 hay una única casilla adicional de autorización declarada del representante. Los perfiles siguen públicos por defecto a cualquier edad, por instrucción del dueño; el aviso previo explica qué información será visible y cómo activar Perfil privado.

La casilla no verifica identidad, representación legal ni que el adulto realmente haya autorizado. La evidencia registra la declaración de quien crea la cuenta; no se debe describir como consentimiento del adulto verificado. El responsable debe revisar que el mecanismo elegido y la exposición pública de menores cumplan sus obligaciones antes de publicar para ese público. La edad también es declarada, no se verifica un documento de identidad.

## Aplicación manual de SQL

Respaldar estructura, funciones, triggers, permisos y políticas del esquema, y como mínimo `auth.users`, `public.profiles`, `public.username_reservations` y `public.blocked_username_terms`. El agente no descarga respaldos ni ejecuta SQL.

1. Aplicar `16_registro_terminos.sql` completo tras las migraciones anteriores y antes de desplegar el frontend. Requiere especialmente los modelos y controles de privacidad de 05 y 12.
2. La migración añade columnas privadas de nacimiento y aceptación, sin rellenar datos ni aceptaciones de cuentas antiguas. Conserva RLS por propietario y las proyecciones públicas explícitas, sin publicar nacimiento ni evidencia legal.
3. `handle_new_user` valida metadatos de registro, edad, casillas, versiones, nombres y unicidad en la transacción de alta de Supabase Auth. El servidor fija las fechas. Un fallo revierte el alta, no deja un usuario nuevo sin perfil. El índice único y el bloqueo de nombre resuelven registros concurrentes; la disponibilidad previa no es una reserva.
4. La consulta anónima `registration_username_status` devuelve solo disponibilidad y mensaje. El helper con exclusión de usuario es privado. No abre lectura anónima de perfiles ni expone correos.
5. En Supabase Auth revisar confirmación de correo, URL del sitio, URLs de redirección, política de contraseña y límites contra abuso. Probar con confirmación activada y desactivada. Los registros pendientes de confirmar conservan el perfil y la evidencia desde el alta.
6. Altas hechas desde clientes viejos o el panel administrativo también pasan por el trigger: deben incluir los metadatos requeridos. No actualizar el trigger con una migración anterior después de aplicar el 16.

Los metadatos de Auth son entrada del registro, **no una fuente autorizada permanente**: cambiarlos después no reescribe la evidencia en el perfil. Las columnas legales no son modificables por el cliente directo. Las solicitudes legítimas de rectificación se atienden por el responsable mediante su proceso de soporte; no se agrega una pantalla de edición de nacimiento en esta tarea.

El paso de avatar/onboarding se conserva, precarga el usuario ya registrado y no borra el nombre para mostrar. El único bono de bienvenida sigue a cargo del RPC de onboarding existente; el alta no concede XP, monedas ni Premium nuevos.

## Documentos legales

`/terminos` y `/privacidad` son rutas públicas y se abren en otra pestaña desde el registro; no desmontan el formulario original ni guardan borradores en localStorage. También reemplazan los enlaces pendientes de la sección legal de Configuración.

Completar **todos los marcadores** del responsable, identificación, domicilio, correo, dirección, región/países de alojamiento y plazos de conservación antes de publicar los documentos como definitivos. No hay información inventada de la entidad que ofrece LifeRPG. El responsable debe revisar la redacción, los contratos con proveedores, el mecanismo de autorización para menores y la visibilidad pública elegida. No se garantiza cumplimiento legal por incorporar estos textos.

Fuentes oficiales consultadas el 16 de noviembre de 2026: [Ley 1581 de 2012, Cancillería](https://cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm) y [Política de tratamiento, SIC](https://sedeelectronica.sic.gov.co/politica-de-tratamiento-de-datos-personales). Son referencia para derechos, autorización y tratamiento de menores; las condiciones del producto describen el código actual.

Al cambiar materialmente los textos, publicar una nueva versión tanto en el frontend como en la validación SQL y definir el flujo de nueva aceptación. No editar los textos manteniendo la misma versión ni atribuir a usuarios antiguos una aceptación inexistente.

## Pruebas manuales pendientes en Supabase

Registrar una cuenta propia con correo de prueba: verificar datos y hora/versión en el perfil; probar nombres simultáneos, inválidos, bloqueados y reservados. Probar 14, 15, 17 y 18 años, y llamadas sin casillas o con versión antigua. Confirmar que cambiar metadatos no cambia la evidencia; que otra cuenta no puede leer el nacimiento; y que login, recuperación, avatar y bono de bienvenida conservan su comportamiento. Probar enlaces legales tras escribir en todos los campos y comprobar que al regresar no se pierde el formulario.

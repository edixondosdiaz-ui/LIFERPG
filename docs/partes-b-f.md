# Partes B–F · navegación, Fuerza/Estudio, tienda, tutorial y avisos

## Estado y orden de despliegue

Implementadas en el orden B → C → D → E → F. No se ejecutó SQL ni se publicaron cambios. Cada parte pasó lint, pruebas disponibles y build antes de continuar; Vite conserva la advertencia del bundle mayor de 500 kB. La compilación y las pruebas de JavaScript **no equivalen a ejecutar PL/pgSQL ni probar una cuenta real**.

Aplicar manualmente, completos y en orden: `17_finanzas_deudas.sql`, `18_fuerza_estudio.sql`, `19_tutorial.sql`, `20_notificaciones.sql`. Requieren las migraciones anteriores, incluido 16 si todavía está pendiente. Respaldar antes y desplegar el frontend después. No repetir archivos antiguos para actualizar esta versión, pues pueden restaurar funciones reemplazadas.

Respaldo recomendado: esquema completo `public`, funciones, triggers, vistas, permisos y políticas. Datos mínimos afectados o relacionados: `profiles`, `routines`, `routine_days`, `routine_exercises`, `routine_creation_requests` si ya existe, `workout_sets`, `active_timers`, `edu_sessions`, `xp_claims`, `weekly_xp`, `inventory`, `utility_inventory`, `shop_requests`, `purchases`, `coin_ledger`, `friendships`, `fin_transactions`, `fin_goals`, `fin_recurring`. En reejecuciones incluir también las tablas nuevas de deudas, recompensas de estudio, tutorial y notificaciones. El agente no descarga respaldos.

## B. Navegación y control financiero

- Salud: `/pilares/salud/correr`, `/hidratacion`, `/sueno` (hijas del mismo padre). Orden fijo. Sin arrastre ni consultas de `health_layout_preferences`; la tabla y los datos permanecen.
- Finanzas: `/pilares/finanzas/movimientos` (Registrar, abre en Gasto), `/historial` (Gastos y detalles), `/resumen` (Control), `/metas`, `/deudas`.
- Educación: `/pilares/educacion/estudiar`, `/tareas`, `/progreso`.
- Fuerza: un único flujo de entrenamiento; no se agrega un menú artificial.

Los padres renderizan cabecera, menú y un `Outlet`; solo hay una opción montada. Los índices redirigen con `replace` a la primera opción. Los enlaces del menú agregan historial; atrás/adelante y recarga conservan la ruta. Se quitaron los anclajes entre opciones y los accesos de Hoy apuntan a los índices/primeras opciones. El menú usa SVG y clases actuales, no es sticky y oculta su barra horizontal. Las gráficas avanzadas de Progreso/Premium y las barras compartidas de nivel no se eliminan.

Inventario de cambios de gráficas:

| Ubicación | Antes | Después |
|---|---|---|
| Finanzas | Ingresos/gastos por 14 días o 6 meses | Montos del periodo, priorizando gasto y ahorro |
| Finanzas | Línea de dinero disponible | Saldo de **registros**, descontando gastos y ahorro; no se presenta como saldo bancario |
| Finanzas | Barras de ocho semanas | Esta semana y semana anterior completa, señalando que la actual puede estar incompleta |
| Finanzas | Categorías y metas | Se mantienen con montos, porcentaje y explicación |
| Salud | Barras de agua y sueño | Promedios, meta, última noche y cifras del historial |
| Salud | Anillo de hidratación y trazado GPS privado | Se conservan, con sus explicaciones |
| Educación | Barras de horas y materias | Se retiran los cálculos huérfanos; quedan cifras y calendario |
| Educación | Anillo de objetivo, barra XP, calendario y barras de logros | Se conservan y explican |
| Fuerza | Cifras y comparación de marcas, sin gráficas por ejercicio | Se conserva |

Registrar una meta es el primer bloque de su vista. El historial de movimientos conserva categoría, fecha, monto y detalle y permite buscar; por defecto filtra Gastos. Ingresos y ahorro siguen disponibles, sin obligar a registrar ingresos para anotar gastos.

Deudas: tablas nuevas con RLS por propietario y escrituras por RPC. Saldo inicial y abonos se guardan por separado; la base de datos bloquea abonos mayores al pendiente y duplicados de una misma solicitud. No se calculan intereses ni se mueve dinero; el abono **no crea un gasto automáticamente**, para evitar contabilizarlo dos veces, y no da XP. Ante respuesta de red incierta se reintenta con el mismo UUID y los mismos datos. Errores definitivos permiten corregir el formulario.

## C. Fuerza y estudio

El cronómetro de Fuerza solo se muestra con una rutina seleccionada o con un cronómetro ya activo. Se mantienen las acciones y los registros de sesión existentes: el bloque `workout` de `timer_action` no cambia. Sin rutinas aparece el estado vacío con Crear rutina.

Al crear una rutina son obligatorios nombre, días y al menos un ejercicio con nombre, peso, series y repeticiones. Se señalan con asterisco rojo, texto y errores por campo; el foco va al primero. Los valores de ejercicio se guardan como **plantilla**, no como series realizadas, y no otorgan recompensas. Las rutinas anteriores siguen siendo válidas y no se rellenan con datos inventados.

Estudiar muestra tiempo, iniciar/pausar, progreso de hoy y calendario; el tema es opcional. Se retiran de esa vista el modo libre, el registro manual y la configuración extensa. Tareas y Progreso permanecen en sus rutas, conservando el historial.

Pomodoro: 25 minutos por defecto, atajos 15/25/45/60 y rango entero 1–180. La base de datos comprueba el tiempo real acumulado, sin contar pausas, y exige completar toda la duración. Da 1 XP por 2 minutos (mínimo 1 por sesión completa), con **120 XP diarios por tiempo de estudio**. No incluye las recompensas independientes de Tareas ni cambia otras fuentes de XP. No añade bonos diarios/semanales por tiempo que eludan el tope.

Completar usa un UUID creado por el servidor; los reintentos devuelven el resultado previo. Cancelar no inserta una sesión ni da XP. La recompensa consumida se conserva aunque se elimine una sesión, por lo que borrarla no libera el límite. Se reconocen registros previos sin otorgar XP retroactivo. Se revoca el acceso del cliente a `log_study_session` y `log_study`, que aceptaban minutos declarados; el endpoint de timer es la vía nueva. Los temporizadores previos se recuperan; la validación nueva se aplica al terminarlos.

## D. Tienda y avatar

No cambia el SQL, los precios, descuentos ni recompensas de la tienda. Se reutiliza `purchase_shop_item`: bloqueo de saldo, descuento e inventario en la misma transacción, y `shop_requests` para idempotencia.

La hoja modal muestra la vista previa compartida, precio, saldo, saldo posterior y faltante. Confirmar compra es la única acción de compra en la interfaz. Tiene carga y éxito explícito, Equipar ahora para cosméticos y Seguir comprando. Si la respuesta es incierta, se conserva la solicitud y se verifica antes de permitir otra compra. El saldo/inventario se actualizan con el resultado del servidor y se reconsultan; un fallo de refresco posterior no se comunica como una compra fallida.

El editor usa la misma imagen SVG/representación que la tienda, cuadrícula y categorías, primero objetos propios y estados Equipado/Comprado/Bloqueado. Los objetos Premium vencidos no se ofrecen como equipables. Las utilidades se gestionan en la tienda, no como capas del avatar.

## E. Tutorial

Tutorial con 12 pantallas cortas basadas en las funciones reales: introducción, XP/nivel, racha, cuatro pilares, logros, ranking, perfil público/privado, tienda y avisos. Se muestra antes de la app a cuentas nuevas tras completar el perfil. Omitir también guarda la elección en Supabase. Se puede volver a abrir desde Configuración → Ver tutorial.

La nueva columna `tutorial_seen` se agrega con `true` para cuentas ya existentes y luego cambia su default a `false` para altas futuras. No se inventan fechas de finalización históricas. Las fechas de completar y omitir se guardan por RPC y el cliente no las altera directamente. La ruta de repetición es de pantalla completa, sin quitar espacio con navegación inferior.

## F. Plan de notificaciones y versión construida

Se elige la alternativa priorizada por el dueño: **centro de avisos dentro de la app**, no Push simulado. Campana junto al perfil, contador, historial de últimos 50 avisos, marcar uno/todos como leídos y preferencias por compras, amistades, Pomodoro, hábitos y racha. Hábitos/racha permiten hora; los otros eventos son inmediatos al confirmarse la operación, no avisos programados.

Los eventos de compra, solicitud/confirmación de amistad y sesión completa se insertan desde triggers de servidor y se deduplican. No se generan compras o amistades históricas ficticias. RLS permite solo lectura propia; insertar avisos es exclusivo del servidor. Se intenta Supabase Realtime con consulta periódica cada minuto visible y al volver a la ventana como respaldo. La migración agrega la tabla a la publicación solo si existe y todavía no la incluye.

Los recordatorios de hábitos y racha son opcionales y se generan **al abrir/usar la app** después de la hora elegida, una vez por día de Bogotá y solo si corresponde. Racha en riesgo usa hábitos de ayer y ausencia de hoy. No se presenta esto como una alarma del sistema ni como entrega exacta con la app cerrada. Fin del Pomodoro se registra cuando el servidor confirma la sesión, no por un temporizador de fondo del navegador.

### Siguiente versión: Web Push real

1. Service worker HTTPS para suscripción/recepción y claves VAPID; clave privada exclusivamente en secretos del backend, nunca en el frontend.
2. Suscripciones por dispositivo protegidas por RLS, revocación y limpieza de endpoints vencidos; preferencias actuales reutilizables.
3. Edge Function de envío autenticada y cron de Supabase (`pg_cron` + `pg_net`) para seleccionar vencimientos según `America/Bogota`, con deduplicación por usuario, tipo y día. No se crean jobs ni se guardan credenciales ficticias en estas migraciones.
4. Pedir permiso solo tras explicar el beneficio y un toque en Activar, nunca al abrir la app. Si se rechaza, mantener el centro interno sin insistir.
5. En iPhone/iPad: iOS/iPadOS 16.4 o posterior y app agregada a la pantalla de inicio; no prometer Push desde una pestaña normal. La entrega puede retrasarse por el sistema, permisos o conectividad.
6. Mínimo Push posterior: recordatorio diario de hábitos. Añadir racha y fin del Pomodoro después de verificar entregas, pausas y dispositivos múltiples.

Referencias oficiales consultadas: [WebKit: Web Push en iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple: envío Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Supabase: programación de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). La versión implementada no requiere permiso de notificaciones del navegador ni claves VAPID.

## Verificación manual pendiente con Supabase

- Ejecutar migraciones en un entorno de prueba propio y verificar RLS con dos cuentas. No compartir correos, ubicación ni rutas.
- Navegar menú → opción → otra opción → atrás; recargar cada ruta y comprobar que solo haya una vista. Revisar 360–430 px y que la navegación inferior no tape los formularios.
- Registrar gasto con detalle, buscarlo, crear meta y deuda; abonar, reenviar la misma solicitud, intentar exceder el saldo y comprobar que no se duplican gastos.
- Crear rutina incompleta y revisar asteriscos/foco; crearla completa, precarga, salir/volver y recuperar cronómetro activo.
- Probar Pomodoros de 1/15/25/45/60/180, pausas, cancelación, fin temprano, fin simultáneo desde dos pestañas, cambio de día y límite diario. Intentar invocar endpoints manuales antiguos y comprobar rechazo.
- Comprar con saldo insuficiente, doble toque, precio cambiado y corte de red; revisar saldo/inventario/éxito y aviso único. Probar equipar y filtros del avatar.
- Alta nueva → avatar → tutorial; completar/omitir, entrar desde otro dispositivo y repetir desde Configuración.
- Ver compras/solicitudes/aceptaciones solo en su cuenta; probar preferencias, marcar leídos y recordatorios alrededor de la hora de Bogotá. Con app cerrada, el centro conserva eventos, pero no aparece un Push del sistema.

## Comprobaciones realizadas

Lint y 52 pruebas de JavaScript aprobados. Build aprobado (advertencia de tamaño del bundle). Se revisaron referencias de variables en src sin encontrar identificadores sin declarar. En la vista de revisión, a 360 px, el menú mantiene el ancho de página, resalta la ruta y vuelve con el historial; las 12 pantallas del tutorial ocuparon entre 368 y 462 px de alto, sin desbordamiento horizontal ni errores de consola. Esto no prueba las operaciones autenticadas ni las migraciones en Supabase.

Archivos principales: App, Layout, PillarMenu y páginas de pilares (rutas); DebtControl y services/debts (deudas); RoutineWorkout, StrengthRoutineDialogs, StudyFocus y servicios de Fuerza (registro); PurchaseSheet, ShopItemPreview, Tienda y OwnedAvatarItems (compras/avatar); Tutorial y lib/tutorial; NotificationCenter y services/notifications. Migraciones 17–20, pruebas y vistas de revisión acompañan estos cambios. Los archivos de acceso y migración 16 pertenecen a la Parte A anterior y se conservaron.

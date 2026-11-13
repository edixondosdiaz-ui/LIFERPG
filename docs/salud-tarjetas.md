# Salud: tarjetas, atajos y orden

Aplicar manualmente `supabase/11_salud_orden.sql` completo. Agrega únicamente `health_layout_preferences`, ligada a `profiles.id`, con RLS de propietario y validación del orden exacto de cuatro módulos. No modifica datos, XP ni preferencias anteriores. El agente no ejecutó SQL.

Orden predeterminado: Running o caminata, Hidratación, Sueño y Registro de alimentos. Cada módulo tiene un contenedor y título; los cuatro atajos bajo el encabezado siguen su orden, desplazan al módulo y enfocan su título. El desplazamiento es inmediato si está activo movimiento reducido.

Se usa dnd-kit con asa de 44 × 44 px: ratón tras 8 px, tacto tras mantener 250 ms con tolerancia de 8 px y teclado con espacio/flechas/espacio o Escape. Solo el asa activa el arrastre; el resto conserva el scroll normal. «Reordenar» muestra solo las cabeceras para mover tarjetas largas con facilidad; «Ver tarjetas» restaura el contenido. Los formularios y running siguen montados, sin duplicar rastreadores ni reiniciar sus estados.

El orden se lee al abrir Salud y se guarda con Supabase al soltar. El guardado se serializa y deshabilita temporalmente otro movimiento. Si no puede confirmarse, se muestra el orden anterior y se ofrece volver a consultar. No se usa localStorage. Sin la migración, los registros existentes permanecen accesibles, pero no se habilita el cambio de orden.

Running usa el componente y servicios actuales también dentro de Salud; la ruta anterior sigue disponible. Conserva filtros, guardado, reanudación, permisos, historial privado, registro manual y cálculo de XP. Los botones tienen iconos y estados de inicio, pausa, reanudación y finalización. Se muestran distancia, tiempo y ritmo, y la información de medición queda en un desplegable. No se pide ubicación al entrar; se solicita al iniciar/reanudar. Se retiró la interfaz y las consultas del componente «Cómo te sientes», sin borrar los registros históricos.

Los errores de Salud y running se muestran con mensajes amables; el detalle se registra en consola. No se muestran errores de Supabase ni nombres de RPC. La falta de datos no se presenta como registros vacíos si la carga falló.

Verificación realizada: 33 pruebas locales, incluyendo orden válido, cambio sin mutación y ocultamiento de mensajes técnicos; vista de componentes a 360 × 640 y 430 × 640 sin desbordamiento; reordenamiento con teclado hasta Alimentos primero, atajos sincronizados y foco correcto; campos conservados al ocultar/mostrar. La vista de desarrollo no persiste datos ni activa GPS: `/__visual?compact=1&pantalla=salud`.

Pendiente con cuenta y dispositivo reales:
1. Aplicar la migración, abrir Salud, activar «Reordenar» y arrastrar por el asa con el dedo; comprobar scroll fuera del asa y cancelación antes de mantenerla presionada.
2. Poner Alimentos primero y Sueño segundo; comprobar «Orden guardado», cerrar/abrir y revisar el mismo orden con la misma cuenta en otro dispositivo. Otra cuenta debe conservar sus propias preferencias.
3. Probar los cuatro atajos, escritura antes de reordenar y movimiento reducido.
4. Probar GPS al aire libre: iniciar, pausar, reanudar, finalizar y verificar resumen; comprobar permisos denegados, pérdida de conexión, reintento y recuperación del borrador. No se probaron GPS real, RLS ni persistencia real porque no se ejecutó SQL.

Instalación: dnd-kit desde npm. npm informó cuatro vulnerabilidades en el árbol (tres moderadas y una alta); no se aplicaron actualizaciones automáticas ajenas a esta tarea. Revisar `npm audit` por separado.

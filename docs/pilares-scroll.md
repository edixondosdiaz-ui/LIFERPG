# Pilares: scroll y formularios

- Fuerza y Educación: tarjetas de entrenamiento y enfoque en el flujo normal.
- Finanzas: resumen del mes en el flujo, balance principal de 28 px, ahorro secundario de 16 px, formularios compactos y campos COP reutilizables. El campo muestra separadores colombianos al perder foco; la RPC recibe el valor numérico habitual, incluidos decimales. No cambia datos ni requiere SQL.
- Salud: el agua ya estaba en el flujo. La regla compartida de los pilares garantiza campos de al menos 16 px y 44 px de alto, incluidos fechas, selectores y formularios secundarios. Etiquetas de formularios de 12 px.
- Cabecera y avisos temporales dejan de estar anclados. Solo la navegación de la página permanece fija. El diálogo de perfil conserva su comportamiento modal.
- El contenido reserva `7rem + env(safe-area-inset-bottom)` debajo de la navegación.

Comprobación de desarrollo a 360 × 640: vistas sin datos personales de Finanzas y Salud sin desbordamiento, campos de 16 px/44 px; el agua se desplaza al bajar. Formato COP verificado escribiendo y saliendo del campo. Estas vistas no guardan movimientos.

Pendiente con sesión real: recorrer completos los cuatro pilares, abrir los formularios secundarios y verificar el último control sobre la navegación. Comprobar en Safari de iPhone que el foco no amplía la página y que el área segura conserva el espacio inferior. No se probaron escrituras en Supabase ni un iPhone físico.

# Logros: texto separado del progreso

Se eligió una barra de 7 px debajo del contenido, con `avance/meta` al lado. Mantiene los nombres y descripciones sobre una superficie sólida, deja espacio para textos largos y aprovecha la meta única existente. Un anillo ocuparía más espacio en la insignia; los segmentos sugerirían niveles que el contrato actual no define.

El componente compartido se usa en Logros, destacados del perfil, resumen de usuario y logros de Educación. Conserva exactamente el cálculo porcentual, clasificación y datos de progreso existentes. No cambia RPC, recompensas, consultas ni SQL.

Completados: insignia a color, borde y barra dorados, etiqueta «Completado» y `unlocked_at` formateado en America/Bogota. Si una respuesta no incluye esa fecha (como el resumen de otros usuarios) o es inválida, muestra «Fecha de obtención no disponible»; no inventa fechas ni amplía la información compartida. Bloqueados: solo la insignia se vuelve gris, y el texto secundario mantiene contraste AA sin bajar su opacidad.

La barra entra con escala horizontal de 0 a 1 durante 220 ms. La regla global de `prefers-reduced-motion: reduce` desactiva esta animación. El indicador tiene nombre accesible y avance numérico para lectores de pantalla.

Verificado en la vista de componentes a 360 × 640 y 430 × 640: sin desbordamiento, barra de 7 px, fondo sólido sin degradado y animación de 220 ms. Las pruebas existentes verifican contraste mínimo 4,5:1 para todos los colores de texto usados sobre las superficies. No se consultaron ni crearon logros de prueba.

Revisión manual pendiente con sesión: abrir Progreso → Logros, el perfil y Educación; comprobar avances y fechas reales. Revisar también con movimiento reducido activado en el dispositivo. Vista sin datos personales: `/__visual?compact=1&pantalla=logros`.

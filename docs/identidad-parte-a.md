# Identidad visual · Parte A: propuestas de logo

Esta entrega contiene solo propuestas. No cambia la cabecera, el favicon activo ni la identidad aplicada a la app. El usuario pidió ver cada parte antes de pasar a la siguiente; íconos y avatares se abordan después de revisar estas opciones.

No se recibió una imagen adjunta accesible del logo original. Se usaron los colores reales de `src/design/tokens.js`: morado de marca, blanco, variantes de contraste y fondo violeta de la app.

## Opciones

1. **Ascenso — recomendada:** silueta de emblema, escalones y destello. Expresa progreso y subir de nivel sin depender de armas ni clases de personaje. La silueta llena funciona especialmente bien como ícono pequeño.
2. **Órbita:** ciclo de constancia, marca de acción cumplida y estrella. Más dinámica; conecta con los anillos de experiencia existentes. Incluye adaptación del contraste para el símbolo sobre blanco.
3. **Ruta:** una L y un recorrido ascendente, con un objetivo al final. Más abstracta y minimalista.

La rotulación LIFE/RPG se dibuja con trazos geométricos propios: el logo no necesita instalar fuentes ni realizar solicitudes externas.

## Archivos

En `public/brand/proposals/{ascenso,orbita,ruta}/` hay seis SVG por opción:
- `logo.svg`: logo completo para fondo oscuro.
- `logo-light.svg`: logo completo para fondo claro.
- `symbol.svg`: símbolo transparente para fondo oscuro.
- `symbol-light.svg`: símbolo transparente para fondo claro.
- `pwa.svg`: composición cuadrada con fondo y símbolo dentro del margen central de seguridad.
- `favicon.svg`: dibujo simplificado y encuadre más cerrado para tamaños pequeños.

Son propuestas SVG, no una instalación PWA comprobada. Tras elegir una opción, habrá que integrar la identidad elegida y preparar los tamaños PNG necesarios para compatibilidad de instalación y apple-touch-icon, además del manifiesto si procede. No se inventó un manifiesto en esta etapa.

Los colores de los SVG exportados proceden de los tokens: `node scripts/generate-brand-proposals.mjs` regenera los 18 archivos. No editar manualmente sus colores; editar el generador o los tokens y regenerar. Los SVG tienen título, descripción, viewBox y geometría vectorial; no contienen fotografías, fuentes enlazadas ni imágenes externas.

## Revisión

Comparativa de desarrollo: `/__brand`, disponible únicamente con Vite en modo desarrollo. Presenta logo completo, símbolo, variante PWA, favicons a 16/32 px y aplicación sobre blanco. Verificados carga de imágenes y ausencia de scroll horizontal a 360 y 430 px. Se revisó visualmente la lámina de las tres opciones en escritorio.

Pendiente: comparación con el archivo original adjunto no recibido, elección del usuario e integración de la opción escogida. No se probó instalación real de PWA/favicon en navegadores ni se modificaron datos o SQL.

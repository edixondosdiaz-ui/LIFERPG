# Sistema visual LifeRPG

Los tokens de `src/design/tokens.js` alimentan `tailwind.config.js` y los gráficos SVG. Es la fuente única de colores de las pantallas activas, fondos, superficies, bordes, estados, sombras, radios, fuentes y tiempos. Los valores históricos del avatar se conservan en `avatarTokens`, sin cambiar el JSON guardado ni su contrato SQL.

La base se aplicó primero a Hoy y Salud con componentes compartidos (`PilotCards.jsx`), se capturó a 360 px y luego se extendió a las demás pantallas activas. Fondos violeta/azul noche con brillo radial estático; superficies elevadas con borde translúcido; Plus Jakarta Sans Variable para títulos y números e Inter Variable para lectura. Fontsource empaqueta las fuentes en el despliegue: no quedan enlaces a Google Fonts.

Microinteracciones de 180 ms y entradas de 220 ms. Escala de presionado 0,98. `prefers-reduced-motion` desactiva animaciones, transiciones y escalado de botones/enlaces. Números tabulares, foco visible y colores de estados semánticos. Se eliminaron halos con blur grande; el desenfoque de vidrio se limita a cabecera y navegación (6 px). No hay fondos animados ni filtros en cada tarjeta.

## Comprobaciones

- `npm run lint`: revisa los colores e importaciones de los módulos realmente alcanzables desde `src/main.jsx`, incluida la vista previa de desarrollo. Los colores literales solo se permiten en el archivo de tokens. No es un reemplazo de ESLint; es un guardián del contrato visual. Los archivos antiguos que no importa la aplicación no se modificaron.
- `node --test tests/design-tokens.test.mjs tests/avatar.test.mjs tests/running.test.mjs`: 15 pruebas de contraste, límites de movimiento, compatibilidad de avatar y regresión de cálculos GPS.
- Contraste AA 4,5:1 entre texto/acento y las superficies de lectura; texto de botones principales y peligro; chips; bordes funcionales 3:1. No equivale a una auditoría manual exhaustiva de todos los estados con cada posible contenido del usuario.
- Vista previa revisada a 360 y 430 px: sin desbordamiento horizontal. Controles del panel de Salud de al menos 44 px y navegación de teclado con foco visible.
- Capturas: `docs/visual-pilot/hoy-360.jpg` y `docs/visual-pilot/salud-360.jpg`. No contienen datos de usuario: muestran componentes reales en estado sin información, con guiones en lugar de registros inventados.

La vista previa está en `http://127.0.0.1:5173/__visual` al ejecutar `npm run dev`. Solo existe en desarrollo y no se incorpora al despliegue de producción. No consulta ni escribe registros de usuario.

No se modificaron las operaciones de auth, hábitos, XP, compras o SQL. No se midió rendimiento en un celular físico ni se probaron todos los flujos autenticados. Antes de publicar, revisar las pantallas con los datos reales de una cuenta propia y el modo de movimiento reducido del dispositivo.

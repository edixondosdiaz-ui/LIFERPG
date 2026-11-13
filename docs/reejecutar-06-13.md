# Reejecutar SQL 06 a 13

Ejecuta manualmente el contenido completo de cada archivo actualizado, de `begin` a `commit`, en orden numérico. No borres tablas, políticas ni registros para resolver duplicados. Estos archivos requieren las migraciones anteriores.

- **06:** omite tablas, política y funciones existentes. La configuración inicial solo se inserta si falta; conserva pruebas consumidas y derechos Premium.
- **07 y 08:** protegen tablas, índices, políticas, triggers y semillas. Las funciones nuevas solo se crean si faltan. Las funciones que actualizan fases anteriores se reemplazan en la primera instalación de su fase; al repetirla se conservan las existentes, incluidas las versiones de privacidad del 12. La detección utiliza las funciones características de cada fase antes de crear objetos.
- **09, 11, 12 y 13:** revisados; ya protegen las creaciones repetidas. Sus `create or replace` mantienen las actualizaciones intencionales de esa fase.
- **10:** importa asociaciones heredadas únicamente cuando crea cada tabla de asociaciones. Repetirlo no restaura días o ejercicios retirados después por el usuario.

**Privacidad del 12:** al agregar por primera vez `is_public default true`, los perfiles existentes quedan públicos, incluso si antes tenían visibilidad de amigos. Publica los campos permitidos de identidad y progreso; las consultas públicas no deben exponer correos ni rutas. Si la columna ya existe, repetirlo conserva las elecciones públicas/privadas actuales.

Las protecciones no reparan esquemas personalizados o instalaciones parciales hechas ejecutando fragmentos: `if not exists` no comprueba que las columnas o políticas existentes coincidan. Si aparece otro error, guarda el mensaje completo y no elimines objetos.

Revisión estática: las definiciones originales de todas las funciones se conservaron sin cambios. No se ejecutó SQL ni se verificó contra una instancia de Supabase. Tras aplicar, comprueba la prueba gratuita (sin ampliar una ya usada), rutinas, running, privacidad del ranking, orden de Salud y registro de estudio.

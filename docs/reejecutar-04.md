# Error «app_preferences_own already exists»

Ese mensaje indica que la política ya existe, no que falten datos ni que deban borrarse la tabla o la política. No demuestra por sí solo que todo el archivo 04 esté aplicado.

Se ajustó `supabase/04_hoy_perfil.sql` para crear únicamente objetos faltantes: cuatro políticas, un trigger y diez funciones ahora comprueban su existencia. Conserva las definiciones existentes, incluidas funciones actualizadas por migraciones posteriores. No usa DROP ni CREATE OR REPLACE para sustituir esos objetos y no actualiza registros previos. El agente no ejecutó el SQL.

En el editor SQL, reemplazar el contenido de la consulta por el archivo 04 actualizado completo, desde `begin;` hasta `commit;`, y ejecutarlo una sola vez. Si la sesión indica que quedó dentro de una transacción abortada, ejecutar primero `ROLLBACK;` en esa misma sesión y después el archivo completo.

Este cambio hace al 04 una instalación de objetos faltantes, no una actualización de funciones ya existentes. Después, aplicar solo migraciones nuevas que todavía no se hayan ejecutado; no repetir por rutina 05–08, que contienen creaciones sin guardas y pueden fallar o reemplazar comportamientos posteriores. No borrar objetos para forzar su ejecución.

Si se van a aplicar las nuevas tareas, revisar los archivos 09–13 y sus guías. En particular, el 12 hace públicos por defecto los perfiles existentes al agregar la columna por primera vez: leer su aviso antes de ejecutarlo.

Pendiente: ejecución real en Supabase para verificar el esquema existente. El linter y el build del frontend no validan SQL ni RLS.

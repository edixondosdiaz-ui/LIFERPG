# Error «economy_rules already exists»

La tabla ya existe; no debe borrarse ni vaciarse para repetir el 05. El mensaje por sí solo no confirma que todas las funciones de economía estén instaladas.

Se ajustó `supabase/05_economia_avatar.sql` para comprobar diez tablas, tres índices, ocho políticas, cuatro triggers y dieciocho funciones. Las semillas de reglas y términos bloqueados ahora agregan solo filas faltantes. Los precios y objetos del catálogo conservan su `ON CONFLICT DO NOTHING`. No se cambian saldos, compras, inventario, avatares, reglas configuradas ni registros anteriores al aplicar el archivo.

Antes de crear objetos se comprueba si ya existen funciones características de economía. En una primera instalación, se conservan las siete actualizaciones de endpoints anteriores previstas por el 05 original; esto permite pasar de las reglas del 04 a las de economía. Si economía ya está presente, solo se crean funciones faltantes. No se reemplaza el agregador de actividad actualizado por running ni otras implementaciones existentes. Un esquema modificado manualmente o una instalación parcial puede requerir revisión adicional: conservar una función existente no demuestra que sea su versión correcta.

En Supabase SQL Editor, reemplazar el contenido de la consulta por el archivo 05 actualizado **completo**, desde `begin;` hasta `commit;`, y ejecutarlo manualmente. Si la misma sesión informa una transacción abortada, ejecutar antes `ROLLBACK;`. No quitar líneas de creación de tablas ni agregar DROP para continuar.

El agente no ejecutó SQL ni verificó el esquema remoto. Los tests locales y el build no validan las políticas ni las funciones en Supabase. Después aplicar solo las migraciones pendientes: los archivos 06–08 aún contienen objetos sin guardas de repetición. Si ya se aplicaron, no hace falta repetirlos por los cambios del frontend. Leer el aviso del 12 antes de aplicarlo por primera vez, pues cambia la privacidad predeterminada de perfiles existentes.

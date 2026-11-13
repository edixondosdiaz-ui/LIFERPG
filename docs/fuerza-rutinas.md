# Fuerza: rutinas, series y marcas

## Modelo y migración

Aplicar completo `supabase/10_fuerza_rutinas.sql` después de las migraciones existentes. No fue ejecutado por el agente.

Se reutilizan `routines`, `exercises` y `workout_sets`. Las relaciones nuevas son `routine_days` (rutina/día 1–7) y `routine_exercises` (rutina/ejercicio). Ambas tienen RLS por usuario, validan propiedad y permiten compartir un ejercicio propio entre varias rutinas sin duplicarlo. La migración agrega las asociaciones antiguas de `exercises.routine_id` y `weekday` sin actualizar ni borrar ejercicios o series.

Las series nuevas agregan `routine_id` y `rir` opcional (0–10). El RPE histórico se conserva y no se convierte en RIR. `routine_entry_requests`, privada por usuario y de escritura exclusiva del servidor, identifica reintentos del mismo registro. El RPC guarda todas las filas del ejercicio en una transacción y llama al `log_workout_entry` existente: no se trasladan XP, monedas, récords ni sobrecarga al cliente. Un error revierte toda la operación. El cronómetro mantiene su interfaz y sus acciones originales.

Las rutinas antiguas sin ejercicios no tienen días inferibles y quedan disponibles en el selector sin preselección. Los ejercicios antiguos sin rutina siguen conservados y aparecen en el buscador; su historial sin asociación no se atribuye arbitrariamente a una rutina nueva. Las series históricas de ejercicios con rutina se consultan con esa asociación anterior.

## Comportamiento

- Al entrar se selecciona la primera rutina creada que esté asignada al día actual en Bogotá. Si no hay ninguna, el selector queda vacío; siempre lista todas las rutinas propias. Elegir otro día busca su primera rutina asignada. Elegir una rutina de otro día permite entrenarla hoy: las series siempre se registran en la fecha actual del servidor.
- Crear exige nombre, uno o más días y el nombre de cada ejercicio inicial. La cuota Gratis/Premium anterior sigue vigente en el servidor. Se pueden renombrar y eliminar rutinas; quitar un ejercicio de una rutina conserva sus series.
- Último entrenamiento significa la última fecha anterior a hoy con series de esa rutina, según `app_today()` (America/Bogota). El registro anterior no está asociado al cronómetro, por eso varias sesiones de la misma fecha se consideran un día. Las marcas aparecen como texto en un desplegable.
- Cada fila exige peso, repeticiones y cantidad de series; peso cero explícito sirve para ejercicios con peso corporal. Descanso y RIR son opcionales. Cada fila admite varias series iguales; «Agregar serie» copia peso, repeticiones y opcionales de la fila anterior y deja cantidad 1. Máximo 30 series por envío.
- La primera fila usa los valores de la última serie del entrenamiento anterior de esa rutina cuando existe. Con esos valores listos: tres toques en «Agregar serie» y uno en «Guardar 4 series». Esto cuenta acciones sobre los controles, no pulsaciones del teclado ni latencia del guardado.
- Un único «Agregar ejercicio» aparece al final, con un enlace de salto junto al selector para llegar en un toque. El buscador consulta solo ejercicios propios, con búsqueda por nombre, demora de 180 ms y hasta 20 resultados. Permite reutilizar uno existente o crear uno nombrándolo.
- Borradores en memoria, separados por rutina y ejercicio; no se guardan en localStorage. Abrir/cerrar marcas o cambiar de rutina dentro de Fuerza conserva los campos. Salir de la pantalla o recargar descarta lo no guardado. Si un envío queda incierto, se bloquea su edición y el reintento verifica la misma clave antes de escribir.
- Al final: volumen y número de series guardadas hoy en la rutina seleccionada, mejor peso por ejercicio (a igualdad de peso, más repeticiones) y cambio porcentual de volumen frente al día anterior de esa rutina. Se pueden revisar y quitar series guardadas con el RPC anterior.

## Validación y pasos manuales

Pruebas locales de lógica: selección por día de Bogotá, días sin rutina, clonación independiente de cuatro filas, campos obligatorios, opcionales/RIR 0, resumen y agrupación de marcas. Vista de componentes a 360 × 640 y 430 × 640 sin desbordamiento; campos de 16 px y 44 px de alto, copia de cuatro filas, desplegable sin pérdida de valores y salto al botón final. No se guardaron datos de ejemplo.

Pendiente con Supabase y sesión real, después de aplicar el SQL:
1. Crear una rutina con dos días y dos ejercicios; salir/volver y verificar preselección y día sin rutina. Seleccionar manualmente otra rutina.
2. Abrir el buscador, reutilizar un ejercicio propio y crear otro con nombre. Revisar que otro usuario no vea estas rutinas, ejercicios, series ni solicitudes.
3. Completar peso/repeticiones, agregar tres filas, editar una y guardar. Comprobar cuatro filas reales, volumen y XP del servidor; volver a Hoy y revisar su progreso.
4. Abrir/cerrar marcas durante la edición; verificar valores conservados. Tras un entrenamiento en otra fecha de Bogotá, comprobar marcas y comparación correctas.
5. Probar envío repetido con la misma clave en un entorno de pruebas: debe devolver el resultado anterior sin duplicar series ni XP; un lote con una fila inválida debe dejar cero series nuevas.
6. Iniciar, terminar y descartar el cronómetro como antes; probar teclado y Safari móvil. No se probó un iPhone físico ni se ejecutaron pruebas SQL/RLS.

Vista de desarrollo sin acceso a datos: `/__visual?compact=1&pantalla=fuerza`.

# EduKanban Roadmap

Este documento recoge mejoras propuestas para abordar poco a poco, con foco en impacto real, riesgo y mantenibilidad.

## Como usar este backlog

- Trabajar por fases, no por volumen.
- Priorizar primero lo que mejore uso diario o reduzca riesgo técnico.
- Al cerrar una tarea, anotar fecha y decisión tomada.
- Si una mejora cambia datos o sincronización, acompañarla de prueba manual mínima.

## Fase 1: Mejoras rápidas

### [x] 1. Feedback de sincronización
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Mostrar claramente si la app está sincronizando, cuándo fue la última sincronización correcta y qué error ocurrió si falla.
- Archivos probables:
  - `js/app.js`
  - `js/recursos.js`
  - `index.html`
  - `recursos.html`
  - `css/styles.css`
- Tareas:
  - Añadir indicador visual persistente de estado de sync.
  - Mostrar fecha/hora de última sync correcta.
  - Diferenciar error de Dropbox, Nextcloud y offline.
  - Evitar mensajes silenciosos o ambiguos.
- Criterio de cierre: El usuario puede saber en menos de 3 segundos si sus datos están sincronizados o no.
- Estado: Implementado con resumen visible en cabecera y estado específico para Dropbox y Nextcloud.

### [x] 2. Atajos de teclado globales
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Bajo
- Objetivo: Reducir fricción en acciones repetidas.
- Archivos probables:
  - `js/app.js`
  - `js/recursos.js`
  - `js/recordatorios.js`
- Tareas:
  - `/` enfoca búsqueda.
  - `n` abre nueva actividad si no hay un input enfocado.
  - `Esc` cierra modales y paneles abiertos.
  - Añadir ayuda visible con listado de atajos.
- Criterio de cierre: Los atajos funcionan sin interferir con escritura en inputs o textareas.
- Estado: Implementado con `/` para búsqueda, `n` y `Alt+N` para nueva actividad, y `Esc` para cerrar overlays visibles.

### [x] 3. Persistencia adicional de UI
- Prioridad: Media
- Impacto: Medio
- Riesgo: Bajo
- Objetivo: Recordar mejor el contexto del usuario entre sesiones.
- Archivos probables:
  - `js/app.js`
  - `js/recursos.js`
- Tareas:
  - Guardar página actual de recursos.
  - Guardar secciones abiertas/cerradas del sidebar.
  - Recordar vista o filtro reciente por página.
- Criterio de cierre: Al recargar, la app vuelve al contexto esperado en cada vista.
- Estado: Implementado con búsqueda persistida por vista, página actual de recursos y estado abierto/cerrado del panel de etiquetas.

### [x] 4. Paginación avanzada en recursos
- Prioridad: Media
- Impacto: Medio
- Riesgo: Bajo
- Objetivo: Mejorar navegación cuando hay muchas páginas.
- Archivos probables:
  - `js/recursos.js`
  - `css/styles.css`
- Tareas:
  - Añadir botones numéricos de página.
  - Añadir “ir a primera/última”.
  - Mostrar contador total de páginas.
- Criterio de cierre: Navegación predecible con colecciones grandes.
- Estado: Implementado con primera/última página, numeración compacta alrededor de la página activa y contador visible.

### [x] 5. Búsqueda enriquecida
- Prioridad: Media
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Permitir encontrar actividades con menos clics.
- Archivos probables:
  - `js/app.js`
  - `js/recursos.js`
  - `js/i18n.js`
- Tareas:
  - Soportar búsqueda por texto, etiqueta y categoría.
  - Valorar operadores simples: `tag:`, `cat:`, `has:attachment`.
  - Resaltar coincidencias en resultados.
- Criterio de cierre: Búsquedas habituales resueltas desde una sola caja de texto.
- Estado: Implementado con operadores `tag:`, `cat:` y `has:attachment|reminder`, más resaltado visual de términos libres.

## Fase 2: Impacto medio

### 6. Optimización del render del tablero
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Reducir carga cuando hay muchas actividades o adjuntos.
- Archivos probables:
  - `js/app.js`
  - `css/styles.css`
- Tareas:
  - Medir coste actual de render completo.
  - Evitar repintar columnas no afectadas.
  - Reutilizar nodos cuando cambie una sola tarea.
  - Valorar render incremental por bloques.
- Criterio de cierre: El tablero sigue fluido con volúmenes altos.

### 7. Vista transversal “Hoy” o “Urgente”
- Prioridad: Media
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Responder a “qué debo hacer ahora” sin navegar entre varias vistas.
- Archivos probables:
  - `index.html`
  - `recordatorios.html`
  - `js/app.js`
  - `js/recordatorios.js`
- Tareas:
  - Definir criterios de urgencia.
  - Agrupar vencidos, próximos y activos recientes.
  - Permitir completar, editar o archivar desde esa vista.
- Criterio de cierre: La vista sirve como punto de entrada diario.

### 8. Acciones masivas
- Prioridad: Media
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Ahorrar tiempo en mantenimiento de varias actividades.
- Archivos probables:
  - `js/app.js`
  - `js/archivo.js`
  - `js/recursos.js`
- Tareas:
  - Selección múltiple.
  - Mover de categoría en lote.
  - Etiquetar en lote.
  - Archivar o eliminar en lote con confirmación clara.
- Criterio de cierre: Operaciones repetitivas reducidas a una sola acción.

### 9. Histórico más útil
- Prioridad: Media
- Impacto: Medio
- Riesgo: Bajo
- Objetivo: Convertir el histórico en una herramienta de análisis, no solo de consulta.
- Archivos probables:
  - `historico.html`
  - `js/historico.js`
- Tareas:
  - Mostrar mejor qué cambió y cuándo.
  - Añadir filtros por categoría y rango de fechas.
  - Mejorar resumen de actividad por etiquetas.
- Criterio de cierre: El histórico ayuda a revisar trabajo real y detectar patrones.

### 10. Exportación/importación robusta
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Reducir riesgo de pérdida o corrupción de datos.
- Archivos probables:
  - `js/app.js`
  - `README.md`
- Tareas:
  - Añadir versión de esquema a exportaciones.
  - Validar estructura antes de importar.
  - Mostrar resumen previo de lo que se va a sobrescribir.
- Criterio de cierre: Importar deja de ser una operación ciega.

## Fase 3: Cambios estructurales

### 11. Modularización de `js/app.js`
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Reducir acoplamiento y facilitar cambios seguros.
- Archivos probables:
  - `js/app.js`
  - nuevo directorio `js/modules/`
- Tareas:
  - Separar filtros, tablero, adjuntos, sync, modales y utilidades.
  - Definir una capa mínima de estado compartido.
  - Evitar funciones globales salvo puntos de integración estrictos.
- Criterio de cierre: Cada dominio principal vive en un módulo independiente.

### 12. Versionado de datos y migraciones formales
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Alto
- Objetivo: Hacer seguras futuras evoluciones del modelo de datos.
- Archivos probables:
  - `js/app.js`
  - `js/recursos.js`
  - nuevo archivo `js/data-migrations.js`
- Tareas:
  - Añadir `schemaVersion` a los datos persistidos/exportados.
  - Centralizar migraciones en una sola cadena de pasos.
  - Registrar migración aplicada y fallback si falla.
- Criterio de cierre: Cualquier cambio de estructura pasa por una migración explícita.

### 13. Revisión de arquitectura de sincronización
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Alto
- Objetivo: Gestionar mejor conflictos, sesiones caducadas y recuperación ante errores.
- Archivos probables:
  - `js/app.js`
  - `js/recursos.js`
- Tareas:
  - Definir estrategia de resolución de conflictos.
  - Separar sync manual de sync automática.
  - Añadir reintentos controlados y estados transitorios visibles.
- Criterio de cierre: La sincronización falla de forma entendible y recuperable.

### 14. Revisión del service worker
- Prioridad: Media
- Impacto: Medio
- Riesgo: Medio
- Objetivo: Mejorar despliegue, actualización y consistencia offline.
- Archivos probables:
  - `service-worker.js`
  - `js/sw-register.js`
  - `manifest.json`
- Tareas:
  - Centralizar versión de app/cache.
  - Mostrar aviso cuando hay actualización disponible.
  - Revisar invalidación de caché por tipo de recurso.
- Criterio de cierre: Las actualizaciones son visibles y previsibles para el usuario.

### 15. Tests de regresión mínimos
- Prioridad: Alta
- Impacto: Alto
- Riesgo: Medio
- Objetivo: Evitar romper filtros, render y persistencia al iterar.
- Archivos probables:
  - nuevo directorio `tests/`
  - futura configuración de test runner
- Tareas:
  - Test de filtrado por etiquetas.
  - Test de búsqueda.
  - Test de orden A-Z.
  - Test de paginación en recursos.
  - Test de migraciones de datos.
- Criterio de cierre: Existe una base automática que cubre flujos críticos.

## Orden recomendado de ejecución

1. Feedback de sincronización.
2. Atajos de teclado globales.
3. Persistencia adicional de UI.
4. Optimización del render del tablero.
5. Exportación/importación robusta.
6. Modularización de `js/app.js`.
7. Tests de regresión mínimos.
8. Migraciones de datos.
9. Revisión de arquitectura de sincronización.

## Riesgos a vigilar

- Cambios en sincronización pueden afectar datos reales.
- Cambios en adjuntos pueden dejar blobs huérfanos si no se revisan referencias.
- Cambios en service worker pueden generar cachés inconsistentes si no se versiona bien.
- Modularizar `js/app.js` sin una estrategia gradual puede romper integraciones existentes.

## Definición mínima de “hecho” para cada mejora

- Código implementado.
- Verificación manual en la vista afectada.
- Sin errores de consola nuevos.
- Datos persistidos compatibles con instalaciones previas.
- README o documento afectado actualizado si cambia el comportamiento.

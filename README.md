# EduKanban — Gestor de Actividades

## Descripción
EduKanban es una aplicación sencilla para gestionar actividades del aula con enfoque kanban. Está organizada en cuatro columnas: En preparación, Preparadas, En proceso, Pendientes y una vista de Archivadas. Permite crear, visualizar, etiquetar, recordar y archivar actividades de manera eficiente.

## Estructura del Proyecto
El proyecto contiene los siguientes archivos y directorios:

- `index.html`: Página principal de la aplicación (PWA) con el tablero.
- `css/styles.css`: Estilos de la interfaz.
- `js/app.js`: Lógica principal (kanban, etiquetas, recordatorios, Dropbox opcional).
- `js/archivo.js`: Vista de actividades archivadas.
- `js/recordatorios.js`: Vista centrada en recordatorios.
- `icons/`: Íconos PWA.

## Instalación
1. Clona el repositorio en tu máquina local:
   ```
   git clone <URL_DEL_REPOSITORIO>
   ```
2. Navega al directorio del proyecto:
   ```
   cd EduKanban
   ```

## Ejecución
1. Abre el archivo `index.html` en tu navegador web.
2. Interactúa con la aplicación para gestionar tus actividades.

## Características
- Agregar nuevas actividades a las diferentes categorías.
- Marcar actividades como completadas.
- Eliminar actividades.
- Archivar actividades completadas.

## Notas de migración
- Dropbox usa únicamente `/edukanban.json`. No se lee ni migra desde `/tareas.json` para mantener esta app independiente.

## Contribuciones
Las contribuciones son bienvenidas. Si deseas mejorar la aplicación, por favor abre un issue o envía un pull request.

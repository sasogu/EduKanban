# EduKanban — Gestor d’Activitats

## Descripció

EduKanban és una aplicació kanban per a gestionar activitats de l’aula. Ofereix quatre columnes principals (En preparació, Preparades, En procés i Pendents) i vistes dedicades per a arxivades, recordatoris i històric, amb eines per etiquetar, programar recordatoris i treballar amb adjunts multimèdia.

## Estructura del Projecte

El projecte conté els següents fitxers i directoris:

- `index.html`: Pàgina principal de l’aplicació (PWA) amb el tauler.
- `css/styles.css`: Estils de la interfície.
- `js/app.js`: Lògica principal (kanban, etiquetes, recordatoris, Dropbox, adjunts).
- `js/archivo.js`: Vista d’activitats arxivades.
- `js/recordatorios.js`: Vista centrada en recordatoris.
- `js/historico.js`: Gestió de l’historial de realitzats.
- `js/sw-register.js`: Enregistrament del service worker i gestió d’actualitzacions.
- `icons/`: Icones PWA.
- `service-worker.js`: Cache i mode offline (PWA).
- `manifest.json`: Configuració de la instal·lació com a PWA.
- `pdf-viewer.html`: Visor dedicat per a adjunts PDF.

## Execució

1. Obri el fitxer index.html en el teu navegador web.
2. Interactua amb l’aplicació per a gestionar les teues activitats.
3. Configuració: fes clic en “Administració” (⚙️) per a canviar l’idioma.

## Funcionalitats

### Gestió del tauler
- Crear activitats amb categoria, recordatori, adjunts i ordre manual (A–Z) des del formulari emergent.
- Editar en qualsevol moment el text, les etiquetes, els recordatoris i els adjunts d’una activitat.
- Moure activitats amb menús o arrossegant-les entre columnes, i personalitzar el nom de cada columna des de l’administració.
- Marcar activitats com a fetes per acumular l’historial de realitzats i arxivar/desarxivar mitjançant la casella ràpida.
- Dividir una activitat en còpies basades en cada etiqueta quan en té més d’una.

### Etiquetes i filtres
- Afegir etiquetes separades per comes amb suggeriments automàtics reutilitzats de totes les activitats.
- Filtrar el tauler per etiqueta i mantenir la selecció entre sessions.
- Escollir quines columnes es mostren (inclosa una columna virtual d’històric) i guardar la configuració preferida.
- Visualitzar el recompte d’execucions i l’última vegada que es va completar cada activitat.

### Adjunts multimèdia
- Adjuntar imatges, àudio, vídeo, PDFs i altres fitxers, emmagatzemats en IndexedDB per a ús offline.
- Reutilitzar adjunts ja pujats a altres activitats mitjançant un catàleg filtrable al modal.
- Controlar l’àudio i el vídeo amb reinici ràpid, canvi de velocitat, bucle simple i mode A–B, també amb dreceres de teclat.
- Obrir imatges en un visor tipus lightbox, veure PDFs en una pestanya pròpia i descarregar qualsevol fitxer; els adjunts es sincronitzen amb Dropbox si està connectat.

### Recordatoris
- Programar recordatoris amb data i hora, amb notificacions locals (inclosos Notification Triggers quan el navegador ho permet).
- Rebre avisos automàtics d’activitats vençudes en carregar l’app i evitar duplicats un cop notificades.
- Consultar la vista de recordatoris per separar vencuts i pròxims, i completar/arxivar directament allí.
- Activar o desactivar les notificacions des del panell d’administració.

### Arxiu i històric
- Revisar les activitats arxivades amb filtre per etiqueta, vista prèvia dels adjunts, opcions de descàrrega i botons de desarxivar o eliminar definitivament.
- Registrar en una llista separada les activitats eliminades per mantenir la sincronització amb Dropbox.
- Analitzar l’historial de realitzats per dia i etiqueta, amb resum de totals i botó per saltar al darrer dia amb activitats.
- Desfer una marca de realitzat d’un dia concret per corregir registres.

### Sincronització i còpies
- Connectar amb Dropbox (OAuth 2.0) per sincronitzar categories, adjunts i registres d’eliminació al fitxer `/edukanban.json` i a `/edukanban_attachments`.
- Gestionar l’estat de la sessió amb reautenticació assistida, indicador visual i sincronització manual quan cal.
- Exportar i importar còpies de seguretat en format JSON des del panell d’administració.
- Emmagatzemar totes les dades locals amb prefix `edukanban.*` i conservar els adjunts en IndexedDB per a continuïtat offline.

### PWA i accessibilitat
- Aplicació PWA amb manifest, service worker i registre automàtic per assegurar mode offline i actualitzacions controlades.
- Cache de les principals pàgines, visor PDF i recursos per continuar treballant sense connexió.
- Dreceres de teclat per crear activitats (Alt+N), ajustar velocitat d’àudio/vídeo (Alt+↑/↓, `.` i `,`) i tancar modals amb Esc, complementades amb un modal d’ajuda.
- Interfície bilingüe (Español i Valencià) amb selector des de l’administració i personalització dels noms de columna.

## Emmagatzematge i sincronització

- Dropbox utilitza `/edukanban.json` i `/edukanban_attachments` per sincronitzar tant dades com adjunts (no compatible amb versions anteriors).
- Les claus en `localStorage` estan prefixades amb `edukanban.*` per evitar conflictes (p. ex. `edukanban.categories`, `edukanban.deletedTasks`).
- Els adjunts es guarden en IndexedDB (`edukanban.attachments`) per garantir l’accés offline i minimitzar la mida de la còpia principal.
- El service worker (`service-worker.js`) gestiona la cache i actualitzacions, mentre que `js/sw-register.js` informa de la versió carregada.

## Contribucions

Les contribucions són benvingudes. Si desitges millorar l’aplicació, per favor obri un issue o envia un pull request.

## Descàrrec de responsabilitat

Aquest programari es proporciona «tal qual», sense cap garantia explícita ni implícita. Els autors no ens fem responsables dels possibles danys o pèrdues derivades de l’ús d’aquesta aplicació. L’ús és sota la teua pròpia responsabilitat.

## Llicència

Aquest projecte està sota la llicència MIT. Pots utilitzar, copiar, modificar i distribuir el programari lliurement, sempre que s’incloga el text de la llicència original.

# EduKanban — Gestor de Actividades

## Descripción
EduKanban es una aplicación kanban para gestionar actividades del aula. Ofrece cuatro columnas principales (En preparación, Preparadas, En proceso y Pendientes) y vistas dedicadas para archivadas, recordatorios e histórico, con herramientas para etiquetar, programar recordatorios y trabajar con adjuntos multimedia.

## Estructura del Proyecto
El proyecto contiene los siguientes archivos y directorios:

- `index.html`: Página principal de la aplicación (PWA) con el tablero.
- `css/styles.css`: Estilos de la interfaz.
- `js/app.js`: Lógica principal (kanban, etiquetas, recordatorios, Dropbox, adjuntos).
- `js/archivo.js`: Vista de actividades archivadas.
- `js/recordatorios.js`: Vista centrada en recordatorios.
- `js/historico.js`: Gestión del histórico de realizados.
- `js/sw-register.js`: Registro del service worker y control de actualizaciones.
- `icons/`: Íconos PWA.
- `service-worker.js`: Caché y modo offline (PWA).
- `manifest.json`: Configuración para instalar la app como PWA.
- `pdf-viewer.html`: Visor dedicado para adjuntos PDF.

## Ejecución
1. Abre el archivo `index.html` en tu navegador web.
2. Interactúa con la aplicación para gestionar tus actividades.
3. Configuración: haz clic en “Administración” (⚙️) para cambiar el idioma.

## Funcionalidades

### Gestión del tablero
- Crear actividades con categoría, recordatorio, adjuntos y orden manual (A–Z) desde el formulario emergente.
- Editar en cualquier momento el texto, las etiquetas, los recordatorios y los adjuntos de una actividad.
- Mover actividades mediante menús o arrastrándolas entre columnas, y personalizar el nombre de cada columna desde la administración.
- Marcar actividades como hechas para acumular el historial de realizados y archivar/desarchivar mediante la casilla rápida.
- Dividir una actividad en copias basadas en cada etiqueta cuando tiene más de una.

### Etiquetas y filtros
- Añadir etiquetas separadas por comas con sugerencias automáticas reutilizadas de todas las actividades.
- Filtrar el tablero por etiqueta y mantener la selección entre sesiones.
- Elegir qué columnas se muestran (incluida una columna virtual de histórico) y guardar la configuración preferida.
- Visualizar el recuento de ejecuciones y la última vez que se completó cada actividad.

### Adjuntos multimedia
- Adjuntar imágenes, audio, vídeo, PDFs y otros archivos, almacenados en IndexedDB para su uso sin conexión.
- Reutilizar adjuntos ya subidos a otras actividades mediante un catálogo filtrable en el modal.
- Controlar el audio y el vídeo con reinicio rápido, cambio de velocidad, bucle simple y modo A–B, también con atajos de teclado.
- Abrir imágenes en un visor tipo lightbox, ver PDFs en una pestaña propia y descargar cualquier archivo; los adjuntos se sincronizan con Dropbox si está conectado.

### Recordatorios
- Programar recordatorios con fecha y hora, con notificaciones locales (incluidos Notification Triggers cuando el navegador lo permite).
- Recibir avisos automáticos de actividades vencidas al cargar la app y evitar duplicados una vez notificadas.
- Consultar la vista de recordatorios para separar vencidos y próximos, y completar/archivar directamente allí.
- Activar o desactivar las notificaciones desde el panel de administración.

### Archivo e histórico
- Revisar las actividades archivadas con filtro por etiqueta, vista previa de los adjuntos, opciones de descarga y botones para desarchivar o eliminar definitivamente.
- Registrar en una lista separada las actividades eliminadas para mantener la sincronización con Dropbox.
- Analizar el histórico de realizados por día y etiqueta, con resumen de totales y botón para saltar al último día con actividades.
- Deshacer una marca de realizado de un día concreto para corregir registros.

### Sincronización y copias
- Conectar con Dropbox (OAuth 2.0) para sincronizar categorías, adjuntos y registros de eliminación en el archivo `/edukanban.json` y en `/edukanban_attachments`.
- Gestionar el estado de la sesión con reautenticación asistida, indicador visual y sincronización manual cuando sea necesario.
- Exportar e importar copias de seguridad en formato JSON desde el panel de administración.
- Almacenar todos los datos locales con prefijo `edukanban.*` y conservar los adjuntos en IndexedDB para continuidad offline.

### PWA y accesibilidad
- Aplicación PWA con manifest, service worker y registro automático para asegurar modo offline y actualizaciones controladas.
- Caché de las páginas principales, visor PDF y recursos para seguir trabajando sin conexión.
- Atajos de teclado para crear actividades (Alt+N), ajustar velocidad de audio/vídeo (Alt+↑/↓, `.` y `,`) y cerrar modales con Esc, complementados con un modal de ayuda.
- Interfaz bilingüe (Español y Valencià) con selector desde la administración y personalización de los nombres de columna.

## Almacenamiento y sincronización

- Dropbox utiliza `/edukanban.json` y `/edukanban_attachments` para sincronizar tanto datos como adjuntos (no compatible con versiones anteriores).
- Las claves en `localStorage` están prefijadas con `edukanban.*` para evitar interferencias (por ejemplo `edukanban.categories`, `edukanban.deletedTasks`).
- Los adjuntos se guardan en IndexedDB (`edukanban.attachments`) para garantizar el acceso offline y reducir el tamaño del archivo principal.
- El service worker (`service-worker.js`) gestiona la caché y las actualizaciones, mientras que `js/sw-register.js` informa de la versión cargada.

## Contribuciones
Las contribuciones son bienvenidas. Si deseas mejorar la aplicación, por favor abre un issue o envía un pull request.

## Descargo de responsabilidad

Este software se proporciona «tal cual», sin ninguna garantía explícita ni implícita. Los autores no nos hacemos responsables de los posibles daños o pérdidas derivados del uso de esta aplicación. El uso es bajo tu propia responsabilidad.

## Licencia

Este proyecto está bajo la licencia MIT. Puedes utilizar, copiar, modificar y distribuir el software libremente, siempre que se incluya el texto de la licencia original.

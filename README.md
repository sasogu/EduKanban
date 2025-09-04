# EduKanban — Gestor d’Activitats

## Descripció

EduKanban és una aplicació senzilla per a gestionar activitats de l’aula amb enfocament kanban. Està organitzada en quatre columnes: En preparació, Preparades, En procés, Pendents i una vista d’Arxivades. Permet crear, visualitzar, etiquetar, recordar i arxivar activitats de manera eficient.

## Estructura del Projecte

El projecte conté els següents fitxers i directoris:

- `index.html`: Pàgina principal de l’aplicació (PWA) amb el tauler.
- `css/styles.css`: Estils de la interfície.
- `js/app.js`: Lògica principal (kanban, etiquetes, recordatoris, Dropbox opcional).
- `js/archivo.js`: Vista d’activitats arxivades.
- `js/recordatorios.js`: Vista centrada en recordatoris.
- `icons/`: Icones PWA.

## Execució

1. Obri el fitxer index.html en el teu navegador web.
2. Interactua amb l’aplicació per a gestionar les teues activitats.
3. Configuració: fes clic en “Administració” (⚙️) per a canviar l’idioma.

## Característiques

- Afegir noves activitats a les diferents categories.
- Marcar activitats com a completades.
- Eliminar activitats.
- Arxivar activitats completades.

## Emmagatzematge i sincronització

- Dropbox utilitza únicament `/edukanban.json` (no compatible amb apps anteriors).
- Les claus en localStorage estan prefixades amb `edukanban.*` per a evitar interferències (p. ex. `edukanban.categories`, `edukanban.deletedTasks`).

## Contribucions

Les contribucions són benvingudes. Si desitges millorar l’aplicació, per favor obri un issue o envia un pull request.

## Descàrrec de responsabilitat

Aquest programari es proporciona «tal qual», sense cap garantia explícita ni implícita. Els autors no ens fem responsables dels possibles danys o pèrdues derivades de l’ús d’aquesta aplicació. L’ús és sota la teua pròpia responsabilitat.

## Llicència

Aquest projecte està sota la llicència MIT. Pots utilitzar, copiar, modificar i distribuir el programari lliurement, sempre que s’incloga el text de la llicència original.

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

## Ejecución
1. Abre el archivo `index.html` en tu navegador web.
2. Interactúa con la aplicación para gestionar tus actividades.
3. Configuración: haz clic en “Administración” (⚙️) para cambiar el idioma.

## Características
- Agregar nuevas actividades a las diferentes categorías.
- Marcar actividades como completadas.
- Eliminar actividades.
- Archivar actividades completadas.

## Almacenamiento y sincronización

- Dropbox usa únicamente `/edukanban.json` (no compatible con apps anteriores).
- Las claves en localStorage están espaciadas con prefijo `edukanban.*` para evitar interferencias (por ejemplo `edukanban.categories`, `edukanban.deletedTasks`).

## Contribuciones
Las contribuciones son bienvenidas. Si deseas mejorar la aplicación, por favor abre un issue o envía un pull request.

## Descargo de responsabilidad

Este software se proporciona «tal cual», sin ninguna garantía explícita ni implícita. Los autores no nos hacemos responsables de los posibles daños o pérdidas derivados del uso de esta aplicación. El uso es bajo tu propia responsabilidad.

## Licencia

Este proyecto está bajo la licencia MIT. Puedes utilizar, copiar, modificar y distribuir el software libremente, siempre que se incluya el texto de la licencia original.

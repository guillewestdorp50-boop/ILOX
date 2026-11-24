# ILOX

**Construí · Explorá · Jugá en tu propio mundo.**  
*Donde tus ideas cobran vida.*

ILOX es un proyecto familiar: una aventura 3D de exploración y construcción creada para Eli y su familia. El punto de partida es un mundo natural amplio, vivo y sin civilización: praderas, montañas, bosques, rocas y ríos. Las casas, caminos, puentes y demás construcciones nacerán de la imaginación de quienes juegan.

## Primera vista previa

- Pradera de inicio con terreno natural, colinas, árboles, rocas y un río.
- Cámara en tercera persona y controles táctiles para explorar.
- Cuatro personajes seleccionables: niño de ocho años, niña, hombre adulto y mujer adulta.
- Estética 3D de aventura semi-realista, con rostros y proporciones humanas; no caricaturesca.
- El niño comienza con camperita negra con capucha y logo ILOX en la espalda, pantalón largo, botas y mochila pequeña vintage de lona con varios bolsillos.
- La historia comienza en una pradera abierta. Todavía no se explica por qué el personaje está solo: ese misterio queda para desarrollar la trama juntos.

## Hoja de ruta

1. Mundo natural y exploración.
2. Recolección de madera y objetos.
3. Inventario y construcción de un refugio.
4. Comercio, personajes no jugadores y economía.
5. Lluvia, viento, tormentas y refugios mejorables.
6. Guardado persistente y mundos familiares compartidos con permisos.

## Aplicación Android de prueba

El proyecto incluye una aplicación Android inmersiva que carga la escena 3D localmente dentro del APK. GitHub Actions compila automáticamente el APK de depuración al actualizar la rama `main` y lo publica como artefacto `ILOX-Android-debug`.

- Paquete: `com.ilox.game`
- Versión: `0.1.0-preview`
- Nombre: `ILOX · Mundo de Eli`
- Requiere internet para descargar Three.js desde CDN.
- Es una versión de inspección visual, no una versión final.

## Ejecutar localmente

Abrí `index.html` mediante un servidor estático local. La escena usa Three.js desde un CDN y necesita conexión a internet para cargar esa biblioteca.

## Publicación y privacidad

El frontend podrá publicarse con GitHub Pages desde la rama `main`, carpeta raíz. El repositorio es público, pero eso no vuelve públicos los mundos del juego. Esta versión inicial todavía no implementa cuentas, autorización familiar, multijugador ni guardado privado. Antes de alojar mundos familiares reales habrá que implementar y verificar un backend con autenticación y controles de acceso del lado del servidor.

ILOX es un proyecto no comercial para Eli y su familia; no está pensado para incluir anuncios, compras ni chat público.

# ILOX — nuevo mapa urbano-rural (experimento aislado)

## Objetivo
Crear un escenario alternativo de planicie urbano-rural, sin océano, mar, río ni simulación de agua. No reemplaza ni modifica el mundo Island existente hasta que el nuevo escenario haya sido probado y aprobado.

## Escala
- Superficie objetivo: 3.000.000 m².
- Huella cuadrada equivalente: 1.732,05 m × 1.732,05 m.
- Límites físicos y de navegación coherentes con esa huella; no reducir silenciosamente la escala.

## Diseño del terreno
- Planicie amplia con ondulaciones suaves y variación natural de elevación.
- Sin acantilados, montañas altas, costas ni cuerpos de agua.
- Suelo de bajo coste: material principal con variación procedural de color/ruido económico; sin capas de shader costosas.
- Horizonte abierto y cielo liviano, conservando sol y ciclo visual si su coste lo permite.

## Diseño urbano-rural
- Núcleo urbano pequeño y legible, con calles y manzanas de baja densidad.
- Transición a periferia con viviendas dispersas, caminos secundarios, lotes, árboles agrupados y campos abiertos.
- Elementos repetidos mediante instancing/LOD; colisiones simples y solo donde aporten jugabilidad.
- Mantener despejadas las zonas amplias para caminar y construir.

## Presupuesto de rendimiento
Probar en el teléfono objetivo mirando por separado: cielo, suelo cercano, horizonte urbano y conjunto de edificios.
- Evitar sombras dinámicas de múltiples objetos y postprocesado caro.
- Limitar densidad de geometría y distancia de dibujado; usar LOD/instancing.
- El mapa no debe crear ni cargar sistemas de océano, olas, río o cascadas.

## Integración segura
- Esta rama es experimental y parte de la versión estable d4493d646227.
- No borrar, sustituir ni desactivar permanentemente funciones del mundo existente.
- Crear el nuevo escenario en archivos y ruta propios; el mundo anterior debe seguir siendo recuperable.
- No promoverlo a producción hasta verificar compilación, publicación y prueba visual en el dispositivo.
- Cada cambio debe ser pequeño, reversible y probado de forma aislada.

## Criterios de aceptación
1. Superficie y límites corresponden a 3.000.000 m².
2. No existe océano, mar, río ni cascada en el nuevo escenario.
3. La cámara y el personaje se desplazan sin atravesar el límite del mapa.
4. Cielo y suelo mantienen fluidez al mirar directamente hacia ellos.
5. Se conservan controles táctiles, pantalla completa y navegación del personaje.
6. El mundo original sigue intacto y accesible.


## Vista previa Android
- La rama genera un APK de prueba al recibir cambios en el escenario, sin publicar ni reemplazar el sitio estable.
- El APK debe superar `node --check app.js`, la compilación Gradle y la carga de recursos antes de probarse en el teléfono.

# ILOX — rendimiento y recorrido del canal (referencia de proyecto)

## Rendimiento verificado por prueba en dispositivo
- Cielo: 5% de tartamudeo.
- Tierra: 5% de tartamudeo.
- Agua: 5% de tartamudeo.
- Este es el nuevo punto de referencia alcanzado. No volver a optimizar estos tres sistemas sin necesidad y sin conservar el resultado visual.
- URL de prueba que alcanzó el resultado: `?terrainlite=1&ocean15=1&waterlite=1&atmolite=1&skylite=1`.

## Comportamiento requerido del canal inferior
- La entrada al canal inferior, después de la poza de la cascada, inicia automáticamente un descenso sentado.
- La transición debe sentirse física: el cuerpo se afloja, flexiona las piernas y cae de cola; no debe parecer que se sienta en una silla invisible.
- El personaje debe quedar apoyado en el fondo real del canal, nunca flotando ni sentado sobre la superficie del agua.
- El agua debe ocultar la parte inferior del cuerpo y dejar visibles las rodillas flexionadas y el torso.
- Durante el descenso debe haber movimiento corporal y celebración con los brazos levantados y animados, además de un grito alegre.
- Los controles direccionales siguen activos durante todo el trayecto: adelante, atrás, izquierda y derecha permiten modular y dirigir el recorrido dentro del canal.
- El botón SALTAR permite salir voluntariamente del canal. Al llegar al final, si no salió antes, termina el recorrido y recupera el control normal de pie.
- No cambiar geometría, ancho, pendiente ni velocidad propia del agua del canal para implementar estas mejoras.
- No romper la natación normal ni las demás mecánicas.

## Regla de desarrollo
ILOX crece por acumulación y reparación, no por destrucción. Mantener ramas y funciones existentes; cambios reversibles y aditivos.

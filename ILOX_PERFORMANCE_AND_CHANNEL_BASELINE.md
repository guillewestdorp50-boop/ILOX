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

## Prueba real del usuario — 14/11/2026
**Lo que ya funciona y debe conservarse:**
- Los controles laterales responden correctamente dentro del canal.
- SALTAR permite salir del canal.
- En el aire, el jugador puede dirigir el salto hacia afuera del canal.
- La animación de alegría ya se activa durante el deslizamiento.
- El brazo izquierdo se agita correctamente.
- La mecánica general del recorrido responde; no rehacerla ni reemplazarla.

**Correcciones pendientes, en este orden:**
1. **Límite lateral del canal:** el desplazamiento debe quedar contenido dentro del margen interior del agua. Actualmente se puede llevar al personaje hasta dejar aproximadamente medio cuerpo fuera del agua y continúa deslizándose por tierra. Añadir un tope/contención lateral calculado con el ancho útil del canal y el volumen del personaje. La contención solo rige mientras está en el modo de deslizamiento; SALTAR debe seguir permitiendo salir y dirigir el salto fuera del canal.
2. **Pose y altura del cuerpo:** dejar de colocar al personaje como sentado sobre una silla en la superficie. Debe descender hasta el fondo del canal, con el agua cubriendo la parte inferior del cuerpo. La pose de deslizamiento debe llevar las piernas extendidas hacia delante, no rígidas ni dobladas como sentado en una silla.
3. **Brazo derecho:** corregir la rotación/desfase que lo deja como un trapo sacudido hacia atrás. Conservar el movimiento correcto del brazo izquierdo y lograr una animación natural y alegre en ambos brazos.
4. **Grito durante el descenso:** reproducir una exclamación de diversión sostenida/alegre propia de un descenso acuático, sincronizada con el recorrido y no solamente al saltar. El grito actual es demasiado suave y solo se percibe al saltar; no debe confundirse con un sonido de esfuerzo. Evitar repetirlo en cada fotograma.
5. **Conservar el resto:** no tocar los controles que ya funcionan, la posibilidad de saltar, el canal, la corriente, la cascada, el agua ni el rendimiento ya verificado.

## Regla de desarrollo
ILOX crece por acumulación y reparación, no por destrucción. Mantener ramas y funciones existentes; cambios reversibles y aditivos.

## Aclaración confirmada por el usuario — salto y salida lateral
- Durante el deslizamiento normal, el personaje permanece dentro del margen interior del agua.
- Al pulsar SALTAR, se libera inmediatamente la contención lateral. En el aire puede dirigirse hacia cualquiera de los dos costados para abandonar la caída.
- Si salta pero no dirige el vuelo hacia afuera, vuelve a caer en el canal y retoma el deslizamiento.
- La contención lateral jamás debe aplicarse durante el salto ni durante el vuelo. No modificar esta mecánica al ajustar el margen del canal.


## Segunda prueba real del usuario — 14/11/2026
**Resultado confirmado:**
- La contención lateral funciona correctamente: durante el deslizamiento el personaje llega al borde útil y permanece dentro del agua. Esta corrección queda aprobada y no debe modificarse.
- La entrada al canal continúa siendo sentado y el recorrido general sigue funcionando.

**Pendiente tras la prueba:**
1. **Brazo derecho:** la corrección anterior no resolvió el problema; sigue desarticulado/colgando hacia atrás. No repetir el mismo ajuste de rotación a ciegas. Inspeccionar los nombres, jerarquía y ejes locales reales del esqueleto del modelo, y corregir la articulación derecha respetando el movimiento izquierdo que sí funciona.
2. **Piernas:** siguen dobladas en pose de silla. La mezcla actual de animaciones `fall`, `sit` y `swim` no logra la extensión. Inspeccionar los clips y tracks reales del modelo; crear una pose de deslizamiento con caderas/rodillas/tobillos extendidos hacia delante y mezclarla solo durante `ride`. No afectar las animaciones normales.
3. **Grito:** la voz del dispositivo pronuncia dos sonidos breves separados («I» y «U»), no una exclamación continua. El actual `SpeechSynthesisUtterance('¡Yujuuu!')` no es aceptable. Reemplazar por una exclamación vocal continua y expresiva, preferentemente un clip de audio propio integrado al proyecto, reproducido una sola vez al entrar al canal y con volumen claramente audible. No usar sílabas/letras sueltas ni depender de que el motor TTS interprete correctamente la ortografía.
   
**No tocar:** límite lateral ya aprobado, entrada sentada, salto y salida aérea lateral, geometría/ancho/pendiente del canal, corriente, cascada, agua ni perfil de rendimiento.

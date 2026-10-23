# Mi primer RTS

Un juego de estrategia en tiempo real hecho con **canvas puro y JavaScript**, sin
frameworks ni dependencias. Todo el juego vive en `main.js`.

## Cómo jugar

Abre `index.html` con doble clic (funciona con `file://`, no hace falta servidor).

El objetivo es **destruir el campamento enemigo** de la esquina superior derecha.
El campamento saca guardias si te acercas; si lo destruyes, ganas.

### Controles

| Acción | Control |
|---|---|
| Seleccionar una unidad | Clic izquierdo |
| Caja de selección | Arrastrar con el botón izquierdo |
| Añadir a la selección | `Shift` + clic o `Shift` + arrastrar |
| Mover | Clic derecho en el suelo |
| Talar el árbol | Clic derecho sobre el árbol |
| Atacar | Clic derecho sobre un enemigo o el campamento |
| Construir cuartel | Tecla `B` o botón **Cuartel** |
| Entrenar unidad | Seleccionar un cuartel y pulsar **Entrenar** |
| Cámara | `WASD` o flechas, o acercar el ratón a un borde |
| Zoom | Rueda del ratón |
| Guardar / cargar | Botones arriba a la derecha |
| Deseleccionar | `Escape` |

## Bucle de juego

1. Selecciona las seis unidades y mándalas a talar el árbol (300 de madera).
2. Cada viaje lleva 10 de madera al **centro de mando**. La madera solo cuenta
   cuando se entrega.
3. Con 150 de madera construye un **cuartel**; cada unidad cuesta 50 y tarda 4 s.
4. Con el ejército, ve al campamento enemigo y destrúyelo.

## Sistemas

- **Cámara**: mundo de 1600×1200, zoom 0,75×–1,6× anclado al cursor, scroll en
  los bordes y límites que descuentan el HUD.
- **Selección**: clic o caja; la caja se guarda en pantalla y se convierte al
  mundo al soltar; las unidades enemigas no se pueden seleccionar.
- **Rutas**: grafo de visibilidad con las esquinas de todos los obstáculos y
  Dijkstra, más suavizado de esquinas innecesarias.
- **Colisiones**: separación fuerte entre unidades quietas y roce suave cuando
  al menos una camina (limitado para no frenar el avance).
- **Combate**: vida, daño, enfriamiento, auto-defensa, muerte, barras de vida y
  campamento enemigo con guardias y condición de victoria.
- **Recursos**: tala, capacidad de carga, viaje al centro de mando y retorno.
- **Edificios**: cuartel con colocación en rejilla, coste, cola de entrenamiento
  y aparición de unidades en huecos libres.
- **HUD**: madera, selección, botones contextuales y avisos flotantes.
- **Guardado**: estado completo en `localStorage` (unidades, edificios, árbol,
  cámara, victoria). Los trabajadores que llevaban madera vuelven al centro de
  mando al cargar.

## Pruebas

```bash
npm test
```

No hay dependencias: usa el `node` instalado.

- `tests/game.test.js`: 82 comprobaciones de selección, movimiento, rutas,
  recursos, edificios, combate, HUD y guardado.
- `tests/fuzz-movement.js`: 443 órdenes de movimiento aleatorias.
- `tests/fuzz-gather.js`: 25 rondas de tala con conservación exacta de madera.
- `tests/fuzz-build.js`: 40 rondas con 1–4 cuarteles aleatorios.

El arnés (`tests/harness.js`) carga `main.js` en un DOM falso con un canvas que
registra las llamadas de dibujo, y permite simular ratón, teclado y rueda.

## Estructura

```
index.html      Página del juego
style.css       Estilo de la página
main.js         Todo el juego
package.json    Script de pruebas
tests/          Arnés y suites de pruebas
```

## Límites conocidos

- El guardado usa `localStorage` del navegador: no viaja entre equipos.
- No hay niebla de guerra, minimapa ni sonido.
- El camino se calcula por esquinas: funciona bien con rectángulos, no con
  formas orgánicas.
- Los enemigos no construyen ni producen; el campamento solo saca guardias.

# Mi primer RTS

Un juego de estrategia en tiempo real hecho con **canvas puro, TypeScript y Vite**.
La lógica está separada en módulos de `src/` (núcleo, entidades, sistemas, render y
UI), y las pruebas se ejecutan con Node sobre un bundle generado con esbuild.

## Cómo jugar

```bash
npm install
npm run dev
```

Abre la dirección que muestra Vite (normalmente `http://localhost:5173`). Para
probar la versión de producción:

```bash
npm run build
npm run preview
```

Al arrancar verás el **menú**: elige Fácil, Normal o Difícil. La dificultad cambia
la madera inicial y el ritmo y tamaño de las oleadas. Si ya jugaste, **Continuar**
retoma el autoguardado de la última oleada.

El objetivo es **destruir el campamento enemigo** de la esquina superior derecha,
pero el campamento no se queda quieto: manda oleadas hacia tu base y cada vez son
más grandes. Si te quedas sin unidades y sin edificios, pierdes.

### Controles

| Acción | Control |
|---|---|
| Seleccionar una unidad | Clic izquierdo |
| Seleccionar todo el tipo en pantalla | Doble clic |
| Caja de selección | Arrastrar con el botón izquierdo |
| Añadir a la selección | `Shift` + clic o `Shift` + arrastrar |
| Mover | Clic derecho en el suelo |
| Encolar movimiento | `Shift` + clic derecho |
| Grupos de control | `Ctrl+1…9` guarda, `1…9` recupera |
| Centrar en la base | `Espacio` |
| Pausa | `P` |
| Volver al menú | `M` |
| Talar el árbol | Clic derecho sobre el árbol |
| Atacar | Clic derecho sobre un enemigo o el campamento |
| Construir cuartel | Tecla `B` o botón **Cuartel** |
| Construir torre | Tecla `T` o botón **Torre** |
| Entrenar soldado / arquero | Seleccionar un cuartel y pulsar el botón |
| Cámara | `WASD` o flechas, o acercar el ratón a un borde |
| Zoom | Rueda del ratón |
| Saltar con el minimapa | Clic en el minimapa |
| Guardar / cargar / sonido | Botones arriba a la derecha |
| Reiniciar | `R` (en pausa o al terminar) |
| Deseleccionar | `Escape` |

## Bucle de juego

1. Elige dificultad en el menú. En Fácil empiezas con 100 de madera extra.
2. Selecciona las seis unidades y mándalas a talar el árbol (300 de madera).
3. Cada viaje lleva 10 de madera al **centro de mando**. La madera solo cuenta
   cuando se entrega.
4. Con 150 de madera construye un **cuartel**; con 100, una **torre**.
5. El cuartel entrena **soldados** (50, cuerpo a cuerpo) y **arqueros**
   (60, más frágiles pero con mucho alcance).
6. Aguanta las oleadas, explora con la niebla y destruye el campamento enemigo.

## Sistemas

- **Cámara**: mundo de 1600×1200, zoom 0,75×–1,6× anclado al cursor, scroll en
  los bordes y límites que descuentan el HUD.
- **Selección**: clic o caja; la caja se guarda en pantalla y se convierte al
  mundo al soltar; las unidades enemigas no se pueden seleccionar.
- **Rutas**: grafo de visibilidad con las esquinas de todos los obstáculos y
  Dijkstra, más suavizado de esquinas innecesarias.
- **Colisiones**: separación fuerte entre unidades quietas y roce suave cuando
  al menos una camina (limitado para no frenar el avance).
- **Combate**: vida, daño, enfriamiento, auto-defensa, muerte, barras de vida,
  proyectiles para arqueros y torres, y campamento enemigo con condición de
  victoria.
- **Oleadas**: grupos enemigos que salen del campamento y avanzan hacia tu base,
  con contador y pantalla de derrota.
- **Recursos**: tala, capacidad de carga, viaje al centro de mando y retorno.
- **Edificios**: cuartel y torre con colocación en rejilla, coste, cola de
  entrenamiento por tipo y aparición de unidades en huecos libres.
- **Niebla de guerra**: solo se ve lo que está cerca de tus unidades y
  edificios; lo explorado se recuerda en penumbra.
- **Minimapa**: terreno, edificios, unidades visibles y rectángulo de cámara;
  clic para mover la vista.
- **HUD**: madera, selección, botones contextuales y avisos flotantes.
- **Sonido**: tonos sintetizados con WebAudio para golpes, disparos, muertes,
  construcción, oleadas, victoria y derrota. Botón de silencio.
- **Menú y dificultad**: Fácil, Normal y Difícil cambian madera inicial, primera
  oleada, intervalo, tamaño y fuerza enemiga. La partida se puede pausar (`P`),
  reiniciar (`R`) o mandar al menú (`M`).
- **Autoguardado**: al empezar cada oleada se guarda sola; **Continuar** en el
  menú retoma esa partida.
- **Comodidad RTS**: doble clic selecciona el mismo tipo en pantalla, `Ctrl+1…9`
  guarda grupos, `1…9` los recupera centrando la cámara, `Shift`+clic derecho
  encola movimientos y `Espacio` centra la base.
- **Guardado**: estado completo en `localStorage` (unidades, edificios, árbol,
  cámara, oleadas, dificultad y resultado). Los trabajadores que llevaban madera
  vuelven al centro de mando al cargar.

## Pruebas y comprobaciones

```bash
npm test          # compila el bundle de pruebas y ejecuta todas las suites
npm run typecheck # comprueba los tipos con tsc
npm run build     # genera la versión de producción en dist/
```

`npm test` usa `tests/build-test-bundle.js` para compilar `src/test-entry.ts` con
esbuild. Ese entry arranca el juego y expone la API interna en `globalThis.__game`,
igual que antes se hacía con el hook de `main.js`.

- `tests/game.test.js`: 123 comprobaciones de selección, movimiento, rutas,
  recursos, edificios, combate, oleadas, niebla, minimapa, sonido, menú,
  dificultad, pausa, autoguardado, grupos y atajos.
- `tests/fuzz-movement.js`: 443 órdenes de movimiento aleatorias.
- `tests/fuzz-gather.js`: 25 rondas de tala con conservación exacta de madera.
- `tests/fuzz-build.js`: 40 rondas con 1–4 cuarteles aleatorios.

El arnés (`tests/harness.js`) carga el bundle en un DOM falso con un canvas que
registra las llamadas de dibujo, y permite simular ratón, teclado y rueda.

## Estructura

```
index.html              Página del juego
style.css               Estilo de la página
src/
  main.ts               Arranque y bucle principal
  test-entry.ts         Entry que expone el estado para las pruebas
  core/
    constants.ts        Constantes y presets de dificultad
    state.ts            Estado mutable central
    math.ts             Geometría pura
    view.ts             Cámara y conversión pantalla ↔ mundo
    layout.ts           Rectángulos de botones
    feedback.ts         Avisos y efectos temporales
  entities/
    unit.ts             Creación de unidades
  systems/
    fog.ts              Niebla de guerra
    selection.ts        Selección de unidades y edificios
    navigation.ts       Rutas, colisiones y separación
    orders.ts           Órdenes del jugador
    economy.ts          Tala y entrega de madera
    combat.ts           Combate y daño
    placement.ts        Huecos libres para unidades
    buildings.ts        Construcción, entrenamiento y torres
    waves.ts            Guardias, oleadas y derrota
    audio.ts            Sonido con WebAudio
    session.ts          Guardado, carga, pausa y menú
  render/
    render.ts           Dibujo del mundo
    minimap.ts          Minimapa interactivo
  ui/
    menu.ts             Menú y pantalla de pausa
    hud.ts              HUD, avisos y caja de selección
    input.ts            Eventos de teclado y ratón
  game/
    update.ts           Actualización de la simulación
tests/                  Arnés, suites y build del bundle de pruebas
```

## Límites conocidos

- El guardado usa `localStorage` del navegador: no viaja entre equipos.
- No hay multijugador ni sonido ambiente.
- El camino se calcula por esquinas: funciona bien con rectángulos, no con
  formas orgánicas.
- Los enemigos no construyen ni producen: el campamento solo manda guardias y
  oleadas.

// =====================================================================
// Mi primer RTS — Sesión 5
// Talar el árbol y llevar la madera al HUD, cámara con zoom y scroll en los
// bordes, y colisiones entre unidades.
// =====================================================================

// 1. Canvas y pincel
const canvas = document.getElementById("game");   // Elemento canvas del DOM
const ctx = canvas.getContext("2d");              // Contexto 2D para dibujar

// 2. Configuración del mundo
const camera = { x: 200, y: 150, zoom: 1 };       // Vista: esquina superior izquierda y zoom
const MIN_ZOOM = 0.75;                            // Cuánto se puede alejar la cámara
const MAX_ZOOM = 1.6;                             // Cuánto se puede acercar
const TILE_SIZE = 100;                            // Tamaño de cada celda de la cuadrícula
const world = { width: 1600, height: 1200 };      // Tamaño del mundo en píxeles

const CAMERA_SPEED = 400;                         // Píxeles por segundo que se mueve la cámara
const EDGE_SCROLL_MARGIN = 24;                    // Distancia al borde que activa el scroll
const UNIT_SPEED = 160;                           // Píxeles por segundo que camina una unidad
const UNIT_SIZE = 40;                             // Lado del cuadrado de cada unidad
const EFFECT_DURATION = 0.6;                      // Segundos que dura el círculo que marca el destino

const GATHER_RATE = 12;                           // Madera por segundo que extrae cada unidad
const WOOD_PER_TREE = 300;                        // Madera que guarda un árbol
const HUD_HEIGHT = 64;                            // Alto de la barra de interfaz

// Cada unidad guarda su ruta (path) y su destino actual (dest):
// null = quieta; { x, y } = caminando hacia allí.
const units = [
  { x: 600, y: 400, size: UNIT_SIZE, selected: false, dest: null },
  { x: 660, y: 400, size: UNIT_SIZE, selected: false, dest: null },
  { x: 720, y: 400, size: UNIT_SIZE, selected: false, dest: null },
  { x: 600, y: 460, size: UNIT_SIZE, selected: false, dest: null },
  { x: 660, y: 460, size: UNIT_SIZE, selected: false, dest: null },
  { x: 720, y: 460, size: UNIT_SIZE, selected: false, dest: null },
];

const tree = { x: 900, y: 500, size: 60, wood: WOOD_PER_TREE, maxWood: WOOD_PER_TREE, depleted: false }; // Árbol: da madera
const stockpile = { wood: 0 };                    // Recursos del jugador

// Rectángulos que bloquean el paso. De momento solo el árbol; cuando haya
// edificios, bastará con añadirlos a esta lista.
const obstacles = [tree];

// Separación mínima entre una unidad y un obstáculo cuando se recoloca un
// destino. Debe ser mayor que el margen de la ruta (paddedRect) para que el
// destino quede siempre fuera de la zona "engordada".
const OBSTACLE_MARGIN = 3;

// 2.1. Estado de la entrada
const keys = {};                                  // Teclas presionadas (por nombre en minúsculas)

// Caja de selección que se está dibujando con el ratón.
// Guardamos las coordenadas en píxeles del canvas, no del mundo: así la caja
// no se deforma si mientras arrastras mueves la cámara con el teclado.
const drag = {
  active: false,        // ¿Hay un arrastre en curso?
  additive: false,      // ¿Se pulsó Shift al empezar? (añadir a lo ya seleccionado)
  moved: false,         // ¿Se movió el ratón lo suficiente como para ser una caja?
  startScreenX: 0,
  startScreenY: 0,
  endScreenX: 0,
  endScreenY: 0,
};

const effects = [];                               // Círculos que marcan a dónde se dio la orden

// Estado del ratón, para el scroll cuando se acerca a los bordes.
const mouse = { screenX: 0, screenY: 0, inside: false };

let elapsed = 0;                                  // Tiempo de juego acumulado (para animaciones)

// ---------------------------------------------------------------------
// 3. Utilidades geométricas
// ---------------------------------------------------------------------

// Convierte la posición del ratón a coordenadas del canvas y del mundo.
// El factor de escala es por si algún día el CSS cambia el tamaño del canvas.
function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const screenX = (event.clientX - rect.left) * scaleX;
  const screenY = (event.clientY - rect.top) * scaleY;
  const point = screenToWorld(screenX, screenY);
  return { screenX, screenY, x: point.x, y: point.y };
}

// Pasa un punto de la pantalla a coordenadas del mundo (teniendo en cuenta el zoom).
function screenToWorld(screenX, screenY) {
  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y,
  };
}

// ¿Se solapan dos rectángulos { x, y, w, h }?
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ¿El punto (x, y) está dentro del rectángulo?
function pointInRect(x, y, rect) {
  return x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
}

// ¿El segmento que va de (x1,y1) a (x2,y2) atraviesa el rectángulo?
// Recorremos el segmento a pasos de 4 px; es suficiente para rectángulos
// grandes como el del árbol y se entiende mejor que una fórmula.
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rect)) {
      return true;
    }
  }
  return false;
}

// Rectángulo del obstáculo "engordado": si el centro de la unidad pasa por
// fuera de él, su cuerpo no roza el obstáculo.
function paddedRect(obstacle, unit) {
  const pad = unit.size / 2 + 2;
  return {
    x: obstacle.x - pad,
    y: obstacle.y - pad,
    w: obstacle.size + pad * 2,
    h: obstacle.size + pad * 2,
  };
}

// Rectángulo que ocupa una unidad en el mundo.
function unitRect(unit) {
  return { x: unit.x, y: unit.y, w: unit.size, h: unit.size };
}

// Devuelve la unidad que contiene un punto del mundo, o null.
function unitAt(worldX, worldY) {
  for (const unit of units) {
    if (
      worldX >= unit.x &&
      worldX <= unit.x + unit.size &&
      worldY >= unit.y &&
      worldY <= unit.y + unit.size
    ) {
      return unit;
    }
  }
  return null;
}

// ¿Puede una unidad estar en esta posición? (dentro del mundo y fuera de los obstáculos)
function canStand(unit, x, y) {
  if (x < 0 || y < 0 || x + unit.size > world.width || y + unit.size > world.height) {
    return false;
  }
  const box = { x, y, w: unit.size, h: unit.size };
  for (const obstacle of obstacles) {
    const obstacleRect = { x: obstacle.x, y: obstacle.y, w: obstacle.size, h: obstacle.size };
    if (rectsOverlap(box, obstacleRect)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------
// 4. Selección
// ---------------------------------------------------------------------

function clearSelection() {
  for (const unit of units) {
    unit.selected = false;
  }
}

function selectedUnits() {
  return units.filter((unit) => unit.selected);
}

// Caja de selección actual, ya convertida al mundo.
function selectionBox() {
  const start = screenToWorld(drag.startScreenX, drag.startScreenY);
  const end = screenToWorld(drag.endScreenX, drag.endScreenY);
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

// Al soltar el botón izquierdo decidimos si fue un clic o una caja.
function finishDrag() {
  if (!drag.moved) {
    // Fue un clic: seleccionar la unidad bajo el cursor.
    if (!drag.additive) clearSelection();
    const click = screenToWorld(drag.startScreenX, drag.startScreenY);
    const hit = unitAt(click.x, click.y);
    if (hit) hit.selected = true;
    return;
  }

  // Fue una caja: seleccionar todas las unidades que toca.
  if (!drag.additive) clearSelection();
  const box = selectionBox();
  for (const unit of units) {
    if (rectsOverlap(box, unitRect(unit))) {
      unit.selected = true;
    }
  }
}

// ---------------------------------------------------------------------
// 5. Órdenes de movimiento
// ---------------------------------------------------------------------

// Coloca el destino dentro del mundo y fuera de los obstáculos, para que una
// unidad nunca reciba la orden de meterse en un sitio donde no cabe.
function clampDestination(unit, x, y) {
  const maxX = world.width - unit.size;
  const maxY = world.height - unit.size;
  let tx = Math.max(0, Math.min(x, maxX));
  let ty = Math.max(0, Math.min(y, maxY));

  for (const obstacle of obstacles) {
    const obstacleRect = { x: obstacle.x, y: obstacle.y, w: obstacle.size, h: obstacle.size };
    const unitBox = { x: tx, y: ty, w: unit.size, h: unit.size };
    if (!rectsOverlap(unitBox, obstacleRect)) continue;

    // Empujar el destino hacia el lado del obstáculo que esté más cerca.
    const outLeft = unitBox.x + unitBox.w - obstacleRect.x;      // distancia para salir por la izquierda
    const outRight = obstacleRect.x + obstacleRect.w - unitBox.x;  // ... por la derecha
    const outTop = unitBox.y + unitBox.h - obstacleRect.y;         // ... por arriba
    const outBottom = obstacleRect.y + obstacleRect.h - unitBox.y; // ... por abajo
    const smallest = Math.min(outLeft, outRight, outTop, outBottom);

    if (smallest === outLeft) tx = obstacleRect.x - unit.size - OBSTACLE_MARGIN;
    else if (smallest === outRight) tx = obstacleRect.x + obstacleRect.w + OBSTACLE_MARGIN;
    else if (smallest === outTop) ty = obstacleRect.y - unit.size - OBSTACLE_MARGIN;
    else ty = obstacleRect.y + obstacleRect.h + OBSTACLE_MARGIN;

    tx = Math.max(0, Math.min(tx, maxX));
    ty = Math.max(0, Math.min(ty, maxY));
  }

  return { x: tx, y: ty };
}

// Ruta de una unidad hasta su destino: en línea recta si no hay nada en medio,
// o rodeando por una o dos esquinas de un obstáculo que sí estorbe.
function buildRoute(unit, target) {
  const centerX = unit.x + unit.size / 2;
  const centerY = unit.y + unit.size / 2;
  const targetX = target.x + unit.size / 2;
  const targetY = target.y + unit.size / 2;

  // ¿Hay algún obstáculo entre la unidad y el destino?
  let blocking = null;
  for (const obstacle of obstacles) {
    const rect = paddedRect(obstacle, unit);
    if (segmentHitsRect(centerX, centerY, targetX, targetY, rect)) {
      blocking = rect;
      break;
    }
  }

  if (!blocking) return [target];

  // Coordenadas de las cuatro esquinas del rectángulo engordado.
  const corners = [
    { x: blocking.x, y: blocking.y },
    { x: blocking.x + blocking.w, y: blocking.y },
    { x: blocking.x + blocking.w, y: blocking.y + blocking.h },
    { x: blocking.x, y: blocking.y + blocking.h },
  ];

  // Rutas candidatas: por una esquina, o por dos esquinas seguidas.
  const candidates = [];
  for (let i = 0; i < corners.length; i++) {
    candidates.push([corners[i]]);
    for (let j = 0; j < corners.length; j++) {
      if (i !== j) candidates.push([corners[i], corners[j]]);
    }
  }

  let bestRoute = null;
  let bestCost = Infinity;

  for (const candidate of candidates) {
    const points = [{ x: centerX, y: centerY }, ...candidate, { x: targetX, y: targetY }];
    let clear = true;
    let cost = 0;

    for (let i = 0; i < points.length - 1; i++) {
      if (segmentHitsRect(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, blocking)) {
        clear = false;
        break;
      }
      cost += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }

    if (clear && cost < bestCost) {
      bestCost = cost;
      bestRoute = candidate;
    }
  }

  // Si no hay ninguna ruta libre, que vaya en línea recta: al menos se acercará.
  if (!bestRoute) return [target];

  // Las esquinas son para el centro de la unidad; las pasamos a su esquina
  // superior izquierda, que es como se guardan las posiciones.
  const waypoints = bestRoute.map((corner) =>
    clampDestination(unit, corner.x - unit.size / 2, corner.y - unit.size / 2)
  );
  return [...waypoints, target];
}

// Reparte las unidades seleccionadas en una formación alrededor del punto
// y les asigna su destino a cada una.
function issueMoveOrder(worldX, worldY) {
  const selected = selectedUnits();
  if (selected.length === 0) return;

  // Si el clic cae sobre el árbol, la orden es talar en vez de moverse.
  const treeRect = { x: tree.x, y: tree.y, w: tree.size, h: tree.size };
  if (!tree.depleted && pointInRect(worldX, worldY, treeRect)) {
    orderGather(selected);
    effects.push({ x: worldX, y: worldY, age: 0, color: "#8fce6b" });
    return;
  }

  // Al moverse, se cancela cualquier tala en curso.
  for (const unit of selected) {
    unit.gathering = false;
    unit.gatherOrder = false;
  }

  const spacing = 48;                                    // separación entre unidades
  const columns = Math.ceil(Math.sqrt(selected.length)); // formación lo más cuadrada posible
  const rows = Math.ceil(selected.length / columns);

  // Origen de la formación: centrada en el punto clicado.
  const startX = worldX - ((columns - 1) * spacing) / 2;
  const startY = worldY - ((rows - 1) * spacing) / 2;

  // La unidad más cercana recibe el hueco más cercano: así no se cruzan tanto.
  const ordered = [...selected].sort((a, b) => {
    const da = Math.hypot(a.x - worldX, a.y - worldY);
    const db = Math.hypot(b.x - worldX, b.y - worldY);
    return da - db;
  });

  ordered.forEach((unit, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const target = clampDestination(unit, startX + column * spacing, startY + row * spacing);
    unit.path = buildRoute(unit, target);   // [destino] o [esquina, destino]
    unit.dest = unit.path[0];
    unit.stuckTime = 0;
  });

  effects.push({ x: worldX, y: worldY, age: 0 });
}

// Huecos alrededor del árbol donde se colocan las unidades que talan:
// ocho posiciones, en las cuatro caras y en las cuatro esquinas.
function gatherSlots(node) {
  const gap = node.size / 2 + UNIT_SIZE / 2 + 4;    // distancia del centro al centro
  const offsets = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
  ];

  return offsets.map((offset) => ({
    x: node.x + node.size / 2 + offset.x * gap - UNIT_SIZE / 2,
    y: node.y + node.size / 2 + offset.y * gap - UNIT_SIZE / 2,
  }));
}

// Manda a las unidades a talar: cada una recibe el hueco libre más cercano.
function orderGather(selected) {
  const freeSlots = gatherSlots(tree);

  // Las unidades más cercanas eligen primero, para repartir mejor los huecos.
  const ordered = [...selected].sort((a, b) => {
    const da = Math.hypot(a.x - tree.x, a.y - tree.y);
    const db = Math.hypot(b.x - tree.x, b.y - tree.y);
    return da - db;
  });

  for (const unit of ordered) {
    if (freeSlots.length === 0) break;             // más unidades que huecos

    let bestIndex = 0;
    let bestDistance = Infinity;
    freeSlots.forEach((slot, index) => {
      const distance = Math.hypot(slot.x - unit.x, slot.y - unit.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const slot = freeSlots.splice(bestIndex, 1)[0];
    unit.gatherOrder = true;
    unit.gathering = false;
    unit.path = buildRoute(unit, slot);
    unit.dest = unit.path[0];
    unit.stuckTime = 0;
  }
}

// ---------------------------------------------------------------------
// 6. Eventos
// ---------------------------------------------------------------------

// 6.1. Teclado
window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();                 // las flechas no deben hacer scroll
  }
  if (event.key === "Escape") {
    clearSelection();
  }
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

// Si la ventana pierde el foco (Alt+Tab), soltamos todo: si no, la cámara
// seguiría moviéndose sola al volver.
window.addEventListener("blur", () => {
  for (const key in keys) {
    keys[key] = false;
  }
  drag.active = false;
  mouse.inside = false;
});

// 6.2. Ratón
canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;           // solo el botón izquierdo
  const p = pointerPosition(event);
  if (p.screenY >= canvas.height - HUD_HEIGHT) return;   // clic en la interfaz, no en el mapa
  drag.active = true;
  drag.additive = event.shiftKey;
  drag.moved = false;
  drag.startScreenX = p.screenX;
  drag.startScreenY = p.screenY;
  drag.endScreenX = p.screenX;
  drag.endScreenY = p.screenY;
});

// Escuchamos en window, no en el canvas: así el arrastre sigue funcionando
// aunque el ratón se salga del lienzo a mitad de la caja.
window.addEventListener("mousemove", (event) => {
  if (!drag.active) return;
  const p = pointerPosition(event);
  drag.endScreenX = p.screenX;
  drag.endScreenY = p.screenY;

  const distance = Math.hypot(drag.endScreenX - drag.startScreenX, drag.endScreenY - drag.startScreenY);
  if (distance > 4) {
    drag.moved = true;                      // más de 4 px: es una caja, no un clic
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || !drag.active) return;
  finishDrag();
  drag.active = false;
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();                   // quitar el menú contextual del navegador
  const p = pointerPosition(event);
  if (p.screenY >= canvas.height - HUD_HEIGHT) return;   // clic en la interfaz
  issueMoveOrder(p.x, p.y);
});

// Seguimiento del ratón, para el scroll cuando se acerca a los bordes.
canvas.addEventListener("mousemove", (event) => {
  const p = pointerPosition(event);
  mouse.screenX = p.screenX;
  mouse.screenY = p.screenY;
  mouse.inside = true;
});

canvas.addEventListener("mouseleave", () => {
  mouse.inside = false;
});

// Rueda del ratón: zoom manteniendo el punto del mundo bajo el cursor.
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();

  const before = pointerPosition(event);
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
  if (zoom === camera.zoom) return;

  camera.zoom = zoom;
  camera.x = before.x - before.screenX / zoom;
  camera.y = before.y - before.screenY / zoom;
  clampCamera();
}, { passive: false });

// ---------------------------------------------------------------------
// 7. Actualizar el estado
// ---------------------------------------------------------------------

// Mueve una unidad hacia su destino. La ruta ya esquiva los obstáculos, pero si
// algo la bloquea de todos modos, intenta deslizarse por uno de los dos ejes.
function updateUnit(unit, dt) {
  if (!unit.dest) return;

  const dx = unit.dest.x - unit.x;
  const dy = unit.dest.y - unit.y;
  const distance = Math.hypot(dx, dy);
  const step = UNIT_SPEED * dt;

  // Ya llegó (o el paso de este frame la deja más cerca que el propio destino).
  if (distance <= step) {
    unit.x = unit.dest.x;
    unit.y = unit.dest.y;
    unit.stuckTime = 0;

    // Puede quedar otra parada en la ruta (la esquina del obstáculo).
    unit.path.shift();
    unit.dest = unit.path.length > 0 ? unit.path[0] : null;

    // Si venía a talar y ya está en su hueco, empieza a trabajar.
    if (!unit.dest && unit.gatherOrder && !tree.depleted) {
      unit.gathering = true;
    }
    return;
  }

  const moveX = (dx / distance) * step;
  const moveY = (dy / distance) * step;

  const startX = unit.x;
  const startY = unit.y;

  if (canStand(unit, unit.x + moveX, unit.y + moveY)) {
    unit.x += moveX;
    unit.y += moveY;
  } else if (moveX !== 0 && canStand(unit, unit.x + moveX, unit.y)) {
    unit.x += moveX;                        // deslizarse en horizontal
  } else if (moveY !== 0 && canStand(unit, unit.x, unit.y + moveY)) {
    unit.y += moveY;                        // deslizarse en vertical
  }

  // Contar como avance solo si de verdad se movió: un deslizamiento de 0 px
  // no debe reiniciar el temporizador de bloqueo.
  if (Math.hypot(unit.x - startX, unit.y - startY) > 0.0001) {
    unit.stuckTime = 0;
  } else {
    // Totalmente bloqueada: si sigue así mucho tiempo, abandonar la orden.
    unit.stuckTime = (unit.stuckTime || 0) + dt;
    if (unit.stuckTime > 1.5) {
      unit.dest = null;
      unit.path = [];
      unit.stuckTime = 0;
    }
  }
}

function clampCamera() {
  // La vista útil es el canvas menos la barra de interfaz de abajo.
  const viewWidth = canvas.width / camera.zoom;
  const viewHeight = (canvas.height - HUD_HEIGHT) / camera.zoom;
  const maxX = Math.max(0, world.width - viewWidth);
  const maxY = Math.max(0, world.height - viewHeight);
  camera.x = Math.max(0, Math.min(camera.x, maxX));
  camera.y = Math.max(0, Math.min(camera.y, maxY));
}

function update(dt) {
  elapsed += dt;

  // A velocidad constante en pantalla: con zoom alejado la cámara recorre más
  // mundo por segundo, y al acercarse menos, para que se sienta igual.
  const cameraStep = (CAMERA_SPEED / camera.zoom) * dt;

  // Cámara con el teclado
  if (keys["w"] || keys["arrowup"]) camera.y -= cameraStep;
  if (keys["s"] || keys["arrowdown"]) camera.y += cameraStep;
  if (keys["a"] || keys["arrowleft"]) camera.x -= cameraStep;
  if (keys["d"] || keys["arrowright"]) camera.x += cameraStep;

  // Cámara cuando el ratón se acerca al borde de la pantalla
  if (mouse.inside) {
    const viewBottom = canvas.height - HUD_HEIGHT;

    if (mouse.screenX < EDGE_SCROLL_MARGIN) camera.x -= cameraStep;
    if (mouse.screenX > canvas.width - EDGE_SCROLL_MARGIN) camera.x += cameraStep;
    if (mouse.screenY < EDGE_SCROLL_MARGIN) camera.y -= cameraStep;
    if (mouse.screenY > viewBottom - EDGE_SCROLL_MARGIN && mouse.screenY < viewBottom) {
      camera.y += cameraStep;
    }
  }

  clampCamera();

  // Unidades
  for (const unit of units) {
    updateUnit(unit, dt);
  }

  // Que no se pisen entre ellas
  separateUnits();

  // Tala: cada unidad que trabaja va sacando madera del árbol.
  for (const unit of units) {
    if (!unit.gathering) continue;
    if (tree.depleted || tree.wood <= 0) {
      unit.gathering = false;
      unit.gatherOrder = false;
      continue;
    }

    const amount = Math.min(GATHER_RATE * dt, tree.wood);
    tree.wood -= amount;
    stockpile.wood += amount;

    if (tree.wood <= 0) {
      depleteTree();
    }
  }

  // Efectos (el círculo del destino se va apagando)
  for (const effect of effects) {
    effect.age += dt;
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].age > EFFECT_DURATION) {
      effects.splice(i, 1);
    }
  }
}

// Cuando el árbol se queda sin madera: pasa a ser un tocón y deja de estorbar.
function depleteTree() {
  if (tree.depleted) return;
  tree.depleted = true;
  tree.wood = 0;

  // Ya no bloquea el paso: se puede caminar por encima del tocón.
  const index = obstacles.indexOf(tree);
  if (index !== -1) obstacles.splice(index, 1);

  for (const unit of units) {
    unit.gathering = false;
    unit.gatherOrder = false;
  }
}

// Empuja las unidades que se solapan para que no se pisen. Solo se separan
// las que están quietas: mientras caminan pueden cruzarse, y así no se
// bloquean al compartir la misma esquina de una ruta.
function separateUnits() {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        if (a.dest || b.dest) continue;
        separatePair(a, b);
      }
    }
  }
}

function separatePair(a, b) {
  const overlapX = Math.min(a.x + a.size, b.x + b.size) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.size, b.y + b.size) - Math.max(a.y, b.y);
  if (overlapX <= 0 || overlapY <= 0) return;

  // Separarlas por el eje en el que se solapan menos.
  if (overlapX < overlapY) {
    const push = overlapX / 2 + 0.5;
    const direction = a.x < b.x ? 1 : -1;
    pushApart(a, -push * direction, 0);
    pushApart(b, push * direction, 0);
  } else {
    const push = overlapY / 2 + 0.5;
    const direction = a.y < b.y ? 1 : -1;
    pushApart(a, 0, -push * direction);
    pushApart(b, 0, push * direction);
  }
}

// Mueve una unidad solo si la posición de destino es válida.
function pushApart(unit, dx, dy) {
  if (canStand(unit, unit.x + dx, unit.y + dy)) {
    unit.x += dx;
    unit.y += dy;
  }
}

// ---------------------------------------------------------------------
// 8. Dibujar
// ---------------------------------------------------------------------

// La cuadrícula se dibuja en coordenadas del mundo: la transformación del
// render ya le aplica la cámara y el zoom.
function drawGrid() {
  ctx.strokeStyle = "#3a5a42";
  ctx.lineWidth = 1 / camera.zoom;

  for (let x = 0; x <= world.width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (let y = 0; y <= world.height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
}

function drawTree() {
  if (tree.depleted) {
    // Tocón: el árbol ya se taló.
    ctx.fillStyle = "#6b4a24";
    ctx.fillRect(tree.x + tree.size * 0.2, tree.y + tree.size * 0.55, tree.size * 0.6, tree.size * 0.3);
    return;
  }

  // Tronco
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(tree.x + tree.size * 0.35, tree.y + tree.size * 0.5, tree.size * 0.3, tree.size * 0.5);

  // Copa
  ctx.fillStyle = "#2f6b3d";
  ctx.beginPath();
  ctx.arc(tree.x + tree.size / 2, tree.y + tree.size / 2, tree.size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Barra con la madera que le queda
  const ratio = tree.wood / tree.maxWood;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(tree.x, tree.y - 14, tree.size, 8);
  ctx.fillStyle = "#8fce6b";
  ctx.fillRect(tree.x, tree.y - 14, tree.size * ratio, 8);
}

function drawEffects() {
  for (const effect of effects) {
    const t = effect.age / EFFECT_DURATION;            // 0 al empezar, 1 al desaparecer
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 6 + t * 26, 0, Math.PI * 2);
    ctx.strokeStyle = effect.color || "#fbbf24";
    ctx.globalAlpha = 1 - t;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawUnits() {
  for (const unit of units) {
    ctx.fillStyle = unit.selected ? "#fbbf24" : "#3b82f6";
    ctx.fillRect(unit.x, unit.y, unit.size, unit.size);

    if (unit.selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeRect(unit.x, unit.y, unit.size, unit.size);
    }

    if (unit.gathering) {
      // Arco que se balancea como un hacha mientras trabaja
      const swing = Math.sin(elapsed * 10) * 0.8;
      ctx.strokeStyle = "#8fce6b";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.beginPath();
      ctx.arc(unit.x + unit.size / 2, unit.y - 6, 6, -Math.PI / 2 + swing, Math.PI / 2 + swing);
      ctx.stroke();
    }
  }
}

function drawSelectionBox() {
  if (!drag.active || !drag.moved) return;

  const x = Math.min(drag.startScreenX, drag.endScreenX);
  const y = Math.min(drag.startScreenY, drag.endScreenY);
  const w = Math.abs(drag.endScreenX - drag.startScreenX);
  const h = Math.abs(drag.endScreenY - drag.startScreenY);

  ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.setLineDash([]);                                // no dejar el trazo discontinuo para lo siguiente
}

function drawHud() {
  const top = canvas.height - HUD_HEIGHT;

  ctx.fillStyle = "rgba(8, 12, 16, 0.88)";
  ctx.fillRect(0, top, canvas.width, HUD_HEIGHT);

  ctx.strokeStyle = "#2c3a33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, top + 0.5);
  ctx.lineTo(canvas.width, top + 0.5);
  ctx.stroke();

  // Madera
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(16, top + 22, 20, 20);
  ctx.strokeStyle = "#c98a4b";
  ctx.strokeRect(16.5, top + 22.5, 19, 19);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText(`Madera: ${Math.floor(stockpile.wood + 1e-9)}`, 46, top + 38);

  // Unidades seleccionadas
  ctx.fillStyle = "#aab4c0";
  ctx.fillText(`Seleccionadas: ${selectedUnits().length}`, 220, top + 38);

  // Ayuda
  ctx.fillStyle = "#7d8794";
  ctx.font = "13px system-ui";
  ctx.fillText("Clic derecho: mover · sobre el árbol: talar", 420, top + 37);
}

function render() {
  // Borrar y pintar el fondo (en coordenadas de pantalla)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#24382a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mundo: la cámara se aplica con una transformación. Todo lo que se dibuje
  // a partir de aquí usa coordenadas del mundo, sin restar la cámara a mano.
  ctx.setTransform(
    camera.zoom, 0,
    0, camera.zoom,
    -camera.x * camera.zoom, -camera.y * camera.zoom
  );

  drawGrid();
  drawTree();
  drawEffects();
  drawUnits();

  // Interfaz: de vuelta a coordenadas de pantalla
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawSelectionBox();
  drawHud();
}

// ---------------------------------------------------------------------
// 9. Bucle del juego
// ---------------------------------------------------------------------
let lastTime = performance.now();

function gameLoop(now) {
  // Tope de 1/20 de segundo: si la pestaña estuvo en segundo plano o hubo un
  // tirón, la cámara y las unidades no pegan un salto enorme de golpe.
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
console.log("Juego iniciado");

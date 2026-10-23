// =====================================================================
// Mi primer RTS — Sesión 4
// Selección con caja de arrastre y órdenes de movimiento con clic derecho.
// =====================================================================

// 1. Canvas y pincel
const canvas = document.getElementById("game");   // Elemento canvas del DOM
const ctx = canvas.getContext("2d");              // Contexto 2D para dibujar

// 2. Configuración del mundo
const camera = { x: 200, y: 150 };                // Esquina superior izquierda de la vista
const TILE_SIZE = 100;                            // Tamaño de cada celda de la cuadrícula
const world = { width: 1600, height: 1200 };      // Tamaño del mundo en píxeles

const CAMERA_SPEED = 400;                         // Píxeles por segundo que se mueve la cámara
const UNIT_SPEED = 160;                           // Píxeles por segundo que camina una unidad
const EFFECT_DURATION = 0.6;                      // Segundos que dura el círculo que marca el destino

// Cada unidad guarda su ruta (path) y su destino actual (dest):
// null = quieta; { x, y } = caminando hacia allí.
const units = [
  { x: 600, y: 400, size: 40, selected: false, dest: null },
  { x: 660, y: 400, size: 40, selected: false, dest: null },
  { x: 720, y: 400, size: 40, selected: false, dest: null },
  { x: 600, y: 460, size: 40, selected: false, dest: null },
  { x: 660, y: 460, size: 40, selected: false, dest: null },
  { x: 720, y: 460, size: 40, selected: false, dest: null },
];

const tree = { x: 900, y: 500, size: 60 };        // Árbol (será un recurso más adelante)

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
  return { screenX, screenY, x: screenX + camera.x, y: screenY + camera.y };
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
  const x1 = drag.startScreenX + camera.x;
  const y1 = drag.startScreenY + camera.y;
  const x2 = drag.endScreenX + camera.x;
  const y2 = drag.endScreenY + camera.y;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

// Al soltar el botón izquierdo decidimos si fue un clic o una caja.
function finishDrag() {
  if (!drag.moved) {
    // Fue un clic: seleccionar la unidad bajo el cursor.
    if (!drag.additive) clearSelection();
    const hit = unitAt(drag.startScreenX + camera.x, drag.startScreenY + camera.y);
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
});

// 6.2. Ratón
canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;           // solo el botón izquierdo
  const p = pointerPosition(event);
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
  issueMoveOrder(p.x, p.y);
});

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

function update(dt) {
  // Cámara
  if (keys["w"] || keys["arrowup"]) camera.y -= CAMERA_SPEED * dt;
  if (keys["s"] || keys["arrowdown"]) camera.y += CAMERA_SPEED * dt;
  if (keys["a"] || keys["arrowleft"]) camera.x -= CAMERA_SPEED * dt;
  if (keys["d"] || keys["arrowright"]) camera.x += CAMERA_SPEED * dt;

  // Límites del mundo
  const maxX = world.width - canvas.width;
  const maxY = world.height - canvas.height;
  camera.x = Math.max(0, Math.min(camera.x, maxX));
  camera.y = Math.max(0, Math.min(camera.y, maxY));

  // Unidades
  for (const unit of units) {
    updateUnit(unit, dt);
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

// ---------------------------------------------------------------------
// 8. Dibujar
// ---------------------------------------------------------------------

function drawTree() {
  // Pasar del mundo a la pantalla: sin esto el árbol se dibuja fuera del canvas.
  const screenX = tree.x - camera.x;
  const screenY = tree.y - camera.y;

  // Tronco
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(screenX + tree.size * 0.35, screenY + tree.size * 0.5, tree.size * 0.3, tree.size * 0.5);
  // Copa
  ctx.fillStyle = "#2f6b3d";
  ctx.beginPath();
  ctx.arc(screenX + tree.size / 2, screenY + tree.size / 2, tree.size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEffects() {
  for (const effect of effects) {
    const t = effect.age / EFFECT_DURATION;            // 0 al empezar, 1 al desaparecer
    ctx.beginPath();
    ctx.arc(effect.x - camera.x, effect.y - camera.y, 6 + t * 26, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251, 191, 36, ${1 - t})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawUnits() {
  for (const unit of units) {
    const screenX = unit.x - camera.x;
    const screenY = unit.y - camera.y;

    ctx.fillStyle = unit.selected ? "#fbbf24" : "#3b82f6";
    ctx.fillRect(screenX, screenY, unit.size, unit.size);

    if (unit.selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX, screenY, unit.size, unit.size);
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

function render() {
  // Borrar el frame anterior
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fondo del mundo
  ctx.fillStyle = "#24382a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cuadrícula del mundo
  ctx.strokeStyle = "#3a5a42";
  ctx.lineWidth = 1;

  for (let x = 0; x <= world.width; x += TILE_SIZE) {
    const screenX = x - camera.x;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= world.height; y += TILE_SIZE) {
    const screenY = y - camera.y;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvas.width, screenY);
    ctx.stroke();
  }

  // Escenario
  drawTree();
  drawEffects();

  // Unidades
  drawUnits();

  // Caja de selección (por encima de todo)
  drawSelectionBox();

  // Interfaz
  const count = selectedUnits().length;
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText(
    `Cámara: ${Math.round(camera.x)}, ${Math.round(camera.y)} · Seleccionadas: ${count}`,
    16,
    24
  );
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

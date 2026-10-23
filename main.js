// =====================================================================
// Mi primer RTS — Sesión 6
// Cuartel: se construye gastando madera, entrena unidades y bloquea el paso.
// Rutas con grafo de esquinas para rodear varios edificios.
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
const CARRY_CAPACITY = 10;                        // Madera que cabe en un viaje
const WOOD_PER_TREE = 300;                        // Madera que guarda un árbol
const HUD_HEIGHT = 64;                            // Alto de la barra de interfaz

const BARRACKS_COST = 150;                        // Madera que cuesta un cuartel
const BARRACKS_SIZE = 80;                         // Lado del cuartel
const BARRACKS_HP = 300;                          // Vida de un cuartel
const UNIT_COST = 50;                             // Madera que cuesta entrenar una unidad
const TRAIN_TIME = 4;                             // Segundos que tarda una unidad
const MAX_QUEUE = 5;                              // Unidades en cola por cuartel
const MAX_UNITS = 40;                             // Tope de unidades en el mapa
const BUILD_SNAP = 20;                            // El cuartel se coloca en una rejilla de 20 px

// Combate
const TEAM_PLAYER = "player";
const TEAM_ENEMY = "enemy";

const UNIT_MAX_HP = 100;                          // Vida de un soldado
const UNIT_DAMAGE = 12;                           // Daño por golpe
const UNIT_ATTACK_RANGE = 12;                     // Hueco entre bordes al atacar
const UNIT_ATTACK_COOLDOWN = 0.8;                 // Segundos entre golpes

const ENEMY_MAX_HP = 80;
const ENEMY_DAMAGE = 8;
const ENEMY_ATTACK_RANGE = 12;
const ENEMY_ATTACK_COOLDOWN = 1.2;
const ENEMY_AGGRO_RANGE = 320;                    // Hasta dónde persigue un enemigo

const CAMP_HP = 400;                              // Vida del campamento enemigo
const CAMP_SIZE = 90;
const CAMP_SPAWN_INTERVAL = 12;                   // Segundos entre guardias
const CAMP_MAX_GUARDS = 6;
const CAMP_GUARD_RADIUS = 300;                    // Sólo saca guardias si te acercas

// Crea una unidad del equipo indicado con sus estadísticas de combate.
function createUnit(x, y, team) {
  const player = team === TEAM_PLAYER;
  const hp = player ? UNIT_MAX_HP : ENEMY_MAX_HP;

  return {
    x,
    y,
    size: UNIT_SIZE,
    team,
    hp,
    maxHp: hp,
    damage: player ? UNIT_DAMAGE : ENEMY_DAMAGE,
    range: player ? UNIT_ATTACK_RANGE : ENEMY_ATTACK_RANGE,
    cooldownMax: player ? UNIT_ATTACK_COOLDOWN : ENEMY_ATTACK_COOLDOWN,
    cooldown: 0,
    attackTarget: null,
    repathTimer: 0,
    selected: false,
    dest: null,
    path: [],
    gathering: false,
    gatherOrder: false,
    task: null,
    carrying: 0,
    stuckTime: 0,
  };
}

// Las seis unidades con las que empieza el jugador.
const units = [
  createUnit(600, 400, TEAM_PLAYER),
  createUnit(660, 400, TEAM_PLAYER),
  createUnit(720, 400, TEAM_PLAYER),
  createUnit(600, 460, TEAM_PLAYER),
  createUnit(660, 460, TEAM_PLAYER),
  createUnit(720, 460, TEAM_PLAYER),
];

const tree = { x: 900, y: 500, size: 60, wood: WOOD_PER_TREE, maxWood: WOOD_PER_TREE, depleted: false }; // Árbol: da madera
const stockpile = { wood: 0 };                    // Recursos del jugador

const buildings = [];                             // Cuarteles construidos
let selectedBuilding = null;                      // Cuartel seleccionado, si hay uno

// Colocación de un edificio nuevo: sigue al ratón hasta hacer clic.
const buildMode = { active: false, x: 0, y: 0, valid: false };

// Rectángulos que bloquean el paso: el árbol y los edificios.
const obstacles = [tree];

// Campamento enemigo: no ataca hasta que te acercas, y entonces saca guardias.
const camp = {
  type: "camp",
  team: TEAM_ENEMY,
  x: 1380,
  y: 220,
  size: CAMP_SIZE,
  hp: CAMP_HP,
  maxHp: CAMP_HP,
  alive: true,
  spawnTimer: 0,
};
buildings.push(camp);
obstacles.push(camp);

// Centro de mando: punto donde los trabajadores entregan la madera.
const depot = {
  type: "depot",
  team: TEAM_PLAYER,
  x: 440,
  y: 560,
  size: 100,
  hp: 500,
  maxHp: 500,
};
buildings.push(depot);
obstacles.push(depot);

// Estado global de la partida.
const gameState = { victory: false };

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
// Se comprueba contra el rectángulo un poco encogido: así la ruta puede pasar
// justo por el borde (las esquinas) pero no cruzar por dentro.
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const inner = {
    x: rect.x + 0.01,
    y: rect.y + 0.01,
    w: rect.w - 0.02,
    h: rect.h - 0.02,
  };

  let t0 = 0;                                      // entrada del segmento
  let t1 = 1;                                      // salida del segmento
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Cada lado del rectángulo recorta el trozo de segmento que queda dentro.
  const sides = [
    [-dx, x1 - inner.x],
    [dx, inner.x + inner.w - x1],
    [-dy, y1 - inner.y],
    [dy, inner.y + inner.h - y1],
  ];

  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;                     // paralelo y fuera
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }

  return true;
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

// Devuelve el cuartel que contiene un punto del mundo, o null.
function buildingAt(worldX, worldY) {
  for (const building of buildings) {
    if (
      worldX >= building.x &&
      worldX <= building.x + building.size &&
      worldY >= building.y &&
      worldY <= building.y + building.size
    ) {
      return building;
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
  selectedBuilding = null;
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
    // Fue un clic: seleccionar lo que haya bajo el cursor.
    if (!drag.additive) clearSelection();
    const click = screenToWorld(drag.startScreenX, drag.startScreenY);

    const building = buildingAt(click.x, click.y);
    if (building && building.team === TEAM_PLAYER) {
      selectedBuilding = building;
      return;
    }
    if (building) return;          // los edificios enemigos no se seleccionan

    const hit = unitAt(click.x, click.y);
    if (hit && hit.team === TEAM_PLAYER) hit.selected = true;
    return;
  }

  // Fue una caja: seleccionar todas las unidades del jugador que toca.
  if (!drag.additive) clearSelection();
  const box = selectionBox();
  for (const unit of units) {
    if (unit.team !== TEAM_PLAYER) continue;
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

// Ruta de una unidad hasta su destino. Se construye un grafo con la salida, el
// destino y las esquinas de todos los obstáculos: si dos puntos se "ven" (el
// segmento no cruza nada) se conectan, y se busca el camino más corto.
function buildRoute(unit, target) {
  const start = { x: unit.x + unit.size / 2, y: unit.y + unit.size / 2 };
  const end = { x: target.x + unit.size / 2, y: target.y + unit.size / 2 };

  // Rectángulos engordados de todos los obstáculos.
  const blocked = obstacles.map((obstacle) => paddedRect(obstacle, unit));

  // Si no hay nada en medio, ir en línea recta.
  const crosses = blocked.some((rect) => segmentHitsRect(start.x, start.y, end.x, end.y, rect));
  if (!crosses) return [target];

  // Nodos: 0 = salida, 1 = destino, el resto = esquinas de los obstáculos.
  const nodes = [start, end];
  for (const rect of blocked) {
    nodes.push(
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h }
    );
  }

  // Aristas entre pares de nodos que se ven sin cruzar ningún obstáculo.
  const count = nodes.length;
  const edges = nodes.map(() => []);

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      let visible = true;
      for (const rect of blocked) {
        if (segmentHitsRect(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, rect)) {
          visible = false;
          break;
        }
      }
      if (!visible) continue;

      const cost = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      edges[i].push({ to: j, cost });
      edges[j].push({ to: i, cost });
    }
  }

  // Dijkstra: distancia mínima desde la salida (0) hasta cada nodo.
  const distance = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = nodes.map(() => false);
  distance[0] = 0;

  for (let step = 0; step < count; step++) {
    let current = -1;
    for (let i = 0; i < count; i++) {
      if (!visited[i] && distance[i] < Infinity && (current === -1 || distance[i] < distance[current])) {
        current = i;
      }
    }
    if (current === -1) break;

    visited[current] = true;
    for (const edge of edges[current]) {
      if (distance[current] + edge.cost < distance[edge.to]) {
        distance[edge.to] = distance[current] + edge.cost;
        previous[edge.to] = current;
      }
    }
  }

  // Sin ruta: que vaya en línea recta y se acerque todo lo que pueda.
  if (distance[1] === Infinity) return [target];

  // Reconstruir el camino desde el destino hacia atrás.
  const route = [];
  let node = 1;
  while (node !== -1 && node !== 0) {
    route.unshift(nodes[node]);
    node = previous[node];
  }

  // Las esquinas son para el centro de la unidad; se pasan a su esquina
  // superior izquierda. El destino se deja tal cual.
  return route.map((point) =>
    point === end
      ? target
      : clampDestination(unit, point.x - unit.size / 2, point.y - unit.size / 2)
  );
}

// Reparte las unidades seleccionadas en una formación alrededor del punto
// y les asigna su destino a cada una.
function issueMoveOrder(worldX, worldY) {
  const selected = selectedUnits();
  if (selected.length === 0) return;

  // Si el clic cae sobre un enemigo (unidad o edificio), la orden es atacar.
  const clickedUnit = unitAt(worldX, worldY);
  if (clickedUnit && clickedUnit.team === TEAM_ENEMY) {
    orderAttack(selected, clickedUnit);
    effects.push({ x: worldX, y: worldY, age: 0, color: "#f87171" });
    return;
  }

  const clickedBuilding = buildingAt(worldX, worldY);
  if (clickedBuilding && clickedBuilding.team === TEAM_ENEMY) {
    orderAttack(selected, clickedBuilding);
    effects.push({ x: worldX, y: worldY, age: 0, color: "#f87171" });
    return;
  }

  // Si el clic cae sobre el árbol, la orden es talar en vez de moverse.
  const treeRect = { x: tree.x, y: tree.y, w: tree.size, h: tree.size };
  if (!tree.depleted && pointInRect(worldX, worldY, treeRect)) {
    orderGather(selected);
    effects.push({ x: worldX, y: worldY, age: 0, color: "#8fce6b" });
    return;
  }

  // Al moverse, se cancela cualquier tala o ataque en curso.
  for (const unit of selected) {
    unit.gathering = false;
    unit.gatherOrder = false;
    unit.task = null;
    unit.attackTarget = null;
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
    unit.attackTarget = null;
    unit.task = { type: "gather", phase: "toTree", slot };
    unit.path = buildRoute(unit, slot);
    unit.dest = unit.path[0];
    unit.stuckTime = 0;
  }
}

// Al llegar a la última parada de la ruta.
function handleArrival(unit) {
  const task = unit.task;
  if (!task || task.type !== "gather") return;

  if (task.phase === "toTree") {
    if (tree.depleted) {
      goDeposit(unit);
      return;
    }
    task.phase = "harvest";
    unit.gathering = true;
    return;
  }

  if (task.phase === "toDepot") {
    depositWood(unit);
  }
}

// Centro de mando más cercano donde entregar la madera.
function nearestDepot(unit) {
  let best = null;
  let bestDistance = Infinity;

  for (const building of buildings) {
    if (building.type !== "depot" || building.team !== TEAM_PLAYER || building.hp <= 0) continue;

    const distance = Math.hypot(
      building.x + building.size / 2 - (unit.x + unit.size / 2),
      building.y + building.size / 2 - (unit.y + unit.size / 2)
    );
    if (distance < bestDistance) {
      best = building;
      bestDistance = distance;
    }
  }

  return best;
}

// Manda al trabajador a entregar lo que lleva.
function goDeposit(unit) {
  unit.gathering = false;

  if (unit.carrying <= 0) {
    unit.task = null;
    unit.gatherOrder = false;
    return;
  }

  const target = nearestDepot(unit);
  if (!target) {
    // Sin centro de mando no hay dónde entregar: se queda con la madera.
    unit.task = null;
    unit.gatherOrder = false;
    return;
  }

  unit.task.phase = "toDepot";
  const slot = depotSlot(target, unit);
  unit.path = buildRoute(unit, slot);
  unit.dest = unit.path[0];
  unit.stuckTime = 0;
}

// Hueco alrededor del centro de mando más cercano a la unidad.
function depotSlot(depotBuilding, unit) {
  const slots = gatherSlots(depotBuilding);

  let best = slots[0];
  let bestDistance = Infinity;
  for (const slot of slots) {
    const distance = Math.hypot(slot.x - unit.x, slot.y - unit.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  return best;
}

// Entrega la carga y, si el árbol sigue en pie, vuelve a por más.
function depositWood(unit) {
  stockpile.wood += unit.carrying;
  unit.carrying = 0;
  unit.gathering = false;

  const slot = unit.task ? unit.task.slot : null;
  const keepWorking = unit.gatherOrder && !tree.depleted && slot;

  if (!keepWorking) {
    unit.task = null;
    unit.gatherOrder = false;
    return;
  }

  unit.task = { type: "gather", phase: "toTree", slot };
  unit.path = buildRoute(unit, slot);
  unit.dest = unit.path[0];
  unit.stuckTime = 0;
}

// ---------------------------------------------------------------------
// 5.1. Cuarteles: colocación y entrenamiento
// ---------------------------------------------------------------------

// ¿Cabe un cuartel en esta posición? Sin salirse del mundo y sin pisar
// obstáculos ni unidades.
function canPlaceBuilding(x, y) {
  if (x < 0 || y < 0 || x + BARRACKS_SIZE > world.width || y + BARRACKS_SIZE > world.height) {
    return false;
  }

  const rect = { x, y, w: BARRACKS_SIZE, h: BARRACKS_SIZE };

  for (const obstacle of obstacles) {
    if (rectsOverlap(rect, { x: obstacle.x, y: obstacle.y, w: obstacle.size, h: obstacle.size })) {
      return false;
    }
  }

  for (const unit of units) {
    if (rectsOverlap(rect, unitRect(unit))) {
      return false;
    }
  }

  return true;
}

// Entra en modo colocación (o sale si ya estaba activo).
function startBuildMode() {
  if (buildMode.active) {
    cancelBuildMode();
    return;
  }
  if (stockpile.wood < BARRACKS_COST) return;

  buildMode.active = true;
  buildMode.valid = false;

  // Empezar en el centro de la vista.
  const centerX = camera.x + canvas.width / 2 / camera.zoom;
  const centerY = camera.y + (canvas.height - HUD_HEIGHT) / 2 / camera.zoom;
  updateBuildGhost(centerX, centerY);
}

function cancelBuildMode() {
  buildMode.active = false;
}

// Coloca el fantasma del cuartel en la rejilla más cercana al ratón.
function updateBuildGhost(worldX, worldY) {
  buildMode.x = Math.round((worldX - BARRACKS_SIZE / 2) / BUILD_SNAP) * BUILD_SNAP;
  buildMode.y = Math.round((worldY - BARRACKS_SIZE / 2) / BUILD_SNAP) * BUILD_SNAP;
  buildMode.valid = canPlaceBuilding(buildMode.x, buildMode.y);
}

// Intenta construir donde está el fantasma. Si no cabe, no cobra nada.
function tryPlaceBuilding() {
  if (!buildMode.active || !buildMode.valid) return;
  if (stockpile.wood < BARRACKS_COST) return;

  stockpile.wood -= BARRACKS_COST;

  const building = {
    type: "barracks",
    team: TEAM_PLAYER,
    x: buildMode.x,
    y: buildMode.y,
    size: BARRACKS_SIZE,
    hp: BARRACKS_HP,
    maxHp: BARRACKS_HP,
    queue: 0,          // unidades esperando en la cola
    progress: 0,       // segundos de la unidad que se está entrenando
  };

  buildings.push(building);
  obstacles.push(building);      // las unidades tienen que rodearlo
  buildMode.active = false;

  clearSelection();
  selectedBuilding = building;
}

// Rectángulos de los botones del HUD (en coordenadas de pantalla).
function hudButtons() {
  const y = canvas.height - HUD_HEIGHT + 12;
  return {
    train: { x: 430, y, w: 164, h: 40 },
    barracks: { x: 614, y, w: 170, h: 40 },
  };
}

function canTrain() {
  return Boolean(
    selectedBuilding &&
    selectedBuilding.type === "barracks" &&
    stockpile.wood >= UNIT_COST &&
    selectedBuilding.queue < MAX_QUEUE &&
    units.length < MAX_UNITS
  );
}

function trainUnit() {
  if (!canTrain()) return;
  stockpile.wood -= UNIT_COST;
  selectedBuilding.queue += 1;
}

// Clic en la barra inferior: solo los botones hacen algo.
function handleHudClick(screenX, screenY) {
  const buttons = hudButtons();

  if (pointInRect(screenX, screenY, buttons.barracks)) {
    startBuildMode();
    return;
  }

  if (pointInRect(screenX, screenY, buttons.train)) {
    trainUnit();
  }
}

// Avanza la cola de entrenamiento de cada cuartel del jugador.
function updateBuildings(dt) {
  for (const building of buildings) {
    if (building.type !== "barracks" || building.team !== TEAM_PLAYER) continue;
    if (!building.queue || building.queue <= 0) continue;

    building.progress += dt;
    if (building.progress < TRAIN_TIME) continue;

    // Si no hay hueco alrededor, se reintenta en el siguiente frame.
    if (spawnUnit(building)) {
      building.queue -= 1;
      building.progress = 0;
    } else {
      building.progress = TRAIN_TIME;
    }
  }
}

// Busca un hueco libre alrededor del cuartel y saca ahí la unidad nueva.
function spawnUnit(building) {
  const spot = findSpawnSpot(building);
  if (!spot) return false;

  units.push({
    x: spot.x,
    y: spot.y,
    size: UNIT_SIZE,
    selected: false,
    dest: null,
    path: [],
    gathering: false,
    gatherOrder: false,
    stuckTime: 0,
  });
  return true;
}

function findSpawnSpot(building) {
  const gap = building.size / 2 + UNIT_SIZE / 2 + 6;
  const offsets = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];

  // Varios anillos por si el primero está ocupado.
  for (let ring = 0; ring < 3; ring++) {
    const distance = gap + ring * (UNIT_SIZE + 8);

    for (const offset of offsets) {
      const x = building.x + building.size / 2 + offset.x * distance - UNIT_SIZE / 2;
      const y = building.y + building.size / 2 + offset.y * distance - UNIT_SIZE / 2;
      if (canPlaceUnit(x, y)) return { x, y };
    }
  }

  return null;
}

// ¿Cabe una unidad aquí, sin pisar obstáculos ni otras unidades?
function canPlaceUnit(x, y) {
  if (!canStand({ size: UNIT_SIZE }, x, y)) return false;

  const box = { x, y, w: UNIT_SIZE, h: UNIT_SIZE };
  for (const unit of units) {
    if (rectsOverlap(box, unitRect(unit))) return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// 5.2. Combate
// ---------------------------------------------------------------------

// Distancia desde el borde de la unidad hasta el borde del objetivo.
function distanceToTarget(unit, target) {
  const ux = unit.x + unit.size / 2;
  const uy = unit.y + unit.size / 2;
  const tx = target.x + target.size / 2;
  const ty = target.y + target.size / 2;
  const centerDistance = Math.hypot(tx - ux, ty - uy);
  return Math.max(0, centerDistance - unit.size / 2 - target.size / 2);
}

// ¿Sigue existiendo el objetivo? (una unidad muerta sale del array)
function isAliveTarget(target) {
  if (!target || target.hp <= 0) return false;
  return units.includes(target) || buildings.includes(target);
}

// El enemigo vivo más cercano (unidad o edificio del otro equipo).
function findNearestOpponent(unit, maxDistance) {
  let best = null;
  let bestDistance = maxDistance;

  for (const other of units) {
    if (other.team === unit.team || other.hp <= 0) continue;
    const distance = distanceToTarget(unit, other);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }

  for (const building of buildings) {
    if (building.team === unit.team || building.hp <= 0) continue;
    const distance = distanceToTarget(unit, building);
    if (distance < bestDistance) {
      best = building;
      bestDistance = distance;
    }
  }

  return best;
}

// Punto junto al objetivo al que la unidad se acerca para atacar.
function approachSpot(unit, target) {
  const ux = unit.x + unit.size / 2;
  const uy = unit.y + unit.size / 2;
  const tx = target.x + target.size / 2;
  const ty = target.y + target.size / 2;
  const angle = Math.atan2(uy - ty, ux - tx);
  const distance = target.size / 2 + unit.size / 2 + 6;

  return clampDestination(
    unit,
    tx + Math.cos(angle) * distance - unit.size / 2,
    ty + Math.sin(angle) * distance - unit.size / 2
  );
}

// Da la orden de atacar a las unidades seleccionadas.
function orderAttack(selected, target) {
  for (const unit of selected) {
    unit.attackTarget = target;
    unit.gatherOrder = false;
    unit.gathering = false;
    unit.task = null;
    unit.dest = null;
    unit.path = [];
    unit.stuckTime = 0;
    unit.repathTimer = 0;
  }
}

// Decide cada unidad: buscar objetivo, acercarse o golpear.
function updateCombat(unit, dt) {
  unit.cooldown = Math.max(0, unit.cooldown - dt);

  let target = unit.attackTarget;
  if (target && !isAliveTarget(target)) {
    unit.attackTarget = null;
    target = null;
  }

  // Los enemigos buscan al jugador a cierta distancia; las unidades del
  // jugador sólo responden a enemigos que ya estén a tiro.
  if (!target && !unit.dest) {
    const searchRange = unit.team === TEAM_ENEMY ? ENEMY_AGGRO_RANGE : unit.range + 10;
    target = findNearestOpponent(unit, searchRange);
    if (target) {
      unit.attackTarget = target;
    }
  }

  if (!target) return;

  if (distanceToTarget(unit, target) > unit.range) {
    // Acercarse, recalculando la ruta cada poco porque el objetivo se mueve.
    unit.repathTimer -= dt;
    if (!unit.dest || unit.repathTimer <= 0) {
      const spot = approachSpot(unit, target);
      unit.path = buildRoute(unit, spot);
      unit.dest = unit.path[0];
      unit.repathTimer = 0.4;
    }
    return;
  }

  // En rango: pararse y golpear.
  unit.dest = null;
  unit.path = [];
  unit.gathering = false;

  if (unit.cooldown <= 0) {
    applyDamage(target, unit.damage);
    unit.cooldown = unit.cooldownMax;

    effects.push({
      x: target.x + target.size / 2,
      y: target.y + target.size / 2,
      age: 0,
      color: unit.team === TEAM_ENEMY ? "#f87171" : "#fbbf24",
    });
  }
}

// Quita vida y, si llega a cero, retira la unidad o el edificio.
function applyDamage(target, amount) {
  if (!target || target.hp <= 0) return;

  target.hp -= amount;
  if (target.hp > 0) return;

  target.hp = 0;

  if (target === camp) {
    destroyCamp();
    return;
  }

  if (units.includes(target)) {
    removeUnit(target);
    return;
  }

  const buildingIndex = buildings.indexOf(target);
  if (buildingIndex !== -1) {
    buildings.splice(buildingIndex, 1);
    const obstacleIndex = obstacles.indexOf(target);
    if (obstacleIndex !== -1) obstacles.splice(obstacleIndex, 1);
    if (selectedBuilding === target) selectedBuilding = null;
  }
}

function removeUnit(unit) {
  const index = units.indexOf(unit);
  if (index !== -1) units.splice(index, 1);

  for (const other of units) {
    if (other.attackTarget === unit) other.attackTarget = null;
  }
}

function destroyCamp() {
  if (!camp.alive) return;

  camp.alive = false;
  camp.hp = 0;

  const buildingIndex = buildings.indexOf(camp);
  if (buildingIndex !== -1) buildings.splice(buildingIndex, 1);
  const obstacleIndex = obstacles.indexOf(camp);
  if (obstacleIndex !== -1) obstacles.splice(obstacleIndex, 1);

  gameState.victory = true;
}

// El campamento saca guardias si el jugador se acerca.
function updateCamp(dt) {
  if (!camp.alive) return;

  camp.spawnTimer += dt;

  const playerNear = units.some(
    (unit) =>
      unit.team === TEAM_PLAYER &&
      Math.hypot(unit.x - camp.x, unit.y - camp.y) < CAMP_GUARD_RADIUS
  );

  if (!playerNear || camp.spawnTimer < CAMP_SPAWN_INTERVAL) return;

  const guards = units.filter(
    (unit) =>
      unit.team === TEAM_ENEMY &&
      Math.hypot(unit.x - camp.x, unit.y - camp.y) < CAMP_GUARD_RADIUS
  ).length;

  if (guards >= CAMP_MAX_GUARDS) return;

  spawnEnemy();
  camp.spawnTimer = 0;
}

function spawnEnemy() {
  const spot = findSpawnSpot(camp);
  if (!spot) return;

  units.push(createUnit(spot.x, spot.y, TEAM_ENEMY));
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
    if (buildMode.active) {
      cancelBuildMode();
    } else {
      clearSelection();
    }
  }

  if (event.key.toLowerCase() === "b" && !event.repeat) {
    startBuildMode();
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

  // Clic en la barra inferior: botones del HUD.
  if (p.screenY >= canvas.height - HUD_HEIGHT) {
    handleHudClick(p.screenX, p.screenY);
    return;
  }

  // Clic mientras se coloca un cuartel: intentar construirlo.
  if (buildMode.active) {
    updateBuildGhost(p.x, p.y);
    tryPlaceBuilding();
    return;
  }

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

  // Clic derecho mientras se coloca: cancelar la construcción.
  if (buildMode.active) {
    cancelBuildMode();
    return;
  }

  if (p.screenY >= canvas.height - HUD_HEIGHT) return;   // clic en la interfaz
  issueMoveOrder(p.x, p.y);
});

// Seguimiento del ratón, para el scroll cuando se acerca a los bordes.
canvas.addEventListener("mousemove", (event) => {
  const p = pointerPosition(event);
  mouse.screenX = p.screenX;
  mouse.screenY = p.screenY;
  mouse.inside = true;

  if (buildMode.active) {
    updateBuildGhost(p.x, p.y);
  }
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

    // Al llegar al final, la tarea decide qué hacer (talar o entregar).
    if (!unit.dest) {
      handleArrival(unit);
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

  // Combate: cada unidad decide si busca, persigue o golpea.
  for (const unit of units.slice()) {
    updateCombat(unit, dt);
  }

  // Unidades
  for (const unit of units) {
    updateUnit(unit, dt);
  }

  // Que no se pisen entre ellas
  separateUnits();

  // Campamento enemigo
  updateCamp(dt);

  // Cuarteles: unidades en cola
  updateBuildings(dt);

  // Tala: cada unidad llena su carga y la lleva al centro de mando.
  for (const unit of units) {
    if (!unit.task || unit.task.type !== "gather" || unit.task.phase !== "harvest") continue;

    if (tree.depleted || tree.wood <= 0) {
      goDeposit(unit);
      continue;
    }

    if (!unit.gathering) continue;         // está ocupada con otra cosa (pelear)

    const room = CARRY_CAPACITY - unit.carrying;
    if (room <= 0) {
      goDeposit(unit);
      continue;
    }

    const amount = Math.min(GATHER_RATE * dt, tree.wood, room);
    tree.wood -= amount;
    unit.carrying += amount;

    if (tree.wood <= 0) {
      depleteTree();
      goDeposit(unit);
      continue;
    }

    if (unit.carrying >= CARRY_CAPACITY - 0.0001) {
      goDeposit(unit);                     // carga llena: al centro de mando
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

  // Los que no llevan nada dejan de trabajar; los que llevan madera
  // terminan de entregarla.
  for (const unit of units) {
    unit.gathering = false;
    unit.gatherOrder = false;

    if (unit.task && unit.carrying <= 0) {
      unit.task = null;
      unit.dest = null;
      unit.path = [];
    }
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

function drawBuildings() {
  for (const building of buildings) {
    if (building.type === "camp") {
      drawCamp(building);
      continue;
    }

    if (building.type === "depot") {
      drawDepot(building);
      continue;
    }

    // Base y tejado
    ctx.fillStyle = "#6b4a2c";
    ctx.fillRect(building.x, building.y, building.size, building.size);
    ctx.fillStyle = "#a97c50";
    ctx.fillRect(building.x + 8, building.y + 8, building.size - 16, building.size - 16);

    // Puerta
    ctx.fillStyle = "#3d2a17";
    ctx.fillRect(building.x + building.size / 2 - 10, building.y + building.size - 24, 20, 24);

    // Marca de selección
    if (building === selectedBuilding) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3 / camera.zoom;
      ctx.strokeRect(building.x - 2, building.y - 2, building.size + 4, building.size + 4);
    }

    // Barra de la unidad que se está entrenando
    if (building.queue > 0) {
      const ratio = building.progress / TRAIN_TIME;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(building.x, building.y - 14, building.size, 8);
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(building.x, building.y - 14, building.size * ratio, 8);
    }

    drawBuildingHealth(building);
  }
}

function drawDepot(building) {
  ctx.fillStyle = "#3b4a5a";
  ctx.fillRect(building.x, building.y, building.size, building.size);

  ctx.fillStyle = "#5b7189";
  ctx.fillRect(building.x + 8, building.y + 8, building.size - 16, building.size - 16);

  // Tejado azul
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath();
  ctx.moveTo(building.x - 6, building.y + 12);
  ctx.lineTo(building.x + building.size / 2, building.y - 18);
  ctx.lineTo(building.x + building.size + 6, building.y + 12);
  ctx.closePath();
  ctx.fill();

  // Puerta
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(building.x + building.size / 2 - 12, building.y + building.size - 30, 24, 30);

  if (building === selectedBuilding) {
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3 / camera.zoom;
    ctx.strokeRect(building.x - 2, building.y - 2, building.size + 4, building.size + 4);
  }

  drawBuildingHealth(building);
}

function drawCamp(building) {
  ctx.fillStyle = "#3f1d1d";
  ctx.fillRect(building.x, building.y, building.size, building.size);

  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(building.x + 10, building.y + 10, building.size - 20, building.size - 20);

  // Banderas en las esquinas
  ctx.fillStyle = "#ef4444";
  const flag = 12;
  ctx.fillRect(building.x - 4, building.y - 16, flag, 16);
  ctx.fillRect(building.x + building.size - 8, building.y - 16, flag, 16);
  ctx.fillRect(building.x - 4, building.y + building.size, flag, 16);
  ctx.fillRect(building.x + building.size - 8, building.y + building.size, flag, 16);

  drawBuildingHealth(building);
}

function drawBuildingHealth(building) {
  if (building.hp >= building.maxHp) return;

  const x = building.x;
  const y = building.y - (building.queue > 0 || building.type === "depot" || building.type === "camp" ? 26 : 10);

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x, y, building.size, 6);
  ctx.fillStyle = building.team === TEAM_ENEMY ? "#ef4444" : "#22c55e";
  ctx.fillRect(x, y, building.size * (building.hp / building.maxHp), 6);
}

function drawBuildGhost() {
  if (!buildMode.active) return;

  ctx.fillStyle = buildMode.valid ? "rgba(143, 206, 107, 0.3)" : "rgba(239, 68, 68, 0.3)";
  ctx.fillRect(buildMode.x, buildMode.y, BARRACKS_SIZE, BARRACKS_SIZE);

  ctx.strokeStyle = buildMode.valid ? "#8fce6b" : "#ef4444";
  ctx.lineWidth = 2 / camera.zoom;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(buildMode.x, buildMode.y, BARRACKS_SIZE, BARRACKS_SIZE);
  ctx.setLineDash([]);
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
    if (unit.team === TEAM_ENEMY) {
      ctx.fillStyle = "#ef4444";
    } else {
      ctx.fillStyle = unit.selected ? "#fbbf24" : "#3b82f6";
    }
    ctx.fillRect(unit.x, unit.y, unit.size, unit.size);

    if (unit.selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeRect(unit.x, unit.y, unit.size, unit.size);
    }

    // Vida: siempre en enemigos; en el jugador solo si está herido.
    if (unit.team === TEAM_ENEMY || unit.hp < unit.maxHp) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(unit.x, unit.y - 10, unit.size, 5);
      ctx.fillStyle = unit.team === TEAM_ENEMY ? "#ef4444" : "#22c55e";
      ctx.fillRect(unit.x, unit.y - 10, unit.size * (unit.hp / unit.maxHp), 5);
    }

    // Madera que lleva encima
    if (unit.carrying > 0) {
      ctx.fillStyle = "#a97c50";
      ctx.fillRect(unit.x + unit.size - 12, unit.y + unit.size - 10, 10, 8);
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

function drawVictory() {
  if (!gameState.victory) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 52px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("¡Victoria!", canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText("Has destruido el campamento enemigo", canvas.width / 2, canvas.height / 2 + 36);
  ctx.textAlign = "left";
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

  // Información de la selección
  ctx.font = "14px system-ui";
  if (selectedBuilding) {
    const isDepot = selectedBuilding.type === "depot";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(
      `${isDepot ? "Centro de mando" : "Cuartel"} · vida ${Math.ceil(selectedBuilding.hp)}`,
      220,
      top + 28
    );
    ctx.fillStyle = "#7d8794";
    ctx.font = "13px system-ui";
    ctx.fillText(
      isDepot ? "Entrega aquí la madera" : `Cola: ${selectedBuilding.queue} · Entrenar ${UNIT_COST}`,
      220,
      top + 48
    );
  } else {
    ctx.fillStyle = "#aab4c0";
    ctx.fillText(`Seleccionadas: ${selectedUnits().length}`, 220, top + 28);
    ctx.fillStyle = "#7d8794";
    ctx.font = "13px system-ui";
    ctx.fillText("Clic derecho: mover · sobre el árbol: talar", 220, top + 48);
  }

  // Botones
  const buttons = hudButtons();
  drawHudButton(buttons.train, "Entrenar", UNIT_COST, canTrain());
  drawHudButton(buttons.barracks, "Cuartel", BARRACKS_COST, stockpile.wood >= BARRACKS_COST);
}

function drawHudButton(rect, label, cost, enabled) {
  ctx.fillStyle = enabled ? "#2f4a3a" : "#1d2329";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = enabled ? "#5b8a6a" : "#333b44";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  ctx.fillStyle = enabled ? "#e8e8e8" : "#626b77";
  ctx.font = "14px system-ui";
  ctx.fillText(`${label} · ${cost}`, rect.x + 14, rect.y + 25);
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
  drawBuildings();
  drawEffects();
  drawUnits();
  drawBuildGhost();

  // Interfaz: de vuelta a coordenadas de pantalla
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawSelectionBox();
  drawHud();
  drawVictory();
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

// Prueba aleatoria: muchos destinos distintos (mitad cerca del árbol) y se
// comprueba que ninguna unidad acaba dentro del árbol, ni con NaN, ni sin llegar.
const { loadGame } = require("./harness");

const { game: g } = loadGame();

// Este test mide rutas: quitamos el campamento y el combate del escenario.
g.camp.alive = false;
g.buildings.length = 0;
for (let i = g.obstacles.length - 1; i >= 0; i--) {
  if (g.obstacles[i] === g.camp) g.obstacles.splice(i, 1);
}

let seed = 987654321;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function randRange(min, max) {
  return min + rand() * (max - min);
}

const treeRect = { x: g.tree.x, y: g.tree.y, w: g.tree.size, h: g.tree.size };
const overlapsTree = (x, y, size) =>
  x < treeRect.x + treeRect.w && x + size > treeRect.x && y < treeRect.y + treeRect.h && y + size > treeRect.y;

let rounds = 0;
let unreached = 0;
let insideTree = 0;
let badNumbers = 0;
let stuckOrders = 0;

for (let round = 0; round < 120; round++) {
  // Unidades nuevas cada ronda (en combate podrían haber muerto).
  g.units.length = 0;
  for (let i = 0; i < 6; i++) g.units.push(g.createUnit(0, 0, "player"));

  // Colocar las unidades en posiciones aleatorias libres.
  for (const unit of g.units) {
    for (let attempt = 0; attempt < 100; attempt++) {
      unit.x = randRange(20, g.world.width - unit.size - 20);
      unit.y = randRange(20, g.world.height - unit.size - 20);
      if (!overlapsTree(unit.x, unit.y, unit.size) && g.canStand(unit, unit.x, unit.y)) break;
    }
    unit.dest = null;
    unit.path = [];
    unit.stuckTime = 0;
    unit.selected = rand() < 0.6;
  }

  if (!g.selectedUnits().length) {
    g.units[Math.floor(rand() * g.units.length)].selected = true;
  }

  // La mitad de las órdenes caen cerca del árbol para forzar rodeos.
  const nearTree = rand() < 0.5;
  let targetX = nearTree ? randRange(g.tree.x - 160, g.tree.x + 160) : randRange(20, g.world.width - 20);
  let targetY = nearTree ? randRange(g.tree.y - 160, g.tree.y + 160) : randRange(20, g.world.height - 20);

  // Un clic sobre el árbol sería una orden de talar: lo desplazamos.
  if (
    !g.tree.depleted &&
    targetX > g.tree.x && targetX < g.tree.x + g.tree.size &&
    targetY > g.tree.y && targetY < g.tree.y + g.tree.size
  ) {
    targetX = g.tree.x + 220;
  }

  g.issueMoveOrder(targetX, targetY);

  const planned = new Map();
  for (const unit of g.selectedUnits()) {
    planned.set(unit, unit.path[unit.path.length - 1]);
    if (!unit.dest) stuckOrders++;
  }

  // Avanzar 25 segundos de juego.
  for (let i = 0; i < 1500; i++) g.update(1 / 60);

  for (const [unit, goal] of planned) {
    rounds++;
    if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y)) {
      badNumbers++;
      continue;
    }
    if (overlapsTree(unit.x, unit.y, unit.size)) {
      insideTree++;
      continue;
    }
    if (unit.dest !== null) continue;
    // Las unidades quietas pueden ser empujadas por sus vecinas, así que
    // solo contamos como fallo si se quedó muy lejos del destino.
    if (Math.hypot(unit.x - goal.x, unit.y - goal.y) > 80) unreached++;
  }
}

console.log(`órdenes comprobadas: ${rounds}`);
console.log(`sin llegar al destino: ${unreached}`);
console.log(`dentro del árbol: ${insideTree}`);
console.log(`coordenadas inválidas: ${badNumbers}`);
console.log(`órdenes no asignadas: ${stuckOrders}`);
const ok = unreached === 0 && insideTree === 0 && badNumbers === 0 && stuckOrders === 0;
console.log(ok ? "ALEATORIO OK" : "ALEATORIO CON FALLOS");
process.exit(ok ? 0 : 1);

// Prueba aleatoria con varios cuarteles: coloca edificios al azar, ordena
// movimientos al otro lado y comprueba que nadie acaba dentro de un edificio,
// que todas las rutas terminan y que no hay NaN.
const { loadGame } = require("./harness");

const { game: g } = loadGame();

// Sin campamento: este test mide rutas y edificios, no combate.
g.camp.alive = false;
for (let i = g.obstacles.length - 1; i >= 0; i--) {
  if (g.obstacles[i] === g.camp) g.obstacles.splice(i, 1);
}
for (let i = g.buildings.length - 1; i >= 0; i--) {
  if (g.buildings[i] === g.camp) g.buildings.splice(i, 1);
}

let seed = 135792468;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function randRange(min, max) {
  return min + rand() * (max - min);
}

const treeRect = { x: g.tree.x, y: g.tree.y, w: g.tree.size, h: g.tree.size };
const overlapsRect = (a, r) =>
  a.x < r.x + r.w && a.x + a.size > r.x && a.y < r.y + r.h && a.y + a.size > r.y;

let rounds = 0;
let insideBuilding = 0;
let insideTree = 0;
let unfinished = 0;
let badNumbers = 0;

for (let round = 0; round < 40; round++) {
  // Unidades nuevas cada ronda (en combate podrían haber muerto).
  g.units.length = 0;
  for (let i = 0; i < 6; i++) g.units.push(g.createUnit(0, 0, "player"));

  g.buildings.length = 0;
  for (let i = g.obstacles.length - 1; i >= 0; i--) {
    if (g.obstacles[i].type === "barracks") g.obstacles.splice(i, 1);
  }

  // Unidades en posiciones libres.
  for (const unit of g.units) {
    for (let attempt = 0; attempt < 200; attempt++) {
      unit.x = randRange(20, g.world.width - unit.size - 20);
      unit.y = randRange(20, g.world.height - unit.size - 20);
      if (!overlapsRect(unit, treeRect) && g.canStand(unit, unit.x, unit.y)) break;
    }
    unit.dest = null;
    unit.path = [];
    unit.gathering = false;
    unit.gatherOrder = false;
    unit.stuckTime = 0;
  }

  // Entre 1 y 4 cuarteles, sin pisar el árbol ni las unidades.
  const buildingCount = 1 + Math.floor(rand() * 4);
  for (let i = 0; i < buildingCount; i++) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const building = { type: "barracks", team: "player", x: 0, y: 0, size: 80, hp: 300, maxHp: 300, queue: 0, progress: 0 };
      building.x = randRange(10, g.world.width - building.size - 10);
      building.y = randRange(10, g.world.height - building.size - 10);

      if (overlapsRect(building, treeRect)) continue;
      if (g.units.some((unit) => overlapsRect(building, { x: unit.x, y: unit.y, w: unit.size, h: unit.size }))) continue;
      if (g.buildings.some((other) => overlapsRect(building, { x: other.x, y: other.y, w: other.size, h: other.size }))) continue;

      g.buildings.push(building);
      g.obstacles.push(building);
      break;
    }
  }

  // Seleccionar algunas unidades y ordenar un movimiento al azar.
  for (const unit of g.units) unit.selected = rand() < 0.6;
  if (!g.selectedUnits().length) g.units[0].selected = true;

  const targetX = randRange(30, g.world.width - 30);
  const targetY = randRange(30, g.world.height - 30);

  // Evitar que el destino caiga sobre el árbol (sería orden de talar).
  const safeX =
    targetX > g.tree.x - 40 && targetX < g.tree.x + g.tree.size + 40 &&
    targetY > g.tree.y - 40 && targetY < g.tree.y + g.tree.size + 40
      ? targetX + 200
      : targetX;

  g.issueMoveOrder(safeX, targetY);

  for (let i = 0; i < 25 * 60; i++) g.update(1 / 60);

  rounds++;
  for (const unit of g.units) {
    if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y)) {
      badNumbers++;
      continue;
    }
    if (unit.dest !== null) unfinished++;

    if (!g.tree.depleted && overlapsRect(unit, treeRect)) insideTree++;
    for (const building of g.buildings) {
      if (overlapsRect(unit, { x: building.x, y: building.y, w: building.size, h: building.size })) {
        insideBuilding++;
      }
    }
  }
}

console.log(`rondas: ${rounds}`);
console.log(`unidades sin terminar la ruta: ${unfinished}`);
console.log(`unidades dentro de un edificio: ${insideBuilding}`);
console.log(`unidades dentro del árbol: ${insideTree}`);
console.log(`coordenadas inválidas: ${badNumbers}`);
const ok = unfinished === 0 && insideBuilding === 0 && insideTree === 0 && badNumbers === 0;
console.log(ok ? "EDIFICIOS OK" : "EDIFICIOS CON FALLOS");
process.exit(ok ? 0 : 1);

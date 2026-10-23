// Prueba aleatoria de tala: muchas rondas con selecciones y posiciones
// distintas. Comprueba que la madera se conserva (nada se crea ni se pierde),
// que nadie acaba dentro del árbol y que todo termina sin NaN.
const { loadGame } = require("./harness");

const { game: g } = loadGame();

// Sin campamento: este test mide la tala y el transporte, no el combate.
g.camp.alive = false;
for (let i = g.obstacles.length - 1; i >= 0; i--) {
  if (g.obstacles[i] === g.camp) g.obstacles.splice(i, 1);
}
for (let i = g.buildings.length - 1; i >= 0; i--) {
  if (g.buildings[i] === g.camp) g.buildings.splice(i, 1);
}

let seed = 24681357;
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
let woodLost = 0;
let insideTree = 0;
let badNumbers = 0;
let stillGathering = 0;
let emptyRounds = 0;

for (let round = 0; round < 25; round++) {
  // Reiniciar el árbol y el almacén.
  g.tree.wood = g.tree.maxWood;
  g.tree.depleted = false;
  g.stockpile.wood = 0;
  if (!g.obstacles.includes(g.tree)) g.obstacles.push(g.tree);

  // Colocar las unidades en sitios libres y seleccionar algunas.
  for (const unit of g.units) {
    for (let attempt = 0; attempt < 200; attempt++) {
      unit.x = randRange(20, g.world.width - unit.size - 20);
      unit.y = randRange(20, g.world.height - unit.size - 20);
      if (!overlapsTree(unit.x, unit.y, unit.size) && g.canStand(unit, unit.x, unit.y)) break;
    }
    unit.dest = null;
    unit.path = [];
    unit.gathering = false;
    unit.gatherOrder = false;
    unit.task = null;
    unit.carrying = 0;
    unit.attackTarget = null;
    unit.hp = unit.maxHp;
    unit.cooldown = 0;
    unit.stuckTime = 0;
    unit.selected = rand() < 0.5;
  }
  if (!g.selectedUnits().length) {
    g.units[Math.floor(rand() * g.units.length)].selected = true;
  }

  // Clic derecho en el centro del árbol.
  g.issueMoveOrder(g.tree.x + g.tree.size / 2, g.tree.y + g.tree.size / 2);

  // Hasta 120 segundos de juego, o hasta que se agote.
  for (let i = 0; i < 120 * 60; i++) {
    g.update(1 / 60);
    if (g.tree.depleted && g.units.every((u) => !u.gathering)) break;
  }

  rounds++;
  const carried = g.units.reduce((sum, unit) => sum + unit.carrying, 0);
  const total = g.stockpile.wood + carried + g.tree.wood;
  if (Math.abs(total - g.tree.maxWood) > 0.01) woodLost++;
  if (g.stockpile.wood + carried <= 0) emptyRounds++;
  if (g.units.some((u) => u.gathering)) stillGathering++;

  for (const unit of g.units) {
    if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y)) badNumbers++;
    else if (overlapsTree(unit.x, unit.y, unit.size)) insideTree++;
  }
}

console.log(`rondas: ${rounds}`);
console.log(`madera perdida/creada: ${woodLost}`);
console.log(`rondas sin recolectar nada: ${emptyRounds}`);
console.log(`unidades dentro del árbol: ${insideTree}`);
console.log(`coordenadas inválidas: ${badNumbers}`);
console.log(`siguen talando tras agotarse: ${stillGathering}`);
const ok = woodLost === 0 && emptyRounds === 0 && insideTree === 0 && badNumbers === 0 && stillGathering === 0;
console.log(ok ? "TALA OK" : "TALA CON FALLOS");
process.exit(ok ? 0 : 1);

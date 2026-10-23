// Pruebas de juego completo: selección, movimiento, rutas, recursos,
// edificios, combate, guardado y HUD. Se ejecutan con `npm test`.
const { loadGame } = require("./harness");

const { game, canvas, drawCalls, canvasListeners, windowListeners } = loadGame();

// Las oleadas se prueban aparte; en el resto de la suite el reloj está parado.
game.waveState.timer = 1e9;

let failures = 0;
function check(name, condition, extra = "") {
  if (condition) {
    console.log("PASS  " + name);
  } else {
    failures++;
    console.log("FAIL  " + name + (extra !== "" ? "  -> " + extra : ""));
  }
}

function fire(listeners, type, props) {
  for (const fn of listeners[type] || []) fn({ preventDefault() {}, ...props });
}
const mouseAt = (x, y, extra = {}) => ({
  clientX: x,
  clientY: y,
  button: 0,
  shiftKey: false,
  ...extra,
});
const down = (x, y, extra) => fire(canvasListeners, "mousedown", mouseAt(x, y, extra));
const move = (x, y) => fire(windowListeners, "mousemove", mouseAt(x, y));
const up = (x, y, extra) => fire(windowListeners, "mouseup", mouseAt(x, y, extra));
const clickAt = (x, y, extra) => {
  down(x, y, extra);
  up(x, y, extra);
};
const rightClick = (x, y) => fire(canvasListeners, "contextmenu", mouseAt(x, y, { button: 2 }));
const tick = (seconds) => {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) game.update(1 / 60);
};

// ---------------------------------------------------------------------
// 1. Selección con caja
// Cámara en (200,150): las 6 unidades ocupan pantalla x 400-560, y 250-350.
down(390, 240);
move(570, 360);
up(570, 360);
check("la caja selecciona las 6 unidades", game.selectedUnits().length === 6, game.selectedUnits().length);

// 2. Clic en vacío deselecciona
clickAt(20, 500);
check("clic en vacío deselecciona todo", game.selectedUnits().length === 0);

// 3. Clic sobre una unidad la selecciona (unidad 1 en pantalla 400,250)
clickAt(420, 270);
check(
  "clic selecciona una sola unidad",
  game.selectedUnits().length === 1 && game.units[0].selected === true,
  "seleccionadas=" + game.selectedUnits().length
);

// 4. Shift + clic añade a la selección (unidad 2 en pantalla 460,250)
clickAt(480, 270, { shiftKey: true });
check("shift + clic añade otra unidad", game.selectedUnits().length === 2, game.selectedUnits().length);

// 5. Clic derecho da la orden y las unidades llegan
rightClick(100, 400); // mundo (300, 550)
check("la orden asigna destino a las 2 unidades", game.units[0].dest !== null && game.units[1].dest !== null);
tick(10);
check(
  "las unidades llegan y se detienen",
  game.units[0].dest === null && game.units[1].dest === null,
  JSON.stringify(game.units.slice(0, 2))
);
check(
  "llegan a la formación prevista (276/324, 550)",
  Math.abs(game.units[0].x - 276) < 1.5 &&
    Math.abs(game.units[0].y - 550) < 1.5 &&
    Math.abs(game.units[1].x - 324) < 1.5 &&
    Math.abs(game.units[1].y - 550) < 1.5,
  JSON.stringify(game.units.slice(0, 2).map((u) => [u.x, u.y]))
);

// 6. Clic derecho sin selección no hace nada
game.clearSelection();
const destBefore = game.units.map((u) => u.dest);
rightClick(300, 300);
check(
  "clic derecho sin selección no da órdenes",
  game.units.every((u, i) => u.dest === destBefore[i])
);

// 7. Destinos nunca dentro del árbol (mover al otro lado, no talar)
game.units.forEach((u) => (u.selected = true));
game.issueMoveOrder(1000, 530); // a la derecha del árbol
const treeRect = { x: game.tree.x, y: game.tree.y, w: game.tree.size, h: game.tree.size };
const overlapsTree = (u) =>
  u.dest && u.dest.x < treeRect.x + treeRect.w && u.dest.x + u.size > treeRect.x &&
  u.dest.y < treeRect.y + treeRect.h && u.dest.y + u.size > treeRect.y;
check("ningún destino cae dentro del árbol", game.units.every((u) => !overlapsTree(u)));

// 8. Tras moverse, ninguna unidad queda dentro del árbol y todas terminan
tick(30);
const insideTree = (u) =>
  u.x < treeRect.x + treeRect.w && u.x + u.size > treeRect.x &&
  u.y < treeRect.y + treeRect.h && u.y + u.size > treeRect.y;
check("ninguna unidad atraviesa el árbol", game.units.every((u) => !insideTree(u)));
check("todas terminan su orden", game.units.every((u) => u.dest === null));

// 9. Sin NaN ni posiciones fuera del mundo
check(
  "coordenadas válidas",
  game.units.every(
    (u) =>
      Number.isFinite(u.x) && Number.isFinite(u.y) &&
      u.x >= 0 && u.y >= 0 &&
      u.x + u.size <= game.world.width && u.y + u.size <= game.world.height
  )
);

// 10. Tope de dt: un frame gigante no teletransporta la cámara
game.camera.x = 200;
game.keys["d"] = true;
game.gameLoop(1e6);
check("el tope de dt limita el salto de cámara", game.camera.x - 200 <= 20.0001, game.camera.x - 200);
game.keys["d"] = false;

// 11. Render sin errores y dibuja algo
drawCalls.length = 0;
game.render();
check(
  "render dibuja unidades y HUD",
  drawCalls.some((c) => c[0] === "fillRect") && drawCalls.some((c) => c[0] === "fillText")
);

// 11b. El árbol se dibuja en coordenadas del mundo: la cámara y el zoom se
// aplican con la transformación del render, así que debe caer dentro del canvas.
const treeCenterX = game.tree.x + game.tree.size / 2;
const treeCenterY = game.tree.y + game.tree.size / 2;
const treeTrunkX = game.tree.x + game.tree.size * 0.35;
const treeTrunkY = game.tree.y + game.tree.size * 0.5;

check(
  "la copa del árbol se dibuja en su sitio del mundo",
  drawCalls.some(
    (c) =>
      c[0] === "arc" &&
      Math.abs(c[1] - treeCenterX) < 0.01 &&
      Math.abs(c[2] - treeCenterY) < 0.01
  ),
  "esperado centro (" + treeCenterX + ", " + treeCenterY + ")"
);

check(
  "el tronco del árbol se dibuja en su sitio del mundo",
  drawCalls.some(
    (c) =>
      c[0] === "fillRect" &&
      Math.abs(c[1] - treeTrunkX) < 0.01 &&
      Math.abs(c[2] - treeTrunkY) < 0.01 &&
      Math.abs(c[3] - game.tree.size * 0.3) < 0.01
  ),
  "esperado tronco (" + treeTrunkX + ", " + treeTrunkY + ")"
);

const treeScreenX = (treeCenterX - game.camera.x) * game.camera.zoom;
const treeScreenY = (treeCenterY - game.camera.y) * game.camera.zoom;

check(
  "el árbol cae dentro del canvas",
  treeScreenX > 0 && treeScreenX < canvas.width && treeScreenY > 0 && treeScreenY < canvas.height,
  "pantalla (" + treeScreenX + ", " + treeScreenY + ")"
);

// 12. Escape limpia la selección
game.units[0].selected = true;
fire(windowListeners, "keydown", { key: "Escape" });
check("Escape limpia la selección", game.selectedUnits().length === 0);

// ---------------------------------------------------------------------
// 13. Recursos: talar el árbol
// ---------------------------------------------------------------------
const initialPositions = [
  [600, 400], [660, 400], [720, 400],
  [600, 460], [660, 460], [720, 460],
];
game.units.forEach((unit, index) => {
  unit.x = initialPositions[index][0];
  unit.y = initialPositions[index][1];
  unit.dest = null;
  unit.path = [];
  unit.gathering = false;
  unit.gatherOrder = false;
  unit.task = null;
  unit.carrying = 0;
  unit.attackTarget = null;
  unit.hp = unit.maxHp;
  unit.stuckTime = 0;
  unit.selected = true;
});
game.camera.x = 200;
game.camera.y = 150;
game.camera.zoom = 1;
game.mouse.inside = false;
game.tree.wood = game.tree.maxWood;
game.tree.depleted = false;
game.stockpile.wood = 0;
if (!game.obstacles.includes(game.tree)) game.obstacles.push(game.tree);

rightClick(730, 380);   // centro del árbol en pantalla con esta cámara
check(
  "clic derecho en el árbol ordena talar",
  game.units.every((u) => u.gatherOrder === true && u.dest !== null)
);

const carriedTotal = () => game.units.reduce((sum, unit) => sum + unit.carrying, 0);

tick(3);
check(
  "las unidades llegan al árbol y empiezan a trabajar",
  game.units.some((u) => u.gathering || u.carrying > 0)
);
check(
  "la madera no se pierde al cargarla",
  Math.abs(game.stockpile.wood + carriedTotal() + game.tree.wood - game.tree.maxWood) < 0.01
);

let sawCarrying = false;
for (let i = 0; i < 600; i++) {
  game.update(1 / 60);
  if (game.units.some((unit) => unit.carrying > 0)) sawCarrying = true;
}
check(
  "las unidades cargan madera y la entregan en el centro de mando",
  sawCarrying && game.stockpile.wood > 0,
  "almacén=" + game.stockpile.wood
);
check("el árbol pierde madera", game.tree.wood < game.tree.maxWood, game.tree.wood);

const depot = game.buildings.find((building) => building.type === "depot");
check("hay un centro de mando y bloquea el paso", Boolean(depot) && game.obstacles.includes(depot));

tick(60);
check("el árbol se agota", game.tree.depleted === true && game.tree.wood === 0);

const carried = carriedTotal();
check(
  "toda la madera acaba en el almacén",
  Math.abs(game.stockpile.wood + carried - game.tree.maxWood) < 0.01,
  "almacén=" + game.stockpile.wood + " en manos=" + carried
);
check("nadie sigue talando un tocón", game.units.every((u) => !u.gathering));
check("el tocón ya no bloquea el paso", !game.obstacles.includes(game.tree));

// El centro de mando se puede seleccionar.
game.clearSelection();
clickAt(290, 460);   // centro del depósito con la cámara en (200, 150)
check("el clic selecciona el centro de mando", game.getSelectedBuilding() === depot);

drawCalls.length = 0;
game.render();
check(
  "el HUD describe el centro de mando",
  drawCalls.some((c) => c[0] === "fillText" && String(c[1]).includes("Centro de mando"))
);
game.clearSelection();

// ---------------------------------------------------------------------
// 14. HUD
// ---------------------------------------------------------------------
drawCalls.length = 0;
game.render();
const hudTexts = drawCalls.filter((c) => c[0] === "fillText").map((c) => String(c[1]));
check("el HUD muestra la madera", hudTexts.some((t) => t.includes("Madera: 300")), hudTexts.join(" | "));
check("el HUD muestra las seleccionadas", hudTexts.some((t) => t.includes("Seleccionadas:")));

// ---------------------------------------------------------------------
// 15. Zoom con la rueda, manteniendo el punto bajo el cursor
// ---------------------------------------------------------------------
game.camera.x = 300;
game.camera.y = 200;
game.camera.zoom = 1;
const cursorWorld = { x: 400 + game.camera.x, y: 300 + game.camera.y };
fire(canvasListeners, "wheel", { clientX: 400, clientY: 300, deltaY: -100 });
check("la rueda acerca el zoom", game.camera.zoom > 1, game.camera.zoom);

const cursorWorldAfter = {
  x: 400 / game.camera.zoom + game.camera.x,
  y: 300 / game.camera.zoom + game.camera.y,
};
check(
  "el zoom mantiene el punto bajo el cursor",
  Math.abs(cursorWorldAfter.x - cursorWorld.x) < 0.001 &&
    Math.abs(cursorWorldAfter.y - cursorWorld.y) < 0.001,
  JSON.stringify(cursorWorldAfter)
);

// ---------------------------------------------------------------------
// 16. Con zoom, el clic sigue seleccionando la unidad correcta
// ---------------------------------------------------------------------
game.clearSelection();
const targetUnit = game.units[0];
const targetScreenX = (targetUnit.x + targetUnit.size / 2 - game.camera.x) * game.camera.zoom;
const targetScreenY = (targetUnit.y + targetUnit.size / 2 - game.camera.y) * game.camera.zoom;
clickAt(targetScreenX, targetScreenY);
check(
  "con zoom, el clic selecciona la unidad correcta",
  game.selectedUnits().length === 1 && game.units[0].selected === true,
  "seleccionadas=" + game.selectedUnits().length
);

// ---------------------------------------------------------------------
// 17. Límites del zoom
// ---------------------------------------------------------------------
for (let i = 0; i < 40; i++) {
  fire(canvasListeners, "wheel", { clientX: 400, clientY: 300, deltaY: -100 });
}
check("el zoom tiene tope máximo", game.camera.zoom <= 1.6001, game.camera.zoom);

for (let i = 0; i < 80; i++) {
  fire(canvasListeners, "wheel", { clientX: 400, clientY: 300, deltaY: 100 });
}
check("el zoom tiene tope mínimo", game.camera.zoom >= 0.7499, game.camera.zoom);

// ---------------------------------------------------------------------
// 18. Scroll al acercar el ratón al borde
// ---------------------------------------------------------------------
game.camera.zoom = 1;
game.camera.x = 300;
game.camera.y = 200;
game.mouse.inside = false;
fire(canvasListeners, "mousemove", { clientX: 5, clientY: 300 });
const cameraXBefore = game.camera.x;
game.update(1 / 60);
check("el ratón en el borde mueve la cámara", game.camera.x < cameraXBefore, game.camera.x);
game.mouse.inside = false;

// ---------------------------------------------------------------------
// 19. Colisiones entre unidades
// ---------------------------------------------------------------------
game.units.forEach((unit) => {
  unit.dest = null;
  unit.path = [];
  unit.gathering = false;
  unit.gatherOrder = false;
});
game.units[0].x = 500;
game.units[0].y = 500;
game.units[1].x = 510;
game.units[1].y = 500;
for (let i = 0; i < 10; i++) game.update(1 / 60);

const first = game.units[0];
const second = game.units[1];
const overlapX = Math.min(first.x + first.size, second.x + second.size) - Math.max(first.x, second.x);
const overlapY = Math.min(first.y + first.size, second.y + second.size) - Math.max(first.y, second.y);
check(
  "las unidades no se solapan",
  !(overlapX > 0.01 && overlapY > 0.01),
  overlapX + " x " + overlapY
);

// ---------------------------------------------------------------------
// 20. Construir un cuartel
// ---------------------------------------------------------------------
const overlapsBuilding = (unit, building) =>
  unit.x < building.x + building.size &&
  unit.x + unit.size > building.x &&
  unit.y < building.y + building.size &&
  unit.y + unit.size > building.y;

game.camera.x = 200;
game.camera.y = 150;
game.camera.zoom = 1;
game.mouse.inside = false;
game.stockpile.wood = 400;
game.clearSelection();

const buildingsBefore = game.buildings.length;

clickAt(700, 560);   // botón "Cuartel" en el HUD
check("el botón Cuartel entra en modo colocación", game.buildMode.active === true);

fire(canvasListeners, "mousemove", { clientX: 200, clientY: 150 });
check(
  "el fantasma se pega a la rejilla",
  game.buildMode.x === 360 && game.buildMode.y === 260,
  game.buildMode.x + ", " + game.buildMode.y
);

clickAt(200, 150);   // colocar el cuartel
check("se construye el cuartel", game.buildings.length === buildingsBefore + 1);
check("se cobra la madera", game.stockpile.wood === 250, game.stockpile.wood);
check(
  "el cuartel queda seleccionado",
  game.getSelectedBuilding() === game.buildings[game.buildings.length - 1]
);
check("el cuartel bloquea el paso", game.obstacles.includes(game.buildings[game.buildings.length - 1]));

drawCalls.length = 0;
game.render();
const buttonTexts = drawCalls.filter((c) => c[0] === "fillText").map((c) => String(c[1]));
check(
  "el HUD dibuja los botones",
  buttonTexts.some((t) => t.includes("Cuartel · 150")) &&
    buttonTexts.some((t) => t.includes("Entrenar · 50")),
  buttonTexts.join(" | ")
);

// ---------------------------------------------------------------------
// 21. No se puede construir encima ni sin cobrar
// ---------------------------------------------------------------------
const barracks = game.buildings.find((building) => building.type === "barracks");
const woodBeforeInvalid = game.stockpile.wood;

clickAt(700, 560);   // volver a modo colocación
check("vuelve a entrar en modo colocación", game.buildMode.active === true);

clickAt(200, 150);   // mismo sitio: ocupado
check("no se construye encima de otro cuartel", game.buildings.length === buildingsBefore + 1);
check("no se cobra si no cabe", game.stockpile.wood === woodBeforeInvalid, game.stockpile.wood);
check("el modo colocación sigue activo", game.buildMode.active === true);

fire(windowListeners, "keydown", { key: "Escape" });
check("Escape cancela la colocación", game.buildMode.active === false);

// ---------------------------------------------------------------------
// 22. Entrenar unidades
// ---------------------------------------------------------------------
clickAt(200, 150);   // seleccionar el cuartel
check("el clic selecciona el cuartel", game.getSelectedBuilding() === barracks);

const unitsBeforeTraining = game.units.length;

clickAt(500, 560);   // botón "Entrenar"
check("entrenar descuenta madera", game.stockpile.wood === 200, game.stockpile.wood);
check("la unidad entra en cola", barracks.queue === 1, barracks.queue);

tick(4.2);
check("sale una unidad nueva", game.units.length === unitsBeforeTraining + 1);

const newUnit = game.units[game.units.length - 1];
check(
  "la unidad nueva no aparece dentro del cuartel",
  !overlapsBuilding(newUnit, barracks)
);
check("la unidad nueva es del jugador", newUnit.team === "player", String(newUnit.team));
check(
  "la unidad nueva tiene vida y combate",
  newUnit.hp === newUnit.maxHp && newUnit.damage > 0 && newUnit.range > 0,
  JSON.stringify({ hp: newUnit.hp, damage: newUnit.damage, range: newUnit.range })
);

// Y se puede seleccionar como cualquier otra.
game.clearSelection();
const newUnitScreenX = (newUnit.x + newUnit.size / 2 - game.camera.x) * game.camera.zoom;
const newUnitScreenY = (newUnit.y + newUnit.size / 2 - game.camera.y) * game.camera.zoom;
clickAt(newUnitScreenX, newUnitScreenY);
check(
  "la unidad nueva se puede seleccionar",
  game.selectedUnits().length === 1 && newUnit.selected === true,
  "seleccionadas=" + game.selectedUnits().length
);

// Volver a seleccionar el cuartel para seguir entrenando.
clickAt(200, 150);

clickAt(500, 560);
clickAt(500, 560);
check("se pueden encolar dos más", barracks.queue === 2, barracks.queue);
check("se cobran las dos", game.stockpile.wood === 100, game.stockpile.wood);

tick(8.5);
check("salen las dos unidades encoladas", game.units.length === unitsBeforeTraining + 3);

// ---------------------------------------------------------------------
// 23. Rodear el cuartel
// ---------------------------------------------------------------------
game.clearSelection();
game.units.forEach((unit, index) => {
  unit.x = 600 + (index % 3) * 60;
  unit.y = 400 + Math.floor(index / 3) * 60;
  unit.dest = null;
  unit.path = [];
  unit.gathering = false;
  unit.gatherOrder = false;
  unit.selected = true;
});

game.issueMoveOrder(300, 260);
tick(20);

check(
  "ninguna unidad acaba dentro del cuartel",
  game.units.every((unit) => !overlapsBuilding(unit, barracks))
);
check("todas terminan la ruta rodeando el cuartel", game.units.every((unit) => unit.dest === null));

// ---------------------------------------------------------------------
// 24. El HUD no da órdenes al mapa
// ---------------------------------------------------------------------
game.clearSelection();
game.units.forEach((unit) => {
  unit.dest = null;
  unit.path = [];
});
game.units[0].selected = true;

rightClick(400, 560);
check("clic derecho en el HUD no mueve unidades", game.units[0].dest === null);

// ---------------------------------------------------------------------
// 25. Sin madera no se puede construir
// ---------------------------------------------------------------------
game.stockpile.wood = 0;
clickAt(700, 560);
check("sin madera no se entra en colocación", game.buildMode.active === false);

// ---------------------------------------------------------------------
// 26. Combate: orden de ataque y muerte
// ---------------------------------------------------------------------
game.camera.x = 200;
game.camera.y = 150;
game.camera.zoom = 1;
game.clearSelection();
game.units.forEach((unit) => {
  unit.selected = false;
  unit.attackTarget = null;
  unit.dest = null;
  unit.path = [];
  unit.hp = unit.maxHp;
});

const playerCountBeforeFight = game.units.length;
const fighterSpots = [
  [560, 600],
  [560, 640],
  [600, 640],
];
game.units.slice(0, 3).forEach((unit, index) => {
  unit.x = fighterSpots[index][0];
  unit.y = fighterSpots[index][1];
  unit.selected = true;
});

const enemy = game.createUnit(660, 600, "enemy");
game.units.push(enemy);

rightClick(460, 450);   // mundo (660, 600): el enemigo
check(
  "clic derecho sobre un enemigo da orden de ataque",
  game.units.slice(0, 3).every((unit) => unit.attackTarget === enemy)
);

tick(3);
check("el enemigo muere al recibir daño", !game.units.includes(enemy), "hp=" + enemy.hp);
check("los atacantes sobreviven", game.units.length === playerCountBeforeFight);

// ---------------------------------------------------------------------
// 27. Los enemigos devuelven el golpe
// ---------------------------------------------------------------------
const victim = game.units[0];
victim.hp = victim.maxHp;

const toughEnemy = game.createUnit(victim.x + 50, victim.y, "enemy");
toughEnemy.hp = 1000;
toughEnemy.maxHp = 1000;
game.units.push(toughEnemy);

tick(2.5);
check("los enemigos hacen daño al jugador", victim.hp < victim.maxHp, "hp=" + victim.hp);

game.units.splice(game.units.indexOf(toughEnemy), 1);
game.units.forEach((unit) => {
  if (unit.attackTarget === toughEnemy) unit.attackTarget = null;
});

// 28. Barra de vida dibujada
drawCalls.length = 0;
game.render();
check(
  "se dibuja la barra de vida de la unidad herida",
  drawCalls.some((c) => c[0] === "fillRect" && Math.abs(c[4] - 5) < 0.001)
);

// ---------------------------------------------------------------------
// 29. El campamento saca guardias si te acercas
// ---------------------------------------------------------------------
game.camera.x = 800;
game.camera.y = 20;
game.clearSelection();
game.mouse.inside = false;

const scout = game.units[0];
scout.x = game.camp.x - 100;
scout.y = game.camp.y + 120;
scout.hp = scout.maxHp;
scout.attackTarget = null;
scout.dest = null;
scout.path = [];

game.units.slice(1).forEach((unit, index) => {
  unit.x = 300 + index * 40;
  unit.y = 900;
  unit.dest = null;
  unit.path = [];
  unit.attackTarget = null;
  unit.hp = unit.maxHp;
});

game.camp.spawnTimer = 0;
const guardsBefore = game.units.filter((unit) => unit.team === "enemy").length;
tick(12.5);

const guardsAfter = game.units.filter((unit) => unit.team === "enemy").length;
check("el campamento saca guardias al acercarse", guardsAfter > guardsBefore, guardsAfter);

// Limpiar los guardias para la siguiente prueba.
for (let i = game.units.length - 1; i >= 0; i--) {
  if (game.units[i].team === "enemy") game.units.splice(i, 1);
}
game.units.forEach((unit) => {
  unit.attackTarget = null;
});

// ---------------------------------------------------------------------
// 29b. Oleadas enemigas
// ---------------------------------------------------------------------
// Volver a la base para que la oleada tenga que caminar.
game.clearSelection();
game.units.forEach((unit, index) => {
  unit.x = 600 + (index % 3) * 60;
  unit.y = 400 + Math.floor(index / 3) * 60;
  unit.hp = unit.maxHp;
  unit.dest = null;
  unit.path = [];
  unit.attackTarget = null;
});

game.waveState.number = 0;
game.waveState.timer = 0;
game.update(1 / 60);

const waveEnemies = game.units.filter((unit) => unit.team === "enemy" && unit.wave);
check(
  "la primera oleada aparece",
  game.waveState.number === 1 && waveEnemies.length > 0,
  "enemigos=" + waveEnemies.length
);
check(
  "los enemigos de la oleada van a por la base",
  waveEnemies.length > 0 && waveEnemies.every((unit) => unit.attackTarget && unit.attackTarget.team === "player")
);

const waveStartX = Math.min(...waveEnemies.map((unit) => unit.x));
tick(4);
check(
  "la oleada avanza hacia la base",
  waveEnemies.some((unit) => unit.x < waveStartX - 100),
  JSON.stringify(waveEnemies.map((unit) => [Math.round(unit.x), Math.round(unit.y)]))
);

drawCalls.length = 0;
game.render();
check(
  "el HUD muestra la cuenta atrás de la oleada",
  drawCalls.some((c) => c[0] === "fillText" && String(c[1]).includes("Oleada"))
);

// Limpiar la oleada y parar el reloj para el resto de pruebas.
for (let i = game.units.length - 1; i >= 0; i--) {
  if (game.units[i].team === "enemy") game.units.splice(i, 1);
}
game.units.forEach((unit) => {
  unit.attackTarget = null;
});
game.waveState.timer = 1e9;

// ---------------------------------------------------------------------
// 30. Destruir el campamento da la victoria
// ---------------------------------------------------------------------
game.clearSelection();
game.units.forEach((unit, index) => {
  unit.x = game.camp.x - 160 + (index % 3) * 45;
  unit.y = game.camp.y + 60 + Math.floor(index / 3) * 45;
  unit.hp = unit.maxHp;
  unit.damage = 60;
  unit.attackTarget = null;
  unit.dest = null;
  unit.path = [];
  unit.selected = true;
});

game.camera.x = 800;
game.camera.y = 20;

const campScreenX = (game.camp.x + game.camp.size / 2 - game.camera.x) * game.camera.zoom;
const campScreenY = (game.camp.y + game.camp.size / 2 - game.camera.y) * game.camera.zoom;
rightClick(campScreenX, campScreenY);

check(
  "clic derecho sobre el campamento ordena atacarlo",
  game.units.every((unit) => unit.attackTarget === game.camp)
);

tick(20);
check("el campamento cae", game.camp.alive === false && game.camp.hp === 0);
check("destruir el campamento da la victoria", game.gameState.victory === true);
check("el campamento sale de los obstáculos", !game.obstacles.includes(game.camp));

drawCalls.length = 0;
game.render();
check(
  "se dibuja la pantalla de victoria",
  drawCalls.some((c) => c[0] === "fillText" && String(c[1]).includes("Victoria"))
);

const waveNumberAfterVictory = game.waveState.number;
game.waveState.timer = 0;
game.update(1 / 60);
check(
  "la victoria detiene las oleadas",
  game.waveState.number === waveNumberAfterVictory,
  game.waveState.number
);

// ---------------------------------------------------------------------
// 31. Guardar y cargar la partida
// ---------------------------------------------------------------------
game.units[0].carrying = 5;
game.stockpile.wood = 123;
game.camera.x = 500;
game.camera.y = 300;
game.camera.zoom = 1;

const unitsToSave = game.units.length;
const buildingsToSave = game.buildings.length;
const waveNumberToSave = game.waveState.number;

clickAt(660, 20);   // botón Guardar
check("el botón Guardar guarda la partida", game.toast.text === "Partida guardada", game.toast.text);

// Estropear el estado a propósito.
game.stockpile.wood = 0;
game.camera.x = 0;
game.camera.y = 0;
game.units.length = 0;
game.buildings.length = 0;
game.obstacles.length = 0;

clickAt(744, 20);   // botón Cargar
check("el botón Cargar carga la partida", game.toast.text === "Partida cargada", game.toast.text);
check("se restaura la madera", game.stockpile.wood === 123, game.stockpile.wood);
check("se restaura la cámara", Math.abs(game.camera.x - 500) < 0.01, game.camera.x);
check("se restauran las unidades", game.units.length === unitsToSave, game.units.length);
check("se restauran los edificios", game.buildings.length === buildingsToSave, game.buildings.length);
check("se restaura la victoria", game.gameState.victory === true);
check("se restaura la oleada", game.waveState.number === waveNumberToSave, game.waveState.number);
check(
  "quien llevaba madera vuelve al centro de mando",
  game.units[0].carrying === 5 &&
    game.units[0].task &&
    game.units[0].task.phase === "toDepot",
  game.units[0].carrying + " / " + (game.units[0].task ? game.units[0].task.phase : "sin tarea")
);

// ---------------------------------------------------------------------
// 32. Derrota sin unidades ni edificios
// ---------------------------------------------------------------------
const defeatRun = loadGame();
defeatRun.game.waveState.timer = 1e9;
defeatRun.game.units.length = 0;
defeatRun.game.buildings.length = 0;
defeatRun.game.update(1 / 60);

check("sin unidades ni edificios se pierde", defeatRun.game.gameState.defeat === true);

defeatRun.drawCalls.length = 0;
defeatRun.game.render();
check(
  "se dibuja la pantalla de derrota",
  defeatRun.drawCalls.some((c) => c[0] === "fillText" && String(c[1]).includes("Derrota"))
);

console.log(failures === 0 ? "\nTODO OK" : "\nFALLOS: " + failures);
process.exit(failures === 0 ? 0 : 1);

// Tala, carga y entrega de madera.
import { state, canvas, ctx, units, buildings, tree, stockpile, obstacles } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { buildRoute } from "./navigation";

// Huecos alrededor del árbol donde se colocan las unidades que talan:
// ocho posiciones, en las cuatro caras y en las cuatro esquinas.
export function gatherSlots(node) {
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
export function orderGather(selected) {
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
export function handleArrival(unit) {
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
export function nearestDepot(unit) {
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
export function goDeposit(unit) {
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
export function depotSlot(depotBuilding, unit) {
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
export function depositWood(unit) {
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

// Cuando el árbol se queda sin madera: pasa a ser un tocón y deja de estorbar.
export function depleteTree() {
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

// Avanza la tala: llena la carga y manda al centro de mando.
export function updateGathering(dt: number) {
  for (const unit of units) {
    if (!unit.task || unit.task.type !== "gather" || unit.task.phase !== "harvest") continue;

    if (tree.depleted || tree.wood <= 0) {
      goDeposit(unit);
      continue;
    }

    if (!unit.gathering) continue;

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
      goDeposit(unit);
    }
  }
}

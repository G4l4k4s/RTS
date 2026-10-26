// Órdenes del jugador: mover, talar o atacar.
import { state, canvas, ctx, tree, effects } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { pointInRect } from "../core/math";
import { selectedUnits, unitAt, buildingAt } from "./selection";
import { buildRoute, clampDestination } from "./navigation";
import { orderAttack } from "./combat";
import { orderGather } from "./economy";

// Reparte las unidades seleccionadas en una formación alrededor del punto
// y les asigna su destino a cada una.
export function issueMoveOrder(worldX, worldY, queue = false) {
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
    const route = buildRoute(unit, target);   // [destino] o [esquina, destino]

    if (queue && unit.dest) {
      // Shift: se añade al final de la ruta en vez de reemplazarla.
      unit.path.push(...route);
    } else {
      unit.path = route;
      unit.dest = unit.path[0];
    }

    unit.stuckTime = 0;
  });

  effects.push({ x: worldX, y: worldY, age: 0 });
}

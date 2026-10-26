// Construcción, entrenamiento y torres.
import { state, canvas, ctx, camera, units, buildings, obstacles, stockpile, buildMode, effects } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { pointInRect, rectsOverlap, unitRect } from "../core/math";
import { hudButtons } from "../core/layout";
import { clearSelection } from "./selection";
import { playSound } from "./audio";
import { findSpawnSpot } from "./placement";
import { createUnit } from "../entities/unit";
import { findNearestOpponent, applyDamage } from "./combat";

// ¿Cabe un edificio de este tamaño en esta posición? Sin salirse del mundo y
// sin pisar obstáculos ni unidades.
export function canPlaceBuilding(x, y, size) {
  if (x < 0 || y < 0 || x + size > world.width || y + size > world.height) {
    return false;
  }

  const rect = { x, y, w: size, h: size };

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

// Entra en modo colocación del edificio indicado.
export function startBuildMode(type = "barracks") {
  const spec = BUILD_SPECS[type];
  if (!spec) return;

  if (buildMode.active && buildMode.type === type) {
    cancelBuildMode();
    return;
  }
  if (stockpile.wood < spec.cost) return;

  buildMode.active = true;
  buildMode.type = type;
  buildMode.valid = false;

  // Empezar en el centro de la vista.
  const centerX = camera.x + canvas.width / 2 / camera.zoom;
  const centerY = camera.y + (canvas.height - HUD_HEIGHT) / 2 / camera.zoom;
  updateBuildGhost(centerX, centerY);
}

export function cancelBuildMode() {
  buildMode.active = false;
}

// Coloca el fantasma del edificio en la rejilla más cercana al ratón.
export function updateBuildGhost(worldX, worldY) {
  const size = BUILD_SPECS[buildMode.type].size;

  buildMode.x = Math.round((worldX - size / 2) / BUILD_SNAP) * BUILD_SNAP;
  buildMode.y = Math.round((worldY - size / 2) / BUILD_SNAP) * BUILD_SNAP;
  buildMode.valid = canPlaceBuilding(buildMode.x, buildMode.y, size);
}

// Intenta construir donde está el fantasma. Si no cabe, no cobra nada.
export function tryPlaceBuilding() {
  if (!buildMode.active || !buildMode.valid) return;

  const spec = BUILD_SPECS[buildMode.type];
  if (!spec || stockpile.wood < spec.cost) return;

  stockpile.wood -= spec.cost;

  const building = {
    type: buildMode.type,
    team: TEAM_PLAYER,
    x: buildMode.x,
    y: buildMode.y,
    size: spec.size,
    hp: spec.hp,
    maxHp: spec.hp,
    queue: buildMode.type === "barracks" ? [] : undefined,
    progress: 0,
    cooldown: 0,
  };

  buildings.push(building);
  obstacles.push(building);      // las unidades tienen que rodearlo
  buildMode.active = false;

  playSound("build");

  clearSelection();
  state.selectedBuilding = building;
}

export function unitCost(type) {
  return UNIT_STATS[type] ? UNIT_STATS[type].cost : UNIT_COST;
}

export function canTrain(type = "soldier") {
  return Boolean(
    state.selectedBuilding &&
    state.selectedBuilding.type === "barracks" &&
    Array.isArray(state.selectedBuilding.queue) &&
    state.selectedBuilding.queue.length < MAX_QUEUE &&
    stockpile.wood >= unitCost(type) &&
    units.filter((unit) => unit.team === TEAM_PLAYER).length < MAX_UNITS
  );
}

export function trainUnit(type = "soldier") {
  if (!canTrain(type)) return;
  stockpile.wood -= unitCost(type);
  state.selectedBuilding.queue.push(type);
}

// Clic en la barra inferior: solo los botones hacen algo.
export function handleHudClick(screenX, screenY) {
  const buttons = hudButtons();

  if (state.selectedBuilding && state.selectedBuilding.type === "barracks") {
    if (pointInRect(screenX, screenY, buttons.left)) {
      trainUnit("soldier");
    } else if (pointInRect(screenX, screenY, buttons.right)) {
      trainUnit("archer");
    }
    return;
  }

  if (pointInRect(screenX, screenY, buttons.left)) {
    startBuildMode("barracks");
  } else if (pointInRect(screenX, screenY, buttons.right)) {
    startBuildMode("tower");
  }
}

// Avanza la cola de entrenamiento de cada cuartel del jugador.
export function updateBuildings(dt) {
  for (const building of buildings) {
    if (building.type !== "barracks" || building.team !== TEAM_PLAYER) continue;
    if (!Array.isArray(building.queue) || building.queue.length === 0) continue;

    building.progress += dt;
    if (building.progress < TRAIN_TIME) continue;

    const type = building.queue[0];

    // Si no hay hueco alrededor, se reintenta en el siguiente frame.
    if (spawnUnit(building, type)) {
      building.queue.shift();
      building.progress = 0;
    } else {
      building.progress = TRAIN_TIME;
    }
  }
}

// Busca un hueco libre alrededor del cuartel y saca ahí la unidad nueva.
export function spawnUnit(building, type = "soldier") {
  const spot = findSpawnSpot(building);
  if (!spot) return false;

  units.push(createUnit(spot.x, spot.y, building.team || TEAM_PLAYER, type));
  return true;
}

// Las torres disparan solas al enemigo más cercano dentro de su alcance.
export function updateTowers(dt) {
  for (const building of buildings) {
    if (building.type !== "tower" || building.team !== TEAM_PLAYER) continue;

    building.cooldown = Math.max(0, (building.cooldown || 0) - dt);
    if (building.cooldown > 0) continue;

    const target = findNearestOpponent(building, TOWER_RANGE);
    if (!target) continue;

    applyDamage(target, TOWER_DAMAGE);
    building.cooldown = TOWER_COOLDOWN;

    effects.push({
      kind: "bolt",
      x: building.x + building.size / 2,
      y: building.y + building.size / 2,
      x2: target.x + target.size / 2,
      y2: target.y + target.size / 2,
      age: 0,
      color: "#93c5fd",
    });
  }
}

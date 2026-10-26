// Combate: búsqueda de objetivos, daño y muerte.
import { state, canvas, ctx, units, buildings, camp, obstacles, effects, gameState } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { buildRoute, clampDestination } from "./navigation";
import { playSound } from "./audio";

// Distancia desde el borde de la unidad hasta el borde del objetivo.
export function distanceToTarget(unit, target) {
  const ux = unit.x + unit.size / 2;
  const uy = unit.y + unit.size / 2;
  const tx = target.x + target.size / 2;
  const ty = target.y + target.size / 2;
  const centerDistance = Math.hypot(tx - ux, ty - uy);
  return Math.max(0, centerDistance - unit.size / 2 - target.size / 2);
}

// ¿Sigue existiendo el objetivo? (una unidad muerta sale del array)
export function isAliveTarget(target) {
  if (!target || target.hp <= 0) return false;
  return units.includes(target) || buildings.includes(target);
}

// El enemigo vivo más cercano (unidad o edificio del otro equipo).
export function findNearestOpponent(unit, maxDistance) {
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
export function approachSpot(unit, target) {
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
export function orderAttack(selected, target) {
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
export function updateCombat(unit, dt) {
  unit.cooldown = Math.max(0, unit.cooldown - dt);

  let target = unit.attackTarget;
  if (target && !isAliveTarget(target)) {
    unit.attackTarget = null;
    target = null;
  }

  // Los enemigos buscan al jugador a cierta distancia; las unidades del
  // jugador sólo responden a enemigos que ya estén a tiro.
  if (!target && !unit.dest) {
    const searchRange =
      unit.team === TEAM_ENEMY
        ? (unit.wave ? Infinity : ENEMY_AGGRO_RANGE)
        : unit.range + 10;
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
    playSound(unit.range > 60 ? "shoot" : "hit");

    if (unit.range > 60) {
      // Los arqueros y las torres dibujan un proyectil.
      effects.push({
        kind: "bolt",
        x: unit.x + unit.size / 2,
        y: unit.y + unit.size / 2,
        x2: target.x + target.size / 2,
        y2: target.y + target.size / 2,
        age: 0,
        color: "#93c5fd",
      });
    } else {
      effects.push({
        x: target.x + target.size / 2,
        y: target.y + target.size / 2,
        age: 0,
        color: unit.team === TEAM_ENEMY ? "#f87171" : "#fbbf24",
      });
    }
  }
}

// Quita vida y, si llega a cero, retira la unidad o el edificio.
export function applyDamage(target, amount) {
  if (!target || target.hp <= 0) return;

  target.hp -= amount;

  if (units.includes(target)) {
    target.hitFlash = 0.12;
  }

  if (target.hp > 0) return;

  target.hp = 0;

  if (target === camp) {
    destroyCamp();
    return;
  }

  playSound("death");
  effects.push({
    x: target.x + target.size / 2,
    y: target.y + target.size / 2,
    age: 0,
    color: "#f87171",
  });

  if (units.includes(target)) {
    removeUnit(target);
    return;
  }

  const buildingIndex = buildings.indexOf(target);
  if (buildingIndex !== -1) {
    buildings.splice(buildingIndex, 1);
    const obstacleIndex = obstacles.indexOf(target);
    if (obstacleIndex !== -1) obstacles.splice(obstacleIndex, 1);
    if (state.selectedBuilding === target) state.selectedBuilding = null;
  }
}

export function removeUnit(unit) {
  const index = units.indexOf(unit);
  if (index !== -1) units.splice(index, 1);

  for (const other of units) {
    if (other.attackTarget === unit) other.attackTarget = null;
  }
}

export function destroyCamp() {
  if (!camp.alive) return;

  camp.alive = false;
  camp.hp = 0;

  const buildingIndex = buildings.indexOf(camp);
  if (buildingIndex !== -1) buildings.splice(buildingIndex, 1);
  const obstacleIndex = obstacles.indexOf(camp);
  if (obstacleIndex !== -1) obstacles.splice(obstacleIndex, 1);

  playSound("victory");
  effects.push({
    x: camp.x + camp.size / 2,
    y: camp.y + camp.size / 2,
    age: 0,
    color: "#fbbf24",
  });

  gameState.victory = true;
}

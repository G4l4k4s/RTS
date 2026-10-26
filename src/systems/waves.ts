// Guardias del campamento, oleadas y derrota.
import { state, canvas, ctx, units, buildings, camp, gameState, waveState } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { findSpawnSpot } from "./placement";
import { createUnit } from "../entities/unit";
import { findNearestOpponent } from "./combat";
import { showToast } from "../core/feedback";
import { playSound } from "./audio";
import { saveGame } from "./session";

// El campamento saca guardias si el jugador se acerca.
export function updateCamp(dt) {
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

export function spawnEnemy() {
  const spot = findSpawnSpot(camp);
  if (!spot) return;

  units.push(createUnit(spot.x, spot.y, TEAM_ENEMY));
}

// Oleadas: cada cierto tiempo el campamento manda un grupo hacia tu base.
export function updateWaves(dt) {
  if (gameState.victory || gameState.defeat || !camp.alive) return;

  const preset = DIFFICULTIES[gameState.difficulty] || DIFFICULTIES.normal;

  waveState.timer -= dt;
  if (waveState.timer > 0) return;

  waveState.number += 1;
  waveState.timer = preset.waveInterval;

  const livingEnemies = units.filter((unit) => unit.team === TEAM_ENEMY).length;
  const desired = Math.min(
    8,
    preset.waveBase + Math.floor((waveState.number - 1) * preset.waveGrowth)
  );
  const count = Math.min(desired, Math.max(0, WAVE_MAX_LIVE - livingEnemies));

  for (let i = 0; i < count; i++) {
    spawnWaveEnemy();
  }

  if (count > 0) {
    showToast(`¡Oleada ${waveState.number}!`);
    playSound("wave");

    // Autoguardado al empezar cada oleada: si cierras, puedes continuar.
    saveGame(AUTOSAVE_KEY, true);
  }
}

export function spawnWaveEnemy() {
  const spot = findSpawnSpot(camp);
  if (!spot) return false;

  const preset = DIFFICULTIES[gameState.difficulty] || DIFFICULTIES.normal;

  const enemy = createUnit(spot.x, spot.y, TEAM_ENEMY);
  enemy.wave = true;
  enemy.maxHp = Math.round(ENEMY_MAX_HP * preset.enemyHp);
  enemy.hp = enemy.maxHp;
  enemy.damage = Math.round(ENEMY_DAMAGE * preset.enemyDamage);
  enemy.attackTarget = findNearestOpponent(enemy, Infinity);
  units.push(enemy);
  return true;
}

// Si no queda nada del jugador, la partida termina.
export function updateDefeat() {
  if (gameState.victory || gameState.defeat) return;

  const hasUnits = units.some((unit) => unit.team === TEAM_PLAYER);
  const hasBuildings = buildings.some((building) => building.team === TEAM_PLAYER);

  if (!hasUnits && !hasBuildings) {
    gameState.defeat = true;
    playSound("defeat");
    showToast("Derrota");
  }
}

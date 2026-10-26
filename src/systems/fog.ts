// Niebla de guerra: celdas exploradas y visibles.
import { state, canvas, ctx, units, buildings, fog } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";

export function fogIndex(col: number, row: number): number {
  return row * FOG_COLS + col;
}

// Marca como visibles y exploradas las celdas dentro del radio.
export function revealCircle(centerX: number, centerY: number, radius: number): void {
  const minCol = Math.max(0, Math.floor((centerX - radius) / FOG_TILE));
  const maxCol = Math.min(FOG_COLS - 1, Math.floor((centerX + radius) / FOG_TILE));
  const minRow = Math.max(0, Math.floor((centerY - radius) / FOG_TILE));
  const maxRow = Math.min(FOG_ROWS - 1, Math.floor((centerY + radius) / FOG_TILE));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const tileX = col * FOG_TILE + FOG_TILE / 2;
      const tileY = row * FOG_TILE + FOG_TILE / 2;
      if (Math.hypot(tileX - centerX, tileY - centerY) > radius) continue;

      const index = fogIndex(col, row);
      fog.visible[index] = 1;
      fog.explored[index] = 1;
    }
  }
}

export function updateFog(): void {
  fog.visible.fill(0);

  for (const unit of units) {
    if (unit.team !== TEAM_PLAYER) continue;
    revealCircle(unit.x + unit.size / 2, unit.y + unit.size / 2, VISION_UNIT);
  }

  for (const building of buildings) {
    if (building.team !== TEAM_PLAYER) continue;
    revealCircle(building.x + building.size / 2, building.y + building.size / 2, VISION_BUILDING);
  }
}

export function isVisibleAt(x: number, y: number): boolean {
  const col = Math.max(0, Math.min(FOG_COLS - 1, Math.floor(x / FOG_TILE)));
  const row = Math.max(0, Math.min(FOG_ROWS - 1, Math.floor(y / FOG_TILE)));
  return fog.visible[fogIndex(col, row)] === 1;
}

export function isExploredAt(x: number, y: number): boolean {
  const col = Math.max(0, Math.min(FOG_COLS - 1, Math.floor(x / FOG_TILE)));
  const row = Math.max(0, Math.min(FOG_ROWS - 1, Math.floor(y / FOG_TILE)));
  return fog.explored[fogIndex(col, row)] === 1;
}

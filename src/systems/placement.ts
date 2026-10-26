// Huecos libres para colocar unidades nuevas.
import { state, canvas, ctx, units } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { rectsOverlap, unitRect } from "../core/math";
import { canStand } from "./navigation";
import type { Point, SizeRect } from "../core/types";

export function findSpawnSpot(building: SizeRect): Point | null {
  const gap = building.size / 2 + UNIT_SIZE / 2 + 6;
  const offsets = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];

  // Varios anillos por si el primero está ocupado.
  for (let ring = 0; ring < 3; ring++) {
    const distance = gap + ring * (UNIT_SIZE + 8);

    for (const offset of offsets) {
      const x = building.x + building.size / 2 + offset.x * distance - UNIT_SIZE / 2;
      const y = building.y + building.size / 2 + offset.y * distance - UNIT_SIZE / 2;
      if (canPlaceUnit(x, y)) return { x, y };
    }
  }

  return null;
}

// ¿Cabe una unidad aquí, sin pisar obstáculos ni otras unidades?
export function canPlaceUnit(x: number, y: number): boolean {
  if (!canStand({ size: UNIT_SIZE }, x, y)) return false;

  const box = { x, y, w: UNIT_SIZE, h: UNIT_SIZE };
  for (const unit of units) {
    if (rectsOverlap(box, unitRect(unit))) return false;
  }
  return true;
}

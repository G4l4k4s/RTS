// Rectángulos de los botones de la interfaz.
import { state, canvas, ctx } from "./state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "./constants";

// Rectángulos de los botones del HUD (en coordenadas de pantalla).
export function hudButtons() {
  const y = canvas.height - HUD_HEIGHT + 12;
  return {
    left: { x: 430, y, w: 164, h: 40 },
    right: { x: 614, y, w: 170, h: 40 },
  };
}

export function toolbarButtons() {
  return {
    sound: { x: canvas.width - 260, y: 10, w: 78, h: 26 },
    save: { x: canvas.width - 176, y: 10, w: 78, h: 26 },
    load: { x: canvas.width - 92, y: 10, w: 78, h: 26 },
  };
}

export function menuButtons() {
  const width = 280;
  const x = (canvas.width - width) / 2;
  return {
    easy: { x, y: 232, w: width, h: 50 },
    normal: { x, y: 292, w: width, h: 50 },
    hard: { x, y: 352, w: width, h: 50 },
    continue: { x, y: 430, w: width, h: 44 },
  };
}
